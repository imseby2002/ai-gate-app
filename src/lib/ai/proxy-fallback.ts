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
import { streamText } from 'ai'
import type { LanguageModel } from 'ai'
import type { ChatParams } from './providers/cli-proxy'

// ── Attempt descriptor ────────────────────────────────────────────────────────

type Attempt =
  | { via: 'cli-proxy'; model: string }
  | { via: 'free-llm';  model: string }
  | { via: 'direct';    provider: 'deepseek' | 'google' | 'anthropic' | 'groq'; model: string }

// ── Chain definitions (ordered: cheapest/free first) ──────────────────────────

export const FALLBACK_CHAINS = {
  /** General chat — fast, daily questions */
  daily: [
    { via: 'direct',    provider: 'groq',     model: 'groq-llama-3.3-70b' },
    { via: 'free-llm',  model: 'llama-3.3-70b'     },
    { via: 'free-llm',  model: 'glm-4.7-flash'     },
    { via: 'free-llm',  model: 'qwen3-32b'         },
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'cli-proxy', model: 'gpt-5.4-mini'      },
  ],

  /** Creative writing, marketing copy */
  creative: [
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'cli-proxy', model: 'kimi-k2'           },
    { via: 'cli-proxy', model: 'gpt-5.4-mini'      },
    { via: 'free-llm',  model: 'auto'              },
    { via: 'direct',    provider: 'google',   model: 'gemini-3.0-flash' },
  ],

  /** Financial calculations, math, reasoning */
  finance: [
    { via: 'cli-proxy', model: 'deepseek-chat'     },  // Your DeepSeek key via proxy
    { via: 'cli-proxy', model: 'kimi-k2.5'         },  // Kiro free, good at math
    { via: 'cli-proxy', model: 'grok-3-mini'       },  // Grok free
    { via: 'free-llm',  model: 'auto'              },
    { via: 'direct',    provider: 'deepseek', model: 'deepseek-chat' },
  ],

  /** Deep analysis, research, comparison */
  analysis: [
    { via: 'cli-proxy', model: 'kimi-k2.5'         },  // Kiro free, strong reasoning
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },  // Copilot free, capable
    { via: 'cli-proxy', model: 'gpt-5.5'           },  // Copilot free
    { via: 'free-llm',  model: 'auto'              },
    { via: 'direct',    provider: 'anthropic', model: 'claude-sonnet-4-6' },
  ],

  /** Legal / regulatory questions — Perplexity handled separately (needs web) */
  legal: [
    { via: 'cli-proxy', model: 'kimi-k2.5'         },
    { via: 'cli-proxy', model: 'gemini-2.5-pro'    },
    { via: 'free-llm',  model: 'auto'              },
    { via: 'direct',    provider: 'anthropic', model: 'claude-sonnet-4-6' },
  ],

  /** CS customer service — high volume, FreeLLMAPI first to save CLI Proxy quota */
  cs: [
    { via: 'free-llm',  model: 'auto'              },  // 12 platforms, high volume
    { via: 'cli-proxy', model: 'gemini-3-flash'    },
    { via: 'direct',    provider: 'google',   model: 'gemini-2.5-flash' },
  ],

  /** CS high-risk (complaints, refunds) — always Sonnet */
  cs_highrisk: [
    { via: 'direct', provider: 'anthropic', model: 'claude-sonnet-4-6' },
  ],

  /** Data extraction (email sync, OTA import) — speed + precision */
  extraction: [
    { via: 'free-llm',  model: 'auto'              },
    { via: 'direct',    provider: 'deepseek', model: 'deepseek-chat' },
    { via: 'direct',    provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  ],

  /** Code generation (feedback system) — quality critical */
  coding: [
    { via: 'direct', provider: 'anthropic', model: 'claude-sonnet-4-6' },
  ],
} as const satisfies Record<string, Attempt[]>

export type ChainName = keyof typeof FALLBACK_CHAINS

// ── Provider builder ───────────────────────────────────────────────────────────

function buildModel(attempt: Attempt) {
  switch (attempt.via) {
    case 'cli-proxy': {
      const baseURL = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
      const apiKey  = process.env.CLI_PROXY_API_KEY ?? 'no-key'
      if (!baseURL) throw new Error('CLI_PROXY_API_URL not set')
      return createOpenAI({ apiKey, baseURL }).chat(attempt.model)
    }
    case 'free-llm': {
      const baseURL = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
      const apiKey  = process.env.FREE_LLM_API_KEY ?? 'no-key'
      if (!baseURL || !apiKey) throw new Error('FREE_LLM not configured')
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
        const key = process.env.GOOGLE_AI_API_KEY
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
        // Extract base model name without "groq-" prefix if present
        const realModel = attempt.model.replace(/^groq-/, '')
        return createGroq({ apiKey: key })(realModel)
      }
      throw new Error(`Unknown direct provider: ${(attempt as { provider: string }).provider}`)
    }
  }
}

// ── Is this error retryable? ───────────────────────────────────────────────────

function isRetryable(err: unknown): boolean {
  const msg = String(err).toLowerCase()
  // 429 rate limit, 503 unavailable, network errors, model not found
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('model_not_found') ||
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
      return {
        stream,
        usedModel: attempt.via === 'direct' ? attempt.model : `${attempt.via}:${attempt.model}`,
        usedVia: attempt.via,
        attemptsCount: i + 1,
      }
    } catch (err) {
      lastError = err
      if (!isRetryable(err)) throw err  // Non-retryable → stop immediately
      // Retryable (429, 503) → try next
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
