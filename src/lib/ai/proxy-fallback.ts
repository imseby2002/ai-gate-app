/**
 * Proxy Fallback Router
 *
 * 順序原則：免費（CLIProxy / Groq / FreeLLM / OpenRouter 免費模型）→ 便宜付費 → 高價付費，不犧牲品質。
 * 同一個付費模型同時有原廠直連與 OpenRouter 時，依每日比價（ai_route_prefs）決定哪個先用。
 * CLIProxy / OpenRouter 免費模型清單也由每日排程更新：下架的自動跳過，CLIProxy 有新版 Claude 就自動改用。
 */
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGroq } from '@ai-sdk/groq'
import { streamText, generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { ChatParams } from './providers/cli-proxy'
import { normalizeFreeLlmBaseUrl } from './providers/free-llm'
import { trackAiUsage, type FeatureModule } from './universal-tracker'
import { GROQ_MODEL_MAP, GROQ_AUTO_MODEL } from './providers/groq'
import { loadRoutePrefs, getCachedRoutePrefs, type RoutePrefs } from './route-prefs'

// ── Attempt descriptor ────────────────────────────────────────────────────────

export type DirectProvider = 'deepseek' | 'google' | 'anthropic' | 'groq'

export type Attempt =
  /** prefer：CLIProxy 若有提供這些較新的型號就改用（依每日抓到的 /models 清單） */
  | { via: 'cli-proxy'; model: string; prefer?: readonly string[] }
  | { via: 'free-llm';  model: string }
  /** pair：與同名的 OpenRouter attempt 成對，依每日比價決定先後 */
  | { via: 'direct';    provider: DirectProvider; model: string; pair?: string }
  /** openWeight：開源模型在 OpenRouter 有多家供應商，依價格路由並排除低精度量化 */
  | { via: 'openrouter'; model: string; pair?: string; openWeight?: boolean; free?: boolean }
  /** OpenRouter 免費模型：依每日清單找出 id/名稱包含所有 match 字詞的模型；清單沒有就跳過 */
  | { via: 'openrouter-free'; match: readonly string[] }

// ── 付費模型目錄（直連 + OpenRouter 成對） ─────────────────────────────────────
//
// 官方價（USD / 1M tokens，輸入/輸出）：
//   Claude Haiku 5.5 $0.10/$0.50（輸入 >100K 時 $0.50/$2.50）、Claude Sonnet 5.5 $2/$10 —— Anthropic
//   Gemini 2.5 Flash $0.30/$2.50、Gemini 3 Flash $0.50/$3.00、Gemini 2.5 Pro $1.25/$10 —— ai.google.dev/gemini-api/docs/pricing
//   DeepSeek Flash 離峰 $0.15/$0.60、尖峰 $0.30/$1.20 —— api-docs.deepseek.com/quick_start/pricing
//   Kimi K2.5 只走 OpenRouter（官方價查不到；OpenRouter 約 $0.45–0.49/$2.25–2.50，以每日比價為準）
// OpenRouter 對閉源模型照原廠價、另收儲值手續費 5.5%，所以通常直連較便宜；開源模型依供應商報價可能較便宜。

const PAIRS = {
  'claude-haiku-5-5':  { direct: { provider: 'anthropic', model: 'claude-haiku-5-5' },  openrouter: 'anthropic/claude-haiku-5.5',  openWeight: false },
  'claude-sonnet-5-5': { direct: { provider: 'anthropic', model: 'claude-sonnet-5-5' }, openrouter: 'anthropic/claude-sonnet-5.5', openWeight: false },
  'gemini-2.5-flash':  { direct: { provider: 'google',    model: 'gemini-2.5-flash' },  openrouter: 'google/gemini-2.5-flash',     openWeight: false },
  'gemini-2.5-pro':    { direct: { provider: 'google',    model: 'gemini-2.5-pro' },    openrouter: 'google/gemini-2.5-pro',       openWeight: false },
  'deepseek-flash':    { direct: { provider: 'deepseek',  model: 'deepseek-flash' },    openrouter: 'deepseek/deepseek-v4-flash',  openWeight: true  },
} as const satisfies Record<string, { direct: { provider: DirectProvider; model: string }; openrouter: string; openWeight: boolean }>

export type PairName = keyof typeof PAIRS
export const PAIR_NAMES = Object.keys(PAIRS) as PairName[]
export function pairInfo(name: PairName) { return PAIRS[name] }

/** 原廠直連價（USD / 1M tokens） */
export const DIRECT_PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5':       { input: 0.1,  output: 0.5 },
  'claude-sonnet-5-5':      { input: 2,    output: 10 },
  'claude-opus-5-5':        { input: 4,    output: 20 },
  'gemini-2.5-flash':       { input: 0.3,  output: 2.5 },
  'gemini-3-flash-preview': { input: 0.5,  output: 3 },
  'gemini-2.5-pro':         { input: 1.25, output: 10 },
  // DeepSeek Flash 有尖峰/離峰價，保守以尖峰價計
  'deepseek-flash':         { input: 0.3,  output: 1.2 },
}

/** OpenRouter 儲值手續費（官方：Standard 方案 5.5%） */
export const OPENROUTER_FEE = 0.055
/** OpenRouter 開源模型可接受的精度（排除 int4/int8/fp4 等明顯降質的量化） */
export const OPENROUTER_OK_QUANTIZATIONS = ['fp8', 'fp16', 'bf16', 'fp32'] as const

/** 成對付費模型：預設直連在前，每日比價後可能對調 */
function paid(name: PairName): Attempt[] {
  const p = PAIRS[name]
  return [
    { via: 'direct', provider: p.direct.provider, model: p.direct.model, pair: name },
    { via: 'openrouter', model: p.openrouter, pair: name, openWeight: p.openWeight },
  ]
}

// ── 免費通道快捷 ──────────────────────────────────────────────────────────────

const cli = (model: string, prefer?: readonly string[]): Attempt => ({ via: 'cli-proxy', model, prefer })
const freeLlm = (model: string): Attempt => ({ via: 'free-llm', model })
const groq = (model: string): Attempt => ({ via: 'direct', provider: 'groq', model })
const orFree = (...match: string[]): Attempt => ({ via: 'openrouter-free', match })
const orKimi: Attempt = { via: 'openrouter', model: 'moonshotai/kimi-k2.5', openWeight: true }
const gemini3FlashDirect: Attempt = { via: 'direct', provider: 'google', model: 'gemini-3-flash-preview' }

// CLIProxy 的 Claude：有 5.5 就用 5.5，沒有就用 4.6 / 4.5（依每日 /models 清單）
const CLI_SONNET = cli('claude-sonnet-4-6', ['claude-sonnet-5-5', 'claude-sonnet-5.5'])
const CLI_HAIKU = cli('claude-haiku-4-5-20251001', ['claude-haiku-5-5', 'claude-haiku-5.5'])

// ── 13 類模型鏈（見 PR 說明的完整表） ─────────────────────────────────────────

/** 1. 工具呼叫（行銷 Agent）：小模型多輪工具呼叫成功率低，不放 Groq/FreeLLM，也不放 Haiku */
const TOOLS: Attempt[] = [
  cli('gpt-5.5'), CLI_SONNET, cli('kimi-k2.5'), cli('gemini-2.5-pro'),
  orKimi, ...paid('gemini-2.5-pro'), ...paid('claude-sonnet-5-5'),
]

/** 2. 程式碼修改（autofix）：Anthropic 官方說 Haiku 只適合簡單修改，所以不放 */
const CODING: Attempt[] = [
  cli('gpt-5.5'), CLI_SONNET, cli('kimi-k2.5'), cli('gemini-2.5-pro'),
  ...paid('deepseek-flash'), orKimi, ...paid('gemini-2.5-pro'), ...paid('claude-sonnet-5-5'),
]

/** 3. 擷取／分類／摘要（輸出需通過 JSON 等驗證） */
const EXTRACTION: Attempt[] = [
  cli('gemini-3-flash'), cli('gpt-5.4-mini'), CLI_HAIKU,
  groq('groq-qwen3-32b'), freeLlm('qwen3-32b'), freeLlm('glm-4.7-flash'), orFree('nemotron', 'lightning'),
  ...paid('claude-haiku-5-5'), ...paid('deepseek-flash'),
]

/** 4. 推理（排班、財務）：Groq 改用 gpt-oss-120b（Groq 下架公告建議的替代之一）與 QwQ 32B */
const REASONING: Attempt[] = [
  cli('kimi-k2.5'), cli('gpt-5.5'), cli('grok-3-mini'),
  groq('groq-gpt-oss-120b'), groq('groq-qwq-32b'),
  ...paid('claude-haiku-5-5'), ...paid('deepseek-flash'), orKimi, ...paid('claude-sonnet-5-5'),
]

/** 5. 翻譯 */
const TRANSLATE: Attempt[] = [
  cli('gemini-3-flash'), cli('gpt-5.4-mini'), CLI_HAIKU, freeLlm('qwen3-32b'),
  ...paid('claude-haiku-5-5'), gemini3FlashDirect,
]

/** 6. 圖片／文件辨識（只放支援圖片輸入的模型；Haiku 5.5 圖片支援未查證，先不放） */
const VISION: Attempt[] = [
  cli('gemini-2.5-pro'), cli('gemini-3-flash'), cli('gpt-5.4-mini'), orFree('nemotron', 'vl'),
  ...paid('gemini-2.5-flash'), ...paid('claude-sonnet-5-5'),
]

/** 7. 長文內容 */
const CONTENT: Attempt[] = [
  cli('gemini-2.5-pro'), cli('gpt-5.5'), CLI_SONNET, cli('kimi-k2.5'),
  ...paid('claude-haiku-5-5'), orKimi, ...paid('claude-sonnet-5-5'),
]

/** 8. 一般對話（量大）：先用 Groq/FreeLLM，省下 CLIProxy 額度 */
const DAILY: Attempt[] = [
  groq('groq-qwen3-32b'), groq('groq-gpt-oss-20b'), freeLlm('qwen3-32b'), freeLlm('llama-3.3-70b'),
  orFree('nemotron', 'lightning'), cli('gemini-3-flash'), cli('gpt-5.4-mini'),
  ...paid('claude-haiku-5-5'), ...paid('gemini-2.5-flash'),
]

/** 11. 只用 Claude（客服高風險、任務計畫書） */
const PREMIUM: Attempt[] = [CLI_SONNET, ...paid('claude-sonnet-5-5')]

export const FALLBACK_CHAINS = {
  tools: TOOLS,
  agent: TOOLS,
  coding: CODING,
  extraction: EXTRACTION,
  reasoning: REASONING,
  finance: REASONING,
  translate: TRANSLATE,
  vision: VISION,
  content: CONTENT,
  creative: CONTENT,
  analysis: CONTENT,
  legal: CONTENT,
  daily: DAILY,
  cs: DAILY,
  premium: PREMIUM,
  cs_highrisk: PREMIUM,
} as const satisfies Record<string, readonly Attempt[]>

export type ChainName = keyof typeof FALLBACK_CHAINS

// ── 依每日資料把鏈解析成實際要試的順序 ────────────────────────────────────────

type ConcreteAttempt = Exclude<Attempt, { via: 'openrouter-free' }>

function norm(id: string) { return id.toLowerCase().replace(/\./g, '-') }

export function resolveChain(chain: readonly Attempt[], prefs: RoutePrefs | null): ConcreteAttempt[] {
  const out: ConcreteAttempt[] = []
  const cliList = prefs?.cliProxyModels ? new Map(prefs.cliProxyModels.map(id => [norm(id), id])) : null
  for (const a of chain) {
    if (a.via === 'cli-proxy') {
      if (!cliList) { out.push(a); continue }
      const preferred = (a.prefer ?? []).map(p => cliList.get(norm(p))).find(Boolean)
      if (preferred) { out.push({ via: 'cli-proxy', model: preferred }); continue }
      const own = cliList.get(norm(a.model))
      if (own) out.push({ via: 'cli-proxy', model: own })
      // 清單裡沒有這個模型（已下架）→ 跳過
      continue
    }
    if (a.via === 'openrouter-free') {
      const hit = (prefs?.openRouterFree ?? []).find(m => {
        const hay = `${m.id} ${m.name}`.toLowerCase()
        return a.match.every(w => hay.includes(w))
      })
      if (hit) out.push({ via: 'openrouter', model: hit.id, free: true })
      continue
    }
    out.push(a)
  }
  // 成對付費模型：依每日比價決定直連或 OpenRouter 先用
  for (let i = 0; i + 1 < out.length; i++) {
    const x = out[i], y = out[i + 1]
    const pair = 'pair' in x ? x.pair : undefined
    if (!pair || !('pair' in y) || y.pair !== pair) continue
    if (prefs?.pairOrder?.[pair] === 'openrouter' && x.via === 'direct') { out[i] = y; out[i + 1] = x }
    i++
  }
  // 去除重複（同一模型同一通道只試一次）
  const seen = new Set<string>()
  return out.filter(a => { const k = attemptModelId(a); if (seen.has(k)) return false; seen.add(k); return true })
}

export async function resolveChainLive(chain: readonly Attempt[]): Promise<ConcreteAttempt[]> {
  return resolveChain(chain, await loadRoutePrefs())
}

// ── Provider builder ───────────────────────────────────────────────────────────

/** OpenRouter：開源模型依價格路由並限制精度；閉源模型只有原廠一家，不加限制 */
function openRouterFetch(openWeight: boolean): typeof fetch {
  return async (input, init) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>
        body.provider = openWeight
          ? { sort: 'price', quantizations: [...OPENROUTER_OK_QUANTIZATIONS] }
          : { sort: 'price' }
        init = { ...init, body: JSON.stringify(body) }
      } catch { /* 非 JSON 就原樣送出 */ }
    }
    return fetch(input, init)
  }
}

export function buildModel(attempt: Attempt) {
  switch (attempt.via) {
    case 'openrouter-free':
      throw new Error('openrouter-free must be resolved first')
    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')
      return createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        fetch: attempt.free ? undefined : openRouterFetch(!!attempt.openWeight),
      }).chat(attempt.model)
    }
    case 'cli-proxy': {
      const baseURL = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
      const apiKey  = process.env.CLI_PROXY_API_KEY ?? 'no-key'
      if (!baseURL) throw new Error('CLI_PROXY_API_URL not set')
      return createOpenAI({ apiKey, baseURL }).chat(attempt.model)
    }
    case 'free-llm': {
      const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
      const apiKey  = process.env.FREE_LLM_API_KEY ?? 'no-key'
      if (!rawUrl || !apiKey) throw new Error('FREE_LLM not configured')
      const baseURL = normalizeFreeLlmBaseUrl(rawUrl)
      return createOpenAI({ apiKey, baseURL }).chat(attempt.model)
    }
    case 'direct': {
      if (attempt.provider === 'deepseek') {
        const key = process.env.DEEPSEEK_API_KEY
        if (!key) throw new Error('DEEPSEEK_API_KEY not set')
        // DeepSeek is OpenAI-compatible
        return createOpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com/v1' }).chat(attempt.model)
      }
      if (attempt.provider === 'google') {
        const key = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
        if (!key) throw new Error('GOOGLE_AI_API_KEY not set')
        return createGoogleGenerativeAI({ apiKey: key })(attempt.model)
      }
      if (attempt.provider === 'anthropic') {
        const key = process.env.ANTHROPIC_API_KEY
        if (!key) throw new Error('ANTHROPIC_API_KEY not set')
        return createAnthropic({ apiKey: key })(attempt.model)
      }
      if (attempt.provider === 'groq') {
        const key = process.env.GROQ_API_KEY
        if (!key) throw new Error('GROQ_API_KEY not set')
        // 對照 groq.ts 的 GROQ_MODEL_MAP，不能自己剝 "groq-" 前綴——Groq 的實際
        // model 名稱跟我們的 id 常常不是簡單去掉前綴的關係（如 llama-3.3-70b
        // 實際要打 llama-3.3-70b-versatile，naive strip 會打到不存在的 model）
        const realModel = attempt.model === 'groq-auto'
          ? GROQ_AUTO_MODEL
          : (GROQ_MODEL_MAP[attempt.model] ?? GROQ_AUTO_MODEL)
        return createGroq({ apiKey: key })(realModel)
      }
      throw new Error(`Unknown direct provider: ${(attempt as { provider: string }).provider}`)
    }
  }
}

// ── Is this error retryable? ───────────────────────────────────────────────────

export function isRetryable(err: unknown): boolean {
  const msg = String(err).toLowerCase()
  // 429 rate limit, 503 unavailable, network errors, model not found/no access
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('model_not_found') ||
    // OpenAI 相容端點常見格式："The model X does not exist or you do not have access to it."
    msg.includes('does not exist') ||
    msg.includes('do not have access') ||
    msg.includes('not found') ||
    msg.includes('invalid model') ||
    msg.includes('unknown model') ||
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout')
  )
}

// ── 模型 id、計費、通道 ───────────────────────────────────────────────────────

export function attemptModelId(attempt: Attempt): string {
  if (attempt.via === 'openrouter-free') return `openrouter-free:${attempt.match.join('+')}`
  return attempt.via === 'direct' ? attempt.model : `${attempt.via}:${attempt.model}`
}

// Claude 5.x（直連或經 OpenRouter）：非預設的 temperature/topP/topK 會回 400；
// AI SDK 不認得新型號時 max_tokens 預設只有 4096（thinking 也算在內），需給足上限。
function isClaude5(attempt: Attempt) {
  if (attempt.via === 'direct') return attempt.provider === 'anthropic' && /^claude-(haiku|sonnet|opus|fable)-5/.test(attempt.model)
  if (attempt.via === 'openrouter') return /^anthropic\/claude-(haiku|sonnet|opus|fable)-5/.test(attempt.model)
  return false
}

type Channel = 'cliproxy' | 'freellm' | 'groq' | 'anthropic' | 'google' | 'deepseek' | 'openrouter'

function sourceChannelOf(attempt: Attempt): Channel {
  if (attempt.via === 'cli-proxy') return 'cliproxy'
  if (attempt.via === 'free-llm') return 'freellm'
  if (attempt.via === 'openrouter' || attempt.via === 'openrouter-free') return 'openrouter'
  return attempt.provider
}

function perMillion(price: { input: number; output: number }, inputTokens: number, outputTokens: number) {
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

/**
 * 依實際使用的模型 id（attemptModelId 的格式）計算 USD 成本；免費通道為 0。
 * OpenRouter 用每日抓到的價格 × (1 + 儲值手續費)；沒有資料時用同模型直連價估算。
 */
export function costForUsedModel(usedModel: string, inputTokens: number, outputTokens: number): number {
  if (/^(cli-proxy|free-llm|openrouter-free):/.test(usedModel) || usedModel.endsWith(':free') || usedModel.startsWith('groq-')) return 0
  if (usedModel.startsWith('openrouter:')) {
    const orId = usedModel.slice('openrouter:'.length)
    const live = getCachedRoutePrefs()?.openRouterPrices?.[orId]
    const pair = PAIR_NAMES.find(n => PAIRS[n].openrouter === orId)
    const base = live ?? (pair ? DIRECT_PRICES[PAIRS[pair].direct.model] : undefined)
    return base ? perMillion(base, inputTokens, outputTokens) * (1 + OPENROUTER_FEE) : 0
  }
  return directCostUsd(usedModel, inputTokens, outputTokens)
}

export function directCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = DIRECT_PRICES[model]
  if (!p) return 0
  // Haiku 5.5 單次輸入超過 100K tokens 時改用較高單價（Anthropic 官方）
  if (model === 'claude-haiku-5-5' && inputTokens > 100_000) {
    return perMillion({ input: 0.5, output: 2.5 }, inputTokens, outputTokens)
  }
  return perMillion(p, inputTokens, outputTokens)
}

function prepareArgs<T extends Record<string, unknown>>(attempt: Attempt, args: T): T {
  if (!isClaude5(attempt)) return args
  const o = { ...args } as Record<string, unknown>
  delete o.temperature
  delete o.topP
  delete o.topK
  if (o.maxOutputTokens == null) o.maxOutputTokens = 16000
  // Claude 5.x 預設開啟 thinking，thinking 也算在 max_tokens 內；上限太小會只剩思考、沒有答案
  else if (Number(o.maxOutputTokens) < 2000) o.maxOutputTokens = 2000
  return o as T
}

function track(feature: FeatureModule | undefined, attempt: Attempt, usage: unknown) {
  if (!feature) return
  const u = (usage ?? {}) as Record<string, number | undefined>
  const inputTokens = u.inputTokens ?? 0
  const outputTokens = u.outputTokens ?? 0
  const id = attemptModelId(attempt)
  void trackAiUsage({
    feature,
    modelId: id,
    inputTokens,
    outputTokens,
    costUsd: costForUsedModel(id, inputTokens, outputTokens),
    sourceChannel: sourceChannelOf(attempt) as never,
  })
}

// ── Core: streaming over a chain（Chat 用） ───────────────────────────────────

export interface FallbackResult {
  stream: Awaited<ReturnType<typeof streamText>>
  usedModel: string
  usedVia: string
  attemptsCount: number
}

export async function streamWithFallback(
  rawChain: readonly Attempt[],
  params: ChatParams,
  imageInput?: { base64: string; mimeType: string },
): Promise<FallbackResult> {
  const chain = await resolveChainLive(rawChain)
  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  type MsgContent = string | Array<{ type: 'text'; text: string } | { type: 'image'; image: Uint8Array; mimeType: string }>
  const lastUserContent: MsgContent = imageInput
    ? [
        { type: 'text' as const, text: params.messages.at(-1)?.content ?? '' },
        { type: 'image' as const, image: new Uint8Array(Buffer.from(imageInput.base64, 'base64')), mimeType: imageInput.mimeType },
      ]
    : (params.messages.at(-1)?.content ?? '')

  const messagesWithImage = imageInput
    ? [...messages.slice(0, -1), { role: 'user' as const, content: lastUserContent }]
    : messages

  let lastError: unknown = new Error('No providers available')

  for (let i = 0; i < chain.length; i++) {
    const attempt = chain[i]
    try {
      const model: LanguageModel = buildModel(attempt)
      const stream = await streamText({
        model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messagesWithImage as any,
        maxOutputTokens: isClaude5(attempt) ? Math.max(params.maxTokens ?? 4096, 16000) : (params.maxTokens ?? 4096),
        abortSignal: AbortSignal.timeout(30000),
      })

      // streamText() 不等網路請求完成就回傳（它是懶串流）。像「model does not
      // exist」這種 provider 錯誤只會在消費 fullStream 時才冒出來，那時已經
      // 離開這個 try/catch，chain 就沒機會換下一個模型了。因此先偷看幾個
      // part：只偷看「第一個」曾經不夠——很多 provider 會先送 start/
      // start-step 之類的前導事件，真正的 error 是第二個 part 才出現，
      // 偷看一個會誤判成功、把還沒真正失敗的 attempt 提早回傳給呼叫端。
      // 因此持續偷看，直到遇到 error（此 attempt 失敗，換下一個），或遇到
      // 任何代表「模型真的開始輸出內容」的 part（視為成功，停止偷看），
      // 或串流自然結束（成功但空內容）。偷看到的 part 全部緩存，之後
      // 塞回重組出的串流最前面，保持順序與內容完整。
      const CONTENT_PART_TYPES = new Set([
        'text-delta', 'reasoning-delta', 'tool-call', 'tool-input-delta', 'source', 'file',
      ])
      const iterator = stream.fullStream[Symbol.asyncIterator]()
      const buffered: Array<Awaited<ReturnType<typeof iterator.next>>['value']> = []
      let peekError: unknown
      let exhausted = false
      // 安全上限：避免病態情況（一直送前導事件、不給內容也不給 error）無限等下去
      for (let p = 0; p < 50; p++) {
        const next = await iterator.next()
        if (next.done) { exhausted = true; break }
        buffered.push(next.value)
        if (next.value.type === 'error') { peekError = next.value.error; break }
        if (CONTENT_PART_TYPES.has(next.value.type)) break
      }
      if (peekError !== undefined) {
        throw peekError
      }

      async function* rebuiltFullStream() {
        for (const part of buffered) yield part
        if (exhausted) return
        while (true) {
          const next = await iterator.next()
          if (next.done) return
          yield next.value
        }
      }

      return {
        stream: { ...stream, fullStream: rebuiltFullStream() } as unknown as typeof stream,
        usedModel: attemptModelId(attempt),
        usedVia: attempt.via,
        attemptsCount: i + 1,
      }
    } catch (err) {
      lastError = err
      // 任何錯誤都換下一個（付費模型出錯不收費；免費通道常見 429/下架）
      console.warn(`[fallback:chat] ${attemptModelId(attempt)} failed:`, err instanceof Error ? err.message : err)
    }
  }

  throw lastError
}

export async function streamByChain(
  chainName: ChainName,
  params: ChatParams,
  imageInput?: { base64: string; mimeType: string },
): Promise<FallbackResult> {
  return streamWithFallback(FALLBACK_CHAINS[chainName], params, imageInput)
}

// ── Non-streaming: generateText over a chain ──────────────────────────────────

export interface GenerateFallbackResult<T> {
  result: T
  usedModel: string
  usedVia: Attempt['via']
  attemptsCount: number
}

export interface GenerateFallbackOptions {
  /** 回傳 false 時不再換模型（例如本次嘗試已執行過有副作用的工具），直接拋錯 */
  canFallback?: () => boolean
  /** 輸出品質驗證：回傳 false 視為失敗，換下一個模型（最後一個模型的輸出不驗證，直接回傳） */
  validate?: (text: string) => boolean
  /** 每次嘗試的逾時毫秒數 */
  timeoutMs?: number
  /** 有給就自動寫入 ai_feature_usage_daily */
  feature?: FeatureModule
}

/** 依鏈順序呼叫 generateText：通道未設定、已下架、出錯、空回應、驗證不過，都換下一個。 */
export async function generateTextWithFallback(
  rawChain: readonly Attempt[],
  args: Omit<Parameters<typeof generateText>[0], 'model'>,
  opts: GenerateFallbackOptions = {},
): Promise<GenerateFallbackResult<Awaited<ReturnType<typeof generateText>>>> {
  const chain = await resolveChainLive(rawChain)
  let lastError: unknown = new Error('No providers available')
  for (let i = 0; i < chain.length; i++) {
    const attempt = chain[i]
    const isLast = i === chain.length - 1
    let model: LanguageModel
    try {
      model = buildModel(attempt)
    } catch (err) {
      lastError = err // 未設定的通道直接跳過
      continue
    }
    try {
      const callArgs = prepareArgs(attempt, { ...args } as Record<string, unknown>)
      const result = await generateText({
        ...callArgs,
        model,
        abortSignal: args.abortSignal ?? AbortSignal.timeout(opts.timeoutMs ?? 60000),
      } as Parameters<typeof generateText>[0])
      const hasToolCalls = (result.steps ?? []).some(s => (s.toolCalls ?? []).length > 0)
      if (!result.text?.trim() && !hasToolCalls) throw new Error('empty response')
      if (opts.validate && !isLast && !hasToolCalls && !opts.validate(result.text)) {
        throw new Error(`output failed validation (${attemptModelId(attempt)})`)
      }
      track(opts.feature, attempt, result.usage)
      return { result, usedModel: attemptModelId(attempt), usedVia: attempt.via, attemptsCount: i + 1 }
    } catch (err) {
      lastError = err
      console.warn(`[fallback] ${attemptModelId(attempt)} failed:`, err instanceof Error ? err.message : err)
      if (opts.canFallback && !opts.canFallback()) throw err
    }
  }
  throw lastError
}

export function generateTextByChain(
  chainName: ChainName,
  args: Omit<Parameters<typeof generateText>[0], 'model'>,
  opts?: GenerateFallbackOptions,
) {
  return generateTextWithFallback(FALLBACK_CHAINS[chainName], args, opts)
}

/** 簡便版：單一 prompt → 文字。costUsd 依實際使用的模型計算（免費通道為 0）。 */
export async function generateSimple(
  chainName: ChainName,
  input: { system?: string; prompt: string; maxOutputTokens?: number; temperature?: number },
  opts?: GenerateFallbackOptions,
): Promise<{ text: string; usedModel: string; usedVia: Attempt['via']; inputTokens: number; outputTokens: number; costUsd: number }> {
  const { result, usedModel, usedVia } = await generateTextByChain(chainName, {
    system: input.system,
    messages: [{ role: 'user', content: input.prompt }],
    ...(input.maxOutputTokens ? { maxOutputTokens: input.maxOutputTokens } : {}),
    ...(input.temperature != null ? { temperature: input.temperature } : {}),
  }, opts)
  const usage = (result.usage ?? {}) as unknown as Record<string, number | undefined>
  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  return { text: result.text, usedModel, usedVia, inputTokens, outputTokens, costUsd: costForUsedModel(usedModel, inputTokens, outputTokens) }
}

/** 常用驗證：輸出含可解析的 JSON 物件/陣列 */
export function looksLikeJson(text: string): boolean {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = t.search(/[[{]/)
  if (start < 0) return false
  const open = t[start]
  const end = t.lastIndexOf(open === '{' ? '}' : ']')
  if (end <= start) return false
  try { JSON.parse(t.slice(start, end + 1)); return true } catch { return false }
}

/**
 * generateText 的替代品：照鏈順序嘗試，回傳原本的 generateText 結果，並附上實際使用的模型與成本。
 */
export async function chainText(
  chainName: ChainName,
  args: Omit<Parameters<typeof generateText>[0], 'model'>,
  opts?: GenerateFallbackOptions,
) {
  const r = await generateTextByChain(chainName, args, opts)
  const u = (r.result.usage ?? {}) as unknown as Record<string, number | undefined>
  return Object.assign(r.result, {
    usedModel: r.usedModel,
    usedVia: r.usedVia,
    costUsd: costForUsedModel(r.usedModel, u.inputTokens ?? 0, u.outputTokens ?? 0),
  })
}

/**
 * streamText 的鏈式版本：逐一嘗試，偷看到第一段內容才算成功（錯誤在串流開頭才會出現）。
 */
export async function streamTextByChain(
  chainName: ChainName,
  args: Omit<Parameters<typeof streamText>[0], 'model'>,
  opts: { timeoutMs?: number } = {},
) {
  const chain = await resolveChainLive(FALLBACK_CHAINS[chainName])
  let lastError: unknown = new Error('No providers available')
  for (const attempt of chain) {
    let model: LanguageModel
    try { model = buildModel(attempt) } catch (err) { lastError = err; continue }
    try {
      const callArgs = prepareArgs(attempt, { ...args } as Record<string, unknown>)
      if (isClaude5(attempt)) callArgs.maxOutputTokens = Math.max(Number(callArgs.maxOutputTokens ?? 0), 16000)
      const stream = streamText({
        ...callArgs,
        model,
        abortSignal: args.abortSignal ?? AbortSignal.timeout(opts.timeoutMs ?? 120000),
      } as Parameters<typeof streamText>[0])
      const iterator = stream.fullStream[Symbol.asyncIterator]()
      const buffered: Array<Awaited<ReturnType<typeof iterator.next>>['value']> = []
      let exhausted = false
      for (let p = 0; p < 50; p++) {
        const next = await iterator.next()
        if (next.done) { exhausted = true; break }
        buffered.push(next.value)
        if (next.value.type === 'error') throw next.value.error
        if (next.value.type === 'text-delta') break
      }
      if (exhausted && !buffered.some(b => b.type === 'text-delta')) throw new Error('empty response')

      async function* fullStream() {
        for (const part of buffered) yield part
        if (exhausted) return
        while (true) {
          const next = await iterator.next()
          if (next.done) return
          yield next.value
        }
      }
      const parts = fullStream()
      async function* textStream() {
        for await (const part of parts) {
          if (part.type === 'text-delta') yield part.text
          else if (part.type === 'error') throw part.error
        }
      }
      return {
        fullStream: parts,
        textStream: textStream(),
        usage: stream.usage,
        usedModel: attemptModelId(attempt),
        usedVia: attempt.via,
      }
    } catch (err) {
      lastError = err
      console.warn(`[fallback:stream] ${attemptModelId(attempt)} failed:`, err instanceof Error ? err.message : err)
    }
  }
  throw lastError
}

// ── 鏈式 LanguageModel：給只能接受單一模型的地方用（generateText / streamText 皆可） ──

type V3Model = Extract<LanguageModel, { specificationVersion: 'v3' }>

/**
 * 把一條鏈包成單一 LanguageModel：doGenerate / doStream 依序嘗試，出錯就換下一個。
 * 串流會先偷看到第一段文字或工具呼叫才算成功。onUsed 會告知實際使用的模型（可用來記錄用量）。
 */
export function createChainModel(chain: readonly Attempt[], onUsed?: (attempt: Attempt) => void): V3Model {
  const label = chain.map(attemptModelId).join(' → ')

  async function models() {
    const out: { attempt: Attempt; model: V3Model }[] = []
    for (const attempt of await resolveChainLive(chain)) {
      try { out.push({ attempt, model: buildModel(attempt) as V3Model }) } catch { /* 未設定的通道略過 */ }
    }
    if (!out.length) throw new Error(`沒有可用的 AI 通道（${label}）`)
    return out
  }

  return {
    specificationVersion: 'v3',
    provider: 'chain',
    modelId: label,
    supportedUrls: {},
    async doGenerate(options) {
      let lastError: unknown
      for (const { attempt, model } of await models()) {
        try {
          const res = await model.doGenerate(prepareArgs(attempt, options as unknown as Record<string, unknown>) as unknown as typeof options)
          const hasContent = res.content.some(c => (c.type === 'text' && c.text.trim()) || c.type === 'tool-call')
          if (!hasContent) throw new Error('empty response')
          onUsed?.(attempt)
          return res
        } catch (err) {
          lastError = err
          console.warn(`[chain-model] ${attemptModelId(attempt)} failed:`, err instanceof Error ? err.message : err)
        }
      }
      throw lastError
    },
    async doStream(options) {
      let lastError: unknown
      for (const { attempt, model } of await models()) {
        try {
          const res = await model.doStream(prepareArgs(attempt, options as unknown as Record<string, unknown>) as unknown as typeof options)
          const reader = res.stream.getReader()
          const buffered: unknown[] = []
          let done = false
          for (let p = 0; p < 50; p++) {
            const next = await reader.read()
            if (next.done) { done = true; break }
            const part = next.value as { type: string; error?: unknown }
            if (part.type === 'error') throw part.error
            buffered.push(next.value)
            if (part.type === 'text-delta' || part.type === 'tool-call' || part.type === 'tool-input-start') break
          }
          if (done && !buffered.some(b => ['text-delta', 'tool-call'].includes((b as { type: string }).type))) {
            throw new Error('empty response')
          }
          onUsed?.(attempt)
          const stream = new ReadableStream({
            async start(controller) {
              for (const b of buffered) controller.enqueue(b)
              if (done) { controller.close(); return }
              try {
                while (true) {
                  const next = await reader.read()
                  if (next.done) break
                  controller.enqueue(next.value)
                }
                controller.close()
              } catch (e) {
                controller.error(e)
              }
            },
          })
          return { ...res, stream } as typeof res
        } catch (err) {
          lastError = err
          console.warn(`[chain-model:stream] ${attemptModelId(attempt)} failed:`, err instanceof Error ? err.message : err)
        }
      }
      throw lastError
    },
  }
}
