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
      const targetModel = rawModel.includes('pro')
        ? 'gemini-2.5-pro'
        : rawModel.includes('claude')
        ? 'claude-sonnet-4-6'
        : rawModel.includes('deepseek')
        ? 'deepseek-chat'
        : 'gemini-2.5-flash'
      return createOpenAI({ apiKey, baseURL }).chat(targetModel)
    }
  }

  // 7. FreeLLM
  if (provider === 'freellm' || chosen.startsWith('freellm/')) {
    const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
    const baseURL = rawUrl ? (rawUrl.replace(/\/+$/, '').endsWith('/v1') ? rawUrl.replace(/\/+$/, '') : `${rawUrl.replace(/\/+$/, '')}/v1`) : rawUrl
    const apiKey = process.env.FREE_LLM_API_KEY ?? 'no-key'
    if (baseURL) {
      const targetModel = rawModel === 'auto' ? 'meta-llama/Llama-3.3-70B-Instruct' : rawModel
      return createOpenAI({ apiKey, baseURL }).chat(targetModel)
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

export function getTradingModelCandidates(chosenModelId?: string, tier: 'quick' | 'deep' = 'quick'): LanguageModel[] {
  const models: LanguageModel[] = []

  // 1. Primary requested model
  const primary = resolveTradingModel(chosenModelId, tier)
  if (primary) models.push(primary)

  // 2. Cascade fallback order based on tier
  if (tier === 'quick') {
    // Quick tier cascade: CLIProxy -> FreeLLM -> Gemini Flash -> DeepSeek -> GPT-4o -> Claude
    const c1 = resolveTradingModel('cliproxy/gemini-2.5-flash')
    if (c1 && !models.includes(c1)) models.push(c1)

    const c2 = resolveTradingModel('freellm/auto')
    if (c2 && !models.includes(c2)) models.push(c2)

    const c3 = resolveTradingModel('google/gemini-2.5-flash')
    if (c3 && !models.includes(c3)) models.push(c3)

    const c4 = resolveTradingModel('deepseek/deepseek-chat')
    if (c4 && !models.includes(c4)) models.push(c4)

    const c5 = resolveTradingModel('openai/gpt-4o')
    if (c5 && !models.includes(c5)) models.push(c5)
  } else {
    // Deep tier cascade: Claude Sonnet -> DeepSeek -> Gemini Pro -> GPT-4o -> CLIProxy
    const d1 = resolveTradingModel('anthropic/claude-sonnet-4-6')
    if (d1 && !models.includes(d1)) models.push(d1)

    const d2 = resolveTradingModel('deepseek/deepseek-chat')
    if (d2 && !models.includes(d2)) models.push(d2)

    const d3 = resolveTradingModel('google/gemini-2.5-pro')
    if (d3 && !models.includes(d3)) models.push(d3)

    const d4 = resolveTradingModel('openai/gpt-4o')
    if (d4 && !models.includes(d4)) models.push(d4)

    const d5 = resolveTradingModel('cliproxy/gemini-2.5-pro')
    if (d5 && !models.includes(d5)) models.push(d5)
  }

  return models
}
