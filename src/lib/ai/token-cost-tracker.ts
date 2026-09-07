/**
 * AI Token & Cost Tracker
 *
 * Provides accurate multi-provider token cost calculations, source channel attribution,
 * and commercial value savings estimates for free proxies (CLIProxy, FreeLLM, Groq),
 * distinguishing direct vendor APIs (Google, Anthropic, OpenAI, DeepSeek) from OpenRouter and proxies.
 */

export type SourceChannel =
  | 'google'
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'openrouter'
  | 'cliproxy'
  | 'freellm'
  | 'groq'

export interface ChannelInfo {
  channel: SourceChannel
  label: string
  subLabel: string
  isFree: boolean
  badgeColor: string
  borderColor: string
  bgColor: string
}

export const CHANNEL_CONFIG: Record<SourceChannel, ChannelInfo> = {
  cliproxy: {
    channel: 'cliproxy',
    label: 'CLIProxy 代理',
    subLabel: 'Copilot / Kiro / Grok 免費通道',
    isFree: true,
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    borderColor: 'border-blue-300 dark:border-blue-800',
    bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
  },
  freellm: {
    channel: 'freellm',
    label: 'FreeLLM 代理',
    subLabel: '12 平台聚合免費通道',
    isFree: true,
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    borderColor: 'border-emerald-300 dark:border-emerald-800',
    bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/20',
  },
  groq: {
    channel: 'groq',
    label: 'Groq 官方免費',
    subLabel: 'Groq Cloud 免費推論層',
    isFree: true,
    badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    borderColor: 'border-cyan-300 dark:border-cyan-800',
    bgColor: 'bg-cyan-50/50 dark:bg-cyan-950/20',
  },
  google: {
    channel: 'google',
    label: 'Google 原廠直連',
    subLabel: 'Google AI Studio / Gemini 官方 API',
    isFree: false,
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    borderColor: 'border-rose-300 dark:border-rose-800',
    bgColor: 'bg-rose-50/50 dark:bg-rose-950/20',
  },
  anthropic: {
    channel: 'anthropic',
    label: 'Claude 原廠直連',
    subLabel: 'Anthropic 官方原廠 API',
    isFree: false,
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    borderColor: 'border-orange-300 dark:border-orange-800',
    bgColor: 'bg-orange-50/50 dark:bg-orange-950/20',
  },
  openai: {
    channel: 'openai',
    label: 'OpenAI 原廠直連',
    subLabel: 'OpenAI 官方原廠 API',
    isFree: false,
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    borderColor: 'border-emerald-300 dark:border-emerald-800',
    bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/20',
  },
  deepseek: {
    channel: 'deepseek',
    label: 'DeepSeek 原廠直連',
    subLabel: 'DeepSeek 官方原廠 API',
    isFree: false,
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    borderColor: 'border-indigo-300 dark:border-indigo-800',
    bgColor: 'bg-indigo-50/50 dark:bg-indigo-950/20',
  },
  openrouter: {
    channel: 'openrouter',
    label: 'OpenRouter 聚合平台',
    subLabel: 'OpenRouter 轉發加成計費',
    isFree: false,
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    borderColor: 'border-purple-300 dark:border-purple-800',
    bgColor: 'bg-purple-50/50 dark:bg-purple-950/20',
  },
}

// Commercial rates for calculating money saved by using FreeLLM & CLIProxy (per 1k tokens)
const COMMERCIAL_BENCHMARK_RATES: Record<string, { in: number; out: number }> = {
  'gemini-3-flash':             { in: 0.000075, out: 0.0003  },
  'gpt-5.4-mini':               { in: 0.00015,  out: 0.0006  },
  'gpt-5.5':                    { in: 0.0025,   out: 0.010   },
  'kimi-k2':                    { in: 0.0008,   out: 0.0016  },
  'kimi-k2.5':                  { in: 0.001,    out: 0.002   },
  'grok-3-mini':                { in: 0.0005,   out: 0.0015  },
  'gemini-2.5-pro':             { in: 0.00125,  out: 0.005   },
  'llama-3.3-70b':              { in: 0.0006,   out: 0.0018  },
  'glm-4.7-flash':              { in: 0.0001,   out: 0.0001  },
  'qwen3-32b':                  { in: 0.0004,   out: 0.0012  },
  'auto':                       { in: 0.0005,   out: 0.0015  },
}

// Direct commercial API rates (per 1k tokens) by model
const MODEL_PRICING_TABLE: Record<string, { in: number; out: number }> = {
  // Google
  'gemini-2.5-pro':             { in: 0.00125,  out: 0.005    },
  'gemini-2.5-flash':           { in: 0.000075, out: 0.0003   },
  'gemini-2.0-flash':           { in: 0.000075, out: 0.0003   },
  'gemini-2.0-flash-thinking':  { in: 0.000075, out: 0.0003   },
  'gemini-3.0-flash':           { in: 0.000075, out: 0.0003   },
  'gemini-2.0-flash-vision':    { in: 0.00125,  out: 0.00375  },

  // Anthropic Direct
  'claude-sonnet-4-6':          { in: 0.003,    out: 0.015    },
  'claude-sonnet-4-5':          { in: 0.003,    out: 0.015    },
  'claude-3-7-sonnet':          { in: 0.003,    out: 0.015    },
  'claude-opus-4-8':            { in: 0.015,    out: 0.075    },
  'claude-opus-4-5':            { in: 0.015,    out: 0.075    },
  'claude-3-opus':              { in: 0.015,    out: 0.075    },
  'claude-haiku-4-5-20251001':  { in: 0.001,    out: 0.005    },

  // OpenAI Direct
  'gpt-4o':                     { in: 0.0025,   out: 0.010    },
  'gpt-5':                      { in: 0.0025,   out: 0.010    },
  'gpt-4o-mini':                { in: 0.00015,  out: 0.0006   },
  'o1':                         { in: 0.015,    out: 0.060    },
  'o3-mini':                    { in: 0.0011,   out: 0.0044   },

  // DeepSeek Direct
  'deepseek-chat':              { in: 0.00014,  out: 0.00028  },
  'deepseek-reasoner':          { in: 0.00055,  out: 0.00219  },

  // OpenRouter (with platform routing rate)
  'or-gpt-4o-mini':             { in: 0.00015,  out: 0.0006   },
  'openrouter/anthropic/claude-sonnet-4-6': { in: 0.0033, out: 0.0165 },
  'openrouter/openai/gpt-4o':   { in: 0.00275,  out: 0.011    },

  // Perplexity
  'perplexity-sonar-pro':       { in: 0.001,    out: 0.001    },
}

// Display names for models across providers
const MODEL_NAME_MAP: Record<string, string> = {
  'gemini-2.5-pro':             'Gemini 2.5 Pro',
  'gemini-2.5-flash':           'Gemini 2.5 Flash',
  'gemini-2.0-flash':           'Gemini 2.0 Flash',
  'gemini-2.0-flash-thinking':  'Gemini Flash Thinking',
  'gemini-3.0-flash':           'Gemini 3.0 Flash',
  'gemini-2.0-flash-vision':    'Gemini Vision (OCR)',
  'claude-sonnet-4-6':          'Claude 3.7 Sonnet',
  'claude-sonnet-4-5':          'Claude Sonnet 4.5',
  'claude-opus-4-8':            'Claude 3.7 Opus',
  'claude-opus-4-5':            'Claude Opus 4.5',
  'claude-haiku-4-5-20251001':  'Claude Haiku 4.5',
  'gpt-4o':                     'GPT-4o',
  'gpt-5':                      'GPT-5 (GPT-4o 強化版)',
  'gpt-4o-mini':                'GPT-4o Mini',
  'deepseek-chat':              'DeepSeek V3',
  'deepseek-reasoner':          'DeepSeek R1',
  'or-gpt-4o-mini':             'GPT-4o Mini (OpenRouter)',
  'perplexity-sonar-pro':       'Perplexity Sonar Pro',
  'groq-auto':                  'Groq Auto（自動選擇）',
  'groq-llama-3.3-70b':         'Groq Llama 3.3 70B',
  'groq-qwen3-32b':             'Groq Qwen 3 32B',
  'groq-deepseek-r1':           'Groq DeepSeek-R1 (70B)',
  'groq-qwq-32b':               'Groq QwQ 32B',
  'groq-llama-3.1-8b':          'Groq Llama 3.1 8B',
  'groq-gpt-oss-20b':           'Groq GPT-OSS 20B',
  'llama-3.3-70b':              'Llama 3.3 70B',
  'glm-4.7-flash':              'GLM 4.7 Flash',
  'qwen3-32b':                  'Qwen 3 32B',
  'kimi-k2':                    'Kimi K2 (Moonshot)',
  'kimi-k2.5':                  'Kimi K2.5 (Moonshot)',
  'gpt-5.4-mini':               'GPT-5.4 Mini',
  'gpt-5.5':                    'GPT-5.5 (Frontier)',
  'grok-3-mini':                'Grok 3 Mini',
  'gemini-3-flash':             'Gemini 3 Flash',
}

/**
 * Accurately estimate token count from text
 * CJK characters ~= 1.5 tokens; Latin characters ~= 0.35 tokens
 */
export function estimateTextTokens(text?: string | null): number {
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fa5\u3040-\u30ff]/g) || []).length
  const nonCjk = text.length - cjk
  return Math.round(cjk * 1.5 + nonCjk * 0.35)
}

/**
 * Determine the exact source channel from model ID or explicit parameters
 */
export function detectSourceChannel(rawModelId: string, explicitVia?: string): SourceChannel {
  if (explicitVia === 'cliproxy' || explicitVia === 'cli-proxy') return 'cliproxy'
  if (explicitVia === 'freellm' || explicitVia === 'free-llm') return 'freellm'
  if (explicitVia === 'groq') return 'groq'
  if (explicitVia === 'openrouter') return 'openrouter'

  const lower = (rawModelId || '').toLowerCase()

  // Free proxies
  if (lower.includes('cli-proxy') || lower.includes('cliproxy') || lower.startsWith('proxy:cli-proxy')) {
    return 'cliproxy'
  }
  if (lower.includes('free-llm') || lower.includes('freellm') || lower.startsWith('proxy:free-llm')) {
    return 'freellm'
  }
  if (lower.startsWith('groq-') || lower === 'groq') {
    return 'groq'
  }

  // OpenRouter
  if (lower.startsWith('or-') || lower.startsWith('openrouter/')) {
    return 'openrouter'
  }

  // Known proxy-only models
  const cliProxyOnly = ['kimi-k2', 'kimi-k2.5', 'gpt-5.4-mini', 'gpt-5.5', 'grok-3-mini']
  if (cliProxyOnly.some(m => lower === m || lower.endsWith(`:${m}`))) {
    return 'cliproxy'
  }
  const freeLlmOnly = ['glm-4.7-flash']
  if (freeLlmOnly.some(m => lower === m || lower.endsWith(`:${m}`))) {
    return 'freellm'
  }

  // Direct vendors
  if (lower.startsWith('anthropic/') || lower.includes('claude')) {
    return 'anthropic'
  }
  if (lower.startsWith('google/') || lower.includes('gemini')) {
    return 'google'
  }
  if (lower.startsWith('openai/') || lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3')) {
    return 'openai'
  }
  if (lower.startsWith('deepseek')) {
    return 'deepseek'
  }

  return 'google'
}

/**
 * Extract clean model identifier without vendor/proxy prefixes
 */
export function cleanModelId(rawModelId: string): string {
  let id = rawModelId || ''
  if (id.startsWith('proxy:')) id = id.slice(6)
  if (id.startsWith('cli-proxy:')) id = id.slice(10)
  if (id.startsWith('free-llm:')) id = id.slice(9)
  if (id.startsWith('cliproxy:')) id = id.slice(9)
  if (id.startsWith('freellm:')) id = id.slice(8)
  if (id.startsWith('anthropic/')) id = id.slice(10)
  if (id.startsWith('openai/')) id = id.slice(7)
  if (id.startsWith('google/')) id = id.slice(7)
  if (id.startsWith('openrouter/')) id = id.slice(11)
  return id
}

/**
 * Get friendly display name for model
 */
export function getModelDisplayName(rawModelId: string, channel: SourceChannel): string {
  const cleanId = cleanModelId(rawModelId)
  const baseName = MODEL_NAME_MAP[cleanId] ?? cleanId

  if (channel === 'cliproxy' && !baseName.includes('CLIProxy')) {
    return `${baseName} (CLIProxy 免費)`
  }
  if (channel === 'freellm' && !baseName.includes('FreeLLM')) {
    return `${baseName} (FreeLLM 免費)`
  }
  if (channel === 'openrouter' && !baseName.includes('OpenRouter')) {
    return `${baseName} (OpenRouter)`
  }
  return baseName
}

/**
 * Calculate actual cost and commercial savings
 */
export function calculateModelCosts(
  rawModelId: string,
  inputTokens: number,
  outputTokens: number,
  explicitChannel?: SourceChannel
): { actualCostUsd: number; actualCostTwd: number; savedCostUsd: number; savedCostTwd: number; isFree: boolean; channel: SourceChannel } {
  const channel = explicitChannel ?? detectSourceChannel(rawModelId)
  const cleanId = cleanModelId(rawModelId)
  const USD_TO_TWD = 32.0

  if (channel === 'cliproxy' || channel === 'freellm') {
    const rate = COMMERCIAL_BENCHMARK_RATES[cleanId] ?? { in: 0.0005, out: 0.0015 }
    const savedUsd = (inputTokens / 1000) * rate.in + (outputTokens / 1000) * rate.out
    return {
      actualCostUsd: 0,
      actualCostTwd: 0,
      savedCostUsd: Number(savedUsd.toFixed(6)),
      savedCostTwd: Number((savedUsd * USD_TO_TWD).toFixed(2)),
      isFree: true,
      channel,
    }
  }

  if (channel === 'groq') {
    return {
      actualCostUsd: 0,
      actualCostTwd: 0,
      savedCostUsd: 0,
      savedCostTwd: 0,
      isFree: true,
      channel,
    }
  }

  // Commercial APIs (Google, Anthropic, OpenAI, DeepSeek, OpenRouter)
  let rate = MODEL_PRICING_TABLE[cleanId]
  if (!rate) {
    if (channel === 'anthropic') rate = { in: 0.003, out: 0.015 }
    else if (channel === 'openai') rate = { in: 0.0025, out: 0.010 }
    else if (channel === 'google') rate = { in: 0.000075, out: 0.0003 }
    else if (channel === 'deepseek') rate = { in: 0.00014, out: 0.00028 }
    else rate = { in: 0.0005, out: 0.0015 }
  }

  const actualUsd = (inputTokens / 1000) * rate.in + (outputTokens / 1000) * rate.out
  return {
    actualCostUsd: Number(actualUsd.toFixed(6)),
    actualCostTwd: Number((actualUsd * USD_TO_TWD).toFixed(2)),
    savedCostUsd: 0,
    savedCostTwd: 0,
    isFree: false,
    channel,
  }
}
