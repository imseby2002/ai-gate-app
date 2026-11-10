/**
 * 網路搜尋鏈（客服搜尋、外務、圓桌查資料、Agent 搜尋工具共用）
 *
 * 順序：
 *  免費  FreeLLM groq/compound-mini → CLIProxy gemini-3-flash-agent
 *  付費  Gemini 2.5 Flash＋Google 搜尋（每天前 1,500 次提問免費）
 *      → Gemini 3 Flash＋Google 搜尋（每月前 5,000 次搜尋免費）
 *      → 兩邊免費額度都用完：依「每次提問平均搜尋次數」選較便宜者
 *         （2.5 Flash 每 1,000 次提問 $35；Gemini 3 每 1,000 次搜尋 $14 → 平均 < 2.5 次時 Gemini 3 較便宜）
 *      → Perplexity Sonar → Claude Sonnet 5.5＋Claude 搜尋（每 1,000 次 $10）
 * 價格來源：ai.google.dev/gemini-api/docs/google-search、platform.claude.com 定價頁。
 * Google 超過免費額度不會報錯而是直接計費，所以這裡自己記錄用量（ai_search_usage）。
 */
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, stepCountIs, type ModelMessage } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeFreeLlmBaseUrl } from './providers/free-llm'
import { trackAiUsage, type FeatureModule } from './universal-tracker'
import { directCostUsd } from './proxy-fallback'

export interface SearchSource { url: string; title: string }

export interface WebSearchOptions {
  system: string
  messages: ModelMessage[]
  /** Claude 搜尋的次數上限（其他通道無法限制） */
  maxSearches?: number
  maxOutputTokens?: number
  feature?: FeatureModule
  /** 必須附來源網址：免費通道沒回傳網址時視為失敗，改用下一個 */
  requireSources?: boolean
  /** 每個通道的逾時毫秒數 */
  timeoutMs?: number
  /** 只試免費通道（呼叫端自己有付費備援時用） */
  freeOnly?: boolean
}

export interface WebSearchResult {
  text: string
  sources: SearchSource[]
  usedModel: string
  costUsd: number
}

const GEMINI_25_DAILY_FREE = 1500
const GEMINI_3_MONTHLY_FREE = 5000
const GEMINI_25_PER_PROMPT = 35 / 1000
const GEMINI_3_PER_QUERY = 14 / 1000
const CLAUDE_PER_SEARCH = 10 / 1000
// Perplexity Sonar：沿用 marketing/billing.ts 既有估價（$1/$1 每百萬 tokens + 每次 $0.005）
const SONAR_PRICE = { input: 1, output: 1 }
const SONAR_PER_REQUEST = 0.005

const URL_RE = /https?:\/\/[^\s)\]>"'，。、]+/g

function urlsFromText(text: string): SearchSource[] {
  const seen = new Set<string>()
  const out: SearchSource[] = []
  for (const u of text.match(URL_RE) ?? []) {
    const url = u.replace(/[.,;:]+$/, '')
    if (!seen.has(url)) { seen.add(url); out.push({ url, title: url }) }
  }
  return out
}

function sourcesFrom(res: { sources?: unknown[] }, text: string): SearchSource[] {
  const seen = new Set<string>()
  const out: SearchSource[] = []
  for (const s of (res.sources ?? []) as { sourceType?: string; url?: string; title?: string }[]) {
    if (s.sourceType !== 'url' || !s.url || seen.has(s.url)) continue
    seen.add(s.url)
    out.push({ url: s.url, title: s.title ?? s.url })
  }
  return out.length ? out : urlsFromText(text)
}

function tokens(usage: unknown) {
  const u = (usage ?? {}) as Record<string, number | undefined>
  return { input: u.inputTokens ?? 0, output: u.outputTokens ?? 0 }
}

// ── Gemini 免費額度計數 ───────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${today().slice(0, 7)}-01`

async function geminiUsage() {
  try {
    const admin = createAdminClient()
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
    const { data } = await admin.from('ai_search_usage').select('date, provider, prompts, queries')
      .in('provider', ['gemini-2.5-flash', 'gemini-3']).gte('date', since30 < monthStart() ? since30 : monthStart())
    const rows = data ?? []
    const g25Today = rows.filter(r => r.provider === 'gemini-2.5-flash' && r.date === today()).reduce((a, r) => a + r.prompts, 0)
    const g3Month = rows.filter(r => r.provider === 'gemini-3' && r.date >= monthStart()).reduce((a, r) => a + r.queries, 0)
    const g3Rows = rows.filter(r => r.provider === 'gemini-3' && r.date >= since30)
    const prompts = g3Rows.reduce((a, r) => a + r.prompts, 0)
    const queries = g3Rows.reduce((a, r) => a + r.queries, 0)
    return { g25Today, g3Month, avgQueriesPerPrompt: prompts > 0 ? queries / prompts : 1 }
  } catch {
    // 讀不到用量時保守當作已用完，避免在不知情下超額計費（仍會依單價選較便宜者）
    return { g25Today: GEMINI_25_DAILY_FREE, g3Month: GEMINI_3_MONTHLY_FREE, avgQueriesPerPrompt: 1 }
  }
}

async function recordGemini(provider: 'gemini-2.5-flash' | 'gemini-3', queries: number) {
  try {
    await createAdminClient().rpc('increment_ai_search_usage', { p_date: today(), p_provider: provider, p_prompts: 1, p_queries: queries })
  } catch { /* 計數失敗不影響回覆 */ }
}

// ── 各通道 ─────────────────────────────────────────────────────────────────────

type Step = { label: string; run: () => Promise<WebSearchResult | null> }

function openAiCompatStep(label: string, baseURL: string, apiKey: string, model: string, opts: WebSearchOptions, free: boolean): Step {
  return {
    label,
    run: async () => {
      const res = await generateText({
        model: createOpenAI({ apiKey, baseURL }).chat(model),
        system: opts.system,
        messages: opts.messages,
        maxOutputTokens: opts.maxOutputTokens,
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
      })
      if (!res.text?.trim()) return null
      const sources = sourcesFrom(res, res.text)
      if (opts.requireSources && !sources.length) return null
      const t = tokens(res.usage)
      const costUsd = free ? 0 : (t.input * SONAR_PRICE.input + t.output * SONAR_PRICE.output) / 1_000_000 + SONAR_PER_REQUEST
      return { text: res.text, sources, usedModel: label, costUsd }
    },
  }
}

function geminiStep(kind: 'gemini-2.5-flash' | 'gemini-3', opts: WebSearchOptions, usage: Awaited<ReturnType<typeof geminiUsage>>): Step | null {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) return null
  const model = kind === 'gemini-3' ? 'gemini-3-flash-preview' : 'gemini-2.5-flash'
  return {
    label: `${model}+google_search`,
    run: async () => {
      const google = createGoogleGenerativeAI({ apiKey: key })
      const res = await generateText({
        model: google(model),
        system: opts.system,
        messages: opts.messages,
        tools: { google_search: google.tools.googleSearch({}) },
        maxOutputTokens: opts.maxOutputTokens,
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 90000),
      })
      if (!res.text?.trim()) return null
      const meta = (res.providerMetadata?.google ?? {}) as { groundingMetadata?: { webSearchQueries?: string[] | null } }
      const queries = meta.groundingMetadata?.webSearchQueries?.length ?? 1
      await recordGemini(kind, queries)
      const t = tokens(res.usage)
      let searchFee = 0
      if (kind === 'gemini-2.5-flash' && usage.g25Today >= GEMINI_25_DAILY_FREE) searchFee = GEMINI_25_PER_PROMPT
      if (kind === 'gemini-3' && usage.g3Month >= GEMINI_3_MONTHLY_FREE) searchFee = GEMINI_3_PER_QUERY * queries
      const sources = sourcesFrom(res, res.text)
      return { text: res.text, sources, usedModel: `${model}+google_search`, costUsd: directCostUsd(model, t.input, t.output) + searchFee }
    },
  }
}

function claudeStep(opts: WebSearchOptions): Step | null {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  return {
    label: 'claude-sonnet-5-5+web_search',
    run: async () => {
      const anthropic = createAnthropic({ apiKey: key })
      const res = await generateText({
        model: anthropic('claude-sonnet-5-5'),
        system: opts.system,
        messages: opts.messages,
        tools: { web_search: anthropic.tools.webSearch_20260209({ maxUses: opts.maxSearches ?? 5 }) },
        stopWhen: stepCountIs(8),
        maxOutputTokens: Math.max(opts.maxOutputTokens ?? 4000, 16000),
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 120000),
      })
      if (!res.text?.trim()) return null
      const searches = (res.steps ?? []).flatMap(s => s.toolCalls ?? []).filter(tc => tc.toolName === 'web_search').length
      const t = tokens(res.usage)
      return {
        text: res.text,
        sources: sourcesFrom(res, res.text),
        usedModel: 'claude-sonnet-5-5+web_search',
        costUsd: directCostUsd('claude-sonnet-5-5', t.input, t.output) + searches * CLAUDE_PER_SEARCH,
      }
    },
  }
}

// ── 主函式 ─────────────────────────────────────────────────────────────────────

export async function webSearchGenerate(opts: WebSearchOptions): Promise<WebSearchResult> {
  const steps: Step[] = []

  const freeLlmUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  if (process.env.FREE_LLM_API_KEY && freeLlmUrl) {
    // 可用 FREE_LLM_SEARCH_MODEL 覆寫（客服搜尋分支原本就使用 groq/compound-mini）
    const model = process.env.FREE_LLM_SEARCH_MODEL ?? 'groq/compound-mini'
    steps.push(openAiCompatStep(`free-llm:${model}`, normalizeFreeLlmBaseUrl(freeLlmUrl), process.env.FREE_LLM_API_KEY, model, opts, true))
  }
  const cliUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  if (cliUrl) {
    steps.push(openAiCompatStep('cli-proxy:gemini-3-flash-agent', cliUrl, process.env.CLI_PROXY_API_KEY ?? 'no-key', 'gemini-3-flash-agent', opts, true))
  }

  if (opts.freeOnly) return runSteps(steps, opts)

  // Gemini：先用免費額度，都用完再依平均搜尋次數挑較便宜者
  const usage = await geminiUsage()
  const g25 = geminiStep('gemini-2.5-flash', opts, usage)
  const g3 = geminiStep('gemini-3', opts, usage)
  const geminiOrder: (Step | null)[] = []
  if (usage.g25Today < GEMINI_25_DAILY_FREE) geminiOrder.push(g25)
  if (usage.g3Month < GEMINI_3_MONTHLY_FREE) geminiOrder.push(g3)
  const g3Cheaper = usage.avgQueriesPerPrompt * GEMINI_3_PER_QUERY < GEMINI_25_PER_PROMPT
  geminiOrder.push(...(g3Cheaper ? [g3, g25] : [g25, g3]))
  for (const s of geminiOrder) if (s && !steps.includes(s)) steps.push(s)

  if (process.env.PERPLEXITY_API_KEY) {
    steps.push(openAiCompatStep('perplexity:sonar', 'https://api.perplexity.ai', process.env.PERPLEXITY_API_KEY, 'sonar', opts, false))
  }
  const claude = claudeStep(opts)
  if (claude) steps.push(claude)
  return runSteps(steps, opts)
}

async function runSteps(steps: Step[], opts: WebSearchOptions): Promise<WebSearchResult> {
  let lastError: unknown = new Error('沒有可用的搜尋通道')
  for (const step of steps) {
    try {
      const r = await step.run()
      if (!r) { lastError = new Error(`${step.label}: 無內容或缺少來源`); continue }
      if (opts.feature) {
        void trackAiUsage({ feature: opts.feature, modelId: r.usedModel, inputTokens: 0, outputTokens: 0, costUsd: r.costUsd, metadata: { search: true } })
      }
      return r
    } catch (err) {
      lastError = err
      console.warn(`[web-search] ${step.label} failed:`, err instanceof Error ? err.message : err)
    }
  }
  throw lastError
}
