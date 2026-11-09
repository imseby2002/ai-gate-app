/**
 * Proxy Fallback Router
 *
 * Priority: CLI Proxy (free Copilot/Kiro/Grok) → FreeLLMAPI (12 platforms) → Direct paid API
 * Rate-limited (429) and unavailable providers are skipped instantly (no timeout wait).
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

// ── Attempt descriptor ────────────────────────────────────────────────────────

export type Attempt =
  | { via: 'cli-proxy'; model: string }
  | { via: 'free-llm';  model: string }
  | { via: 'direct';    provider: 'deepseek' | 'google' | 'anthropic' | 'groq'; model: string }

// ── Chain definitions (ordered: cheapest/free first) ──────────────────────────
//
// 費用排序（每百萬 tokens，輸入/輸出）：
//   免費：CLIProxy（Copilot/Kiro/Grok）、FreeLLM、Groq
//   Claude Haiku 5.5 $0.10/$0.50（Anthropic 官方價；輸入 >100K 時 $0.50/$2.50）
//   DeepSeek $0.27/$1.10、Gemini 2.5 Flash $0.30/$2.50（見 marketing/billing.ts）
//   Claude Sonnet 5.5 $2/$10（Anthropic 官方價）
// 免費模型輸出未通過驗證時會自動換下一層，見 generateTextWithFallback 的 validate。

const HAIKU: Attempt  = { via: 'direct', provider: 'anthropic', model: 'claude-haiku-5-5' }
const SONNET: Attempt = { via: 'direct', provider: 'anthropic', model: 'claude-sonnet-5-5' }

export const FALLBACK_CHAINS = {
  /** General chat — fast, daily questions */
  daily: [
    { via: 'direct',    provider: 'groq',     model: 'groq-llama-3.3-70b' },
    { via: 'free-llm',  model: 'llama-3.3-70b'     },
    { via: 'free-llm',  model: 'glm-4.7-flash'     },
    { via: 'free-llm',  model: 'qwen3-32b'         },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'cli-proxy', model: 'gpt-5.4-mini'      },
    HAIKU,
  ],

  /** Creative writing, marketing copy (chat) */
  creative: [
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'cli-proxy', model: 'kimi-k2'           },
    { via: 'cli-proxy', model: 'gpt-5.4-mini'      },
    { via: 'free-llm',  model: 'auto'              },
    HAIKU,
  ],

  /** Financial calculations, math, reasoning */
  finance: [
    { via: 'cli-proxy', model: 'deepseek-chat'     },
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    { via: 'cli-proxy', model: 'grok-3-mini'       },
    { via: 'free-llm',  model: 'auto'              },
    HAIKU,
    { via: 'direct',    provider: 'deepseek', model: 'deepseek-chat' },
  ],

  /** Deep analysis, research, comparison */
  analysis: [
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'cli-proxy', model: 'gpt-5.5'           },
    { via: 'free-llm',  model: 'auto'              },
    HAIKU,
    SONNET,
  ],

  /** Legal / regulatory questions — Perplexity handled separately (needs web) */
  legal: [
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'cli-proxy', model: 'gpt-5.5'           },
    { via: 'free-llm',  model: 'auto'              },
    HAIKU,
    SONNET,
  ],

  /** CS customer service — high volume, FreeLLMAPI first to save CLI Proxy quota */
  cs: [
    { via: 'free-llm',  model: 'auto'              },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    HAIKU,
    { via: 'direct',    provider: 'google',   model: 'gemini-2.5-flash' },
  ],

  /** A 組：客服高風險（退款、投訴、法律）— 重要情境只用 Claude */
  cs_highrisk: [SONNET],

  /** A 組：重要且只用 Claude 的情境（Agent 任務計畫書等） */
  premium: [SONNET],

  /** B 組：工具呼叫 / 程式碼（Agent、autofix、skills） */
  tools: [
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'cli-proxy', model: 'gpt-5.5'           },
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'free-llm',  model: 'auto'              },
    HAIKU,
    SONNET,
  ],

  /** Code generation (chat 的 coding 意圖) — 同 B 組 */
  coding: [
    { via: 'cli-proxy', model: 'gpt-5.5'           },
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    HAIKU,
    SONNET,
  ],

  /** C 組：結構化擷取（JSON 輸出，請搭配 validate） */
  extraction: [
    { via: 'free-llm',  model: 'auto'              },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'cli-proxy', model: 'gpt-5.4-mini'      },
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    HAIKU,
    { via: 'direct',    provider: 'deepseek', model: 'deepseek-chat' },
  ],

  /** D 組：內容生成（行銷文案、腳本、文章、報告、摘要） */
  content: [
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'cli-proxy', model: 'gpt-5.5'           },
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    { via: 'free-llm',  model: 'auto'              },
    HAIKU,
    SONNET,
  ],

  /** E 組：翻譯 */
  translate: [
    { via: 'free-llm',  model: 'auto'              },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'cli-proxy', model: 'gpt-5.4-mini'      },
    HAIKU,
  ],

  /** F 組：圖片辨識（只放支援圖片輸入的模型） */
  vision: [
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    HAIKU,
    SONNET,
  ],

  /** 舊名稱相容：agent = tools */
  agent: [
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'cli-proxy', model: 'gpt-5.5'           },
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'free-llm',  model: 'auto'              },
    HAIKU,
    SONNET,
  ],
} as const satisfies Record<string, readonly Attempt[]>

export type ChainName = keyof typeof FALLBACK_CHAINS

// ── Provider builder ───────────────────────────────────────────────────────────

export function buildModel(attempt: Attempt) {
  switch (attempt.via) {
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

// ── Core: try each attempt in the chain ───────────────────────────────────────

export interface FallbackResult {
  stream: Awaited<ReturnType<typeof streamText>>
  usedModel: string
  usedVia: string
  attemptsCount: number
}

export async function streamWithFallback(
  chain: readonly Attempt[],
  params: ChatParams,
  imageInput?: { base64: string; mimeType: string },
): Promise<FallbackResult> {
  const messages = params.systemPrompt
    ? [{ role: 'system' as const, content: params.systemPrompt }, ...params.messages]
    : params.messages

  // Build multimodal user message if image provided
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
        maxOutputTokens: params.maxTokens ?? 4096,
        abortSignal: AbortSignal.timeout(30000), // 30s per attempt
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
        // fullStream 實際型別是包著 ReadableStream 介面的 AsyncIterableStream，
        // 這裡重組出來的是純 AsyncGenerator——結構不完全相容，但呼叫端
        // （route.ts）只用 for-await 消費它，執行期相容即可，故經 unknown 轉型。
        stream: { ...stream, fullStream: rebuiltFullStream() } as unknown as typeof stream,
        usedModel: attempt.via === 'direct' ? attempt.model : `${attempt.via}:${attempt.model}`,
        usedVia: attempt.via,
        attemptsCount: i + 1,
      }
    } catch (err) {
      lastError = err
      if (!isRetryable(err)) throw err  // Non-retryable → stop immediately
      // Retryable (429, 503, model 不存在/無權限等) → 試下一個
    }
  }

  throw lastError
}

// ── Convenience: chain name → streamWithFallback ──────────────────────────────

export async function streamByChain(
  chainName: ChainName,
  params: ChatParams,
  imageInput?: { base64: string; mimeType: string },
): Promise<FallbackResult> {
  const chain = FALLBACK_CHAINS[chainName]
  return streamWithFallback(chain, params, imageInput)
}

// ── Non-streaming: generateText over a chain ──────────────────────────────────

export function attemptModelId(attempt: Attempt): string {
  return attempt.via === 'direct' ? attempt.model : `${attempt.via}:${attempt.model}`
}

// Claude 5.x（Haiku 5.5 / Sonnet 5.5 / Opus 5.5）：非預設的 temperature/topP/topK 會回 400；
// AI SDK 不認得新型號時預設 max_tokens 只有 4096（含 thinking），需要明確給上限。
function isClaude5(attempt: Attempt) {
  return attempt.via === 'direct' && attempt.provider === 'anthropic' && /^claude-(haiku|sonnet|opus|fable)-5/.test(attempt.model)
}

function sourceChannelOf(attempt: Attempt): 'cliproxy' | 'freellm' | 'groq' | 'anthropic' | 'google' | 'deepseek' {
  if (attempt.via === 'cli-proxy') return 'cliproxy'
  if (attempt.via === 'free-llm') return 'freellm'
  return attempt.provider
}

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

/**
 * 依鏈順序呼叫 generateText：通道未設定、出錯、空回應、驗證不過，都換下一個。
 */
export async function generateTextWithFallback(
  chain: readonly Attempt[],
  args: Omit<Parameters<typeof generateText>[0], 'model'>,
  opts: GenerateFallbackOptions = {},
): Promise<GenerateFallbackResult<Awaited<ReturnType<typeof generateText>>>> {
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
    const callArgs = { ...args } as Record<string, unknown>
    if (isClaude5(attempt)) {
      delete callArgs.temperature
      delete callArgs.topP
      delete callArgs.topK
      if (callArgs.maxOutputTokens == null) callArgs.maxOutputTokens = 16000
      // Claude 5.x 預設開啟 thinking，thinking 也算在 max_tokens 內；上限太小會只剩思考、沒有答案
      else if (Number(callArgs.maxOutputTokens) < 2000) callArgs.maxOutputTokens = 2000
    }
    try {
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
      if (opts.feature) {
        const usage = (result.usage ?? {}) as unknown as Record<string, number | undefined>
        void trackAiUsage({
          feature: opts.feature,
          modelId: attemptModelId(attempt),
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          sourceChannel: sourceChannelOf(attempt),
        })
      }
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

/** 簡便版：單一 prompt → 文字。只有付費直連才回傳 > 0 的 costUsd。 */
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
  const costUsd = usedVia === 'direct' ? directCostUsd(usedModel, inputTokens, outputTokens) : 0
  return { text: result.text, usedModel, usedVia, inputTokens, outputTokens, costUsd }
}

/** 付費直連模型價格（USD / 百萬 tokens）。Claude 為 Anthropic 官方價，其餘取自 marketing/billing.ts */
export const DIRECT_PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5':  { input: 0.1,  output: 0.5 },
  'claude-sonnet-5-5': { input: 2,    output: 10 },
  'claude-opus-5-5':   { input: 4,    output: 20 },
  'deepseek-chat':     { input: 0.27, output: 1.1 },
  'gemini-2.5-flash':  { input: 0.3,  output: 2.5 },
}

export function directCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = DIRECT_PRICES[model]
  if (!p) return 0
  // Haiku 5.5 單次輸入超過 100K tokens 時改用較高單價
  if (model === 'claude-haiku-5-5' && inputTokens > 100_000) {
    return (inputTokens * 0.5 + outputTokens * 2.5) / 1_000_000
  }
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
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
