/**
 * AI Token & Cost Tracker
 *
 * Provides accurate token cost calculations, source channel attribution,
 * and commercial value savings estimates for free proxies (CLIProxy, FreeLLM, Groq).
 */

export type SourceChannel = 'cliproxy' | 'freellm' | 'groq' | 'direct'

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
    label: 'Groq 官方',
    subLabel: 'Groq Cloud 免費推論層',
    isFree: true,
    badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    borderColor: 'border-cyan-300 dark:border-cyan-800',
    bgColor: 'bg-cyan-50/50 dark:bg-cyan-950/20',
  },
  direct: {
    channel: 'direct',
    label: '付費直連',
    subLabel: '商業 API 原廠直連',
    isFree: false,
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    borderColor: 'border-amber-300 dark:border-amber-800',
    bgColor: 'bg-amber-50/50 dark:bg-amber-950/20',
  },
}

// Commercial rates for calculating money saved by using FreeLLM & CLIProxy (per 1k tokens)
const COMMERCIAL_BENCHMARK_RATES: Record<string, { in: number; out: number }> = {
  // CLIProxy typical models
  'gemini-3-flash':             { in: 0.000075, out: 0.0003  },
  'gpt-5.4-mini':               { in: 0.00015,  out: 0.0006  },
  'gpt-5.5':                    { in: 0.0025,   out: 0.010   },
  'kimi-k2':                    { in: 0.0008,   out: 0.0016  },
  'kimi-k2.5':                  { in: 0.001,    out: 0.002   },
  'grok-3-mini':                { in: 0.0005,   out: 0.0015  },
  'gemini-2.5-pro':             { in: 0.00125,  out: 0.005   },
  'deepseek-chat':              { in: 0.00014,  out: 0.00028 },

  // FreeLLM typical models
  'llama-3.3-70b':              { in: 0.0006,   out: 0.0018  },
  'glm-4.7-flash':              { in: 0.0001,   out: 0.0001  },
  'qwen3-32b':                  { in: 0.0004,   out: 0.0012  },
  'auto':                       { in: 0.0005,   out: 0.0015  },
}

// Direct commercial API rates (per 1k tokens)
const DIRECT_API_RATES: Record<string, { in: number; out: number }> = {
  'deepseek-chat':              { in: 0.00014,  out: 0.00028  },
  'deepseek-reasoner':          { in: 0.00055,  out: 0.00219  },
  'gemini-3.0-flash':           { in: 0.000075, out: 0.0003   },
  'gemini-3.0-flash-thinking':  { in: 0.000075, out: 0.0003   },
  'gemini-2.0-flash':           { in: 0.000075, out: 0.0003   },
  'gemini-2.0-flash-thinking':  { in: 0.000075, out: 0.0003   },
  'gemini-2.0-flash-vision':    { in: 0.00125,  out: 0.00375  },
  'gemini-2.5-flash':           { in: 0.0003,   out: 0.0025   },
  'claude-opus-4-5':            { in: 0.015,    out: 0.075    },
  'claude-sonnet-4-5':          { in: 0.003,    out: 0.015    },
  'claude-sonnet-4-6':          { in: 0.003,    out: 0.015    },
  'claude-haiku-4-5-20251001':  { in: 0.001,    out: 0.005    },
  'perplexity-sonar-pro':       { in: 0.001,    out: 0.001    },
  'or-gpt-4o-mini':             { in: 0.00015,  out: 0.0006   },
}

// Display names for models across providers
const MODEL_NAME_MAP: Record<string, string> = {
  'deepseek-chat':              'DeepSeek V3 (Chat)',
  'deepseek-reasoner':          'DeepSeek R1 (Reasoner)',
  'gemini-2.0-flash':           'Gemini 2.0 Flash',
  'gemini-2.0-flash-thinking':  'Gemini Flash Thinking',
  'gemini-3.0-flash':           'Gemini 3.0 Flash',
  'gemini-2.5-flash':           'Gemini 2.5 Flash',
  'gemini-2.0-flash-vision':    'Gemini Vision (OCR)',
  'claude-sonnet-4-5':          'Claude Sonnet 4.5',
  'claude-sonnet-4-6':          'Claude Sonnet 4.6',
  'claude-opus-4-5':            'Claude Opus 4.5',
  'claude-haiku-4-5-20251001':  'Claude Haiku 4.5',
  'perplexity-sonar-pro':       'Perplexity Sonar Pro',
  'or-gpt-4o-mini':             'GPT-4o Mini (OpenRouter)',
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
 * Determine the source channel from model ID or explicit parameter
 */
export function detectSourceChannel(modelId: string, explicitVia?: string): SourceChannel {
  if (explicitVia === 'cli-proxy' || explicitVia === 'cliproxy') return 'cliproxy'
  if (explicitVia === 'free-llm' || explicitVia === 'freellm') return 'freellm'
  if (explicitVia === 'groq') return 'groq'

  const lower = (modelId || '').toLowerCase()
  if (lower.includes('cli-proxy') || lower.includes('cliproxy') || lower.startsWith('proxy:cli-proxy')) {
    return 'cliproxy'
  }
  if (lower.includes('free-llm') || lower.includes('freellm') || lower.startsWith('proxy:free-llm')) {
    return 'freellm'
  }
  if (lower.startsWith('groq-') || lower === 'groq') {
    return 'groq'
  }

  // Check known proxy-only models
  const cliProxyOnly = ['kimi-k2', 'kimi-k2.5', 'gpt-5.4-mini', 'gpt-5.5', 'grok-3-mini']
  if (cliProxyOnly.some(m => lower === m || lower.endsWith(`:${m}`))) {
    return 'cliproxy'
  }

  const freeLlmOnly = ['glm-4.7-flash']
  if (freeLlmOnly.some(m => lower === m || lower.endsWith(`:${m}`))) {
    return 'freellm'
  }

  return 'direct'
}

/**
 * Extract clean model identifier without proxy prefixes
 */
export function cleanModelId(rawModelId: string): string {
  let id = rawModelId || ''
  if (id.startsWith('proxy:')) id = id.slice(6)
  if (id.startsWith('cli-proxy:')) id = id.slice(10)
  if (id.startsWith('free-llm:')) id = id.slice(9)
  if (id.startsWith('cliproxy:')) id = id.slice(9)
  if (id.startsWith('freellm:')) id = id.slice(8)
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
    // Actual cost is strictly 0.00
    // Estimate commercial benchmark value saved
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
    // Groq is officially free
    return {
      actualCostUsd: 0,
      actualCostTwd: 0,
      savedCostUsd: 0,
      savedCostTwd: 0,
      isFree: true,
      channel,
    }
  }

  // Direct paid API
  const rate = DIRECT_API_RATES[cleanId] ?? { in: 0.0005, out: 0.0015 }
  const actualUsd = (inputTokens / 1000) * rate.in + (outputTokens / 1000) * rate.out
  return {
    actualCostUsd: Number(actualUsd.toFixed(6)),
    actualCostTwd: Number((actualUsd * USD_TO_TWD).toFixed(2)),
    savedCostUsd: 0,
    savedCostTwd: 0,
    isFree: false,
    channel: 'direct',
  }
}
