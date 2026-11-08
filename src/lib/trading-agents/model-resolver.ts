import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createGroq } from '@ai-sdk/groq'
import type { LanguageModel } from 'ai'

export interface ModelTierConfig {
  quickThinkModel?: string // For analysts, debaters, trader
  deepThinkModel?: string  // For research manager, portfolio manager
}

export function resolveTradingModel(modelId?: string, tier: 'quick' | 'deep' = 'quick'): LanguageModel | null {
  const chosen = modelId || (tier === 'deep' ? 'anthropic/claude-sonnet-4-6' : 'google/gemini-2.5-flash')
  const slash = chosen.indexOf('/')
  const provider = slash === -1 ? '' : chosen.slice(0, slash)
  const rawModel = slash === -1 ? chosen : chosen.slice(slash + 1)

  // 1. Anthropic
  if (provider === 'anthropic' || chosen.includes('claude')) {
    if (process.env.OPENROUTER_API_KEY) {
      return createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      }).chat(`anthropic/${rawModel}`)
    }
    const key = process.env.ANTHROPIC_API_KEY?.trim()
    if (key) {
      const realModel = rawModel.includes('sonnet') ? 'claude-sonnet-4-6' : rawModel
      return createAnthropic({ apiKey: key })(realModel)
    }
  }

  // 2. OpenAI
  if (provider === 'openai' || chosen.includes('gpt')) {
    const key = process.env.OPENAI_API_KEY?.trim()
    if (key) {
      const model = rawModel.includes('gpt-4') ? 'gpt-4o' : rawModel
      return createOpenAI({ apiKey: key }).chat(model)
    }
    if (process.env.OPENROUTER_API_KEY) {
      return createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      }).chat(`openai/${rawModel}`)
    }
  }

  // 3. Google Gemini
  if (provider === 'google' || chosen.includes('gemini')) {
    const key = process.env.GOOGLE_AI_API_KEY?.trim()
    if (key) {
      const model = rawModel.includes('pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash'
      return createGoogleGenerativeAI({ apiKey: key })(model)
    }
  }

  // 4. DeepSeek
  if (provider === 'deepseek' || chosen.includes('deepseek')) {
    const key = process.env.DEEPSEEK_API_KEY?.trim()
    if (key) {
      return createOpenAI({
        apiKey: key,
        baseURL: 'https://api.deepseek.com/v1',
      }).chat(rawModel || 'deepseek-chat')
    }
  }

  // 5. Groq
  if (provider === 'groq' || chosen.includes('groq')) {
    const key = process.env.GROQ_API_KEY?.trim()
    if (key) {
      return createGroq({ apiKey: key })('llama-3.3-70b-versatile')
    }
  }

  // 6. CLI Proxy
  if (provider === 'cliproxy' || chosen.startsWith('cliproxy/')) {
    const baseURL = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
    const apiKey = process.env.CLI_PROXY_API_KEY ?? 'no-key'
    if (baseURL) {
      return createOpenAI({ apiKey, baseURL }).chat(rawModel)
    }
  }

  // 7. FreeLLM
  if (provider === 'freellm' || chosen.startsWith('freellm/')) {
    const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
    const baseURL = rawUrl ? (rawUrl.replace(/\/+$/, '').endsWith('/v1') ? rawUrl.replace(/\/+$/, '') : `${rawUrl.replace(/\/+$/, '')}/v1`) : rawUrl
    const apiKey = process.env.FREE_LLM_API_KEY ?? 'no-key'
    if (baseURL) {
      return createOpenAI({ apiKey, baseURL }).chat(rawModel)
    }
  }

  // Fallback cascade to whatever valid API key exists
  if (process.env.GOOGLE_AI_API_KEY) {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })('gemini-2.5-flash')
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat('gpt-4o')
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })('claude-sonnet-4-6')
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return createOpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' }).chat('deepseek-chat')
  }

  return null
}
