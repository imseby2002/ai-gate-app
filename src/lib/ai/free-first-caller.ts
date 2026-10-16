import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { normalizeFreeLlmBaseUrl } from './providers/free-llm'
import { trackAiUsage, type FeatureModule } from './universal-tracker'
import { generateText, type LanguageModel } from 'ai'

export interface FreeFirstOptions {
  feature: FeatureModule
  systemPrompt?: string
  prompt: string
  preferredProxyModel?: string // e.g. 'gemini-2.5-flash', 'gpt-5.4-mini', 'auto'
  fallbackModel?: string       // e.g. 'claude-haiku-4-5-20251001', 'deepseek-chat', 'gemini-2.5-flash'
  maxOutputTokens?: number
}

/**
 * 取得優先免費通道模型實例（CLIProxy → FreeLLM → Direct 廉價備援）
 * 適用於所有定時任務 (cron)、信件同步、背景日誌、輕量翻譯等。
 */
export async function generateWithFreeFirst(opts: FreeFirstOptions): Promise<string> {
  const {
    feature,
    systemPrompt,
    prompt,
    preferredProxyModel = 'auto',
    fallbackModel = 'deepseek-chat',
    maxOutputTokens = 2000,
  } = opts

  // 1. 嘗試 CLIProxy (免費用量通道)
  const cliUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  const cliKey = process.env.CLI_PROXY_API_KEY ?? 'no-key'
  if (cliUrl) {
    try {
      const cliModel = preferredProxyModel === 'auto' ? 'gemini-2.5-flash' : preferredProxyModel
      const provider = createOpenAI({ apiKey: cliKey, baseURL: cliUrl })
      const res = await generateText({
        model: provider.chat(cliModel),
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens,
        abortSignal: AbortSignal.timeout(15000),
      })
      if (res.text?.trim()) {
        const usage = (res as any).usage ?? {}
        void trackAiUsage({
          feature,
          modelId: `cliproxy:${cliModel}`,
          inputTokens: Number(usage.inputTokens ?? usage.promptTokens ?? 0),
          outputTokens: Number(usage.outputTokens ?? usage.completionTokens ?? 0),
          sourceChannel: 'cliproxy',
        })
        return res.text.trim()
      }
    } catch (e) {
      console.warn(`[FreeFirst:${feature}] CLIProxy failed, falling back:`, e)
    }
  }

  // 2. 嘗試 FreeLLM (12 平台聚合免費用量通道)
  const freeUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const freeKey = process.env.FREE_LLM_API_KEY ?? 'no-key'
  if (freeUrl) {
    try {
      const baseURL = normalizeFreeLlmBaseUrl(freeUrl)
      const provider = createOpenAI({ apiKey: freeKey, baseURL })
      const res = await generateText({
        model: provider.chat('auto'),
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens,
        abortSignal: AbortSignal.timeout(15000),
      })
      if (res.text?.trim()) {
        const usage = (res as any).usage ?? {}
        void trackAiUsage({
          feature,
          modelId: 'freellm:auto',
          inputTokens: Number(usage.inputTokens ?? usage.promptTokens ?? 0),
          outputTokens: Number(usage.outputTokens ?? usage.completionTokens ?? 0),
          sourceChannel: 'freellm',
        })
        return res.text.trim()
      }
    } catch (e) {
      console.warn(`[FreeFirst:${feature}] FreeLLM failed, falling back:`, e)
    }
  }

  // 3. 嘗試原廠低成本備援 (DeepSeek / Gemini Flash / Claude Haiku)
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const deepseek = createOpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' })
      const res = await generateText({
        model: deepseek.chat('deepseek-chat'),
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens,
      })
      if (res.text?.trim()) {
        const usage = (res as any).usage ?? {}
        void trackAiUsage({
          feature,
          modelId: 'deepseek-chat',
          inputTokens: Number(usage.inputTokens ?? usage.promptTokens ?? 0),
          outputTokens: Number(usage.outputTokens ?? usage.completionTokens ?? 0),
          sourceChannel: 'deepseek',
        })
        return res.text.trim()
      }
    } catch (e) {
      console.warn(`[FreeFirst:${feature}] DeepSeek fallback failed:`, e)
    }
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
    try {
      const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
      const google = createGoogleGenerativeAI({ apiKey: key! })
      const res = await generateText({
        model: google('gemini-2.5-flash'),
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens,
      })
      if (res.text?.trim()) {
        const usage = (res as any).usage ?? {}
        void trackAiUsage({
          feature,
          modelId: 'gemini-2.5-flash',
          inputTokens: Number(usage.inputTokens ?? usage.promptTokens ?? 0),
          outputTokens: Number(usage.outputTokens ?? usage.completionTokens ?? 0),
          sourceChannel: 'google',
        })
        return res.text.trim()
      }
    } catch (e) {
      console.warn(`[FreeFirst:${feature}] Google fallback failed:`, e)
    }
  }

  // 4. 終極保底：Claude Haiku (極致省成本，比 Sonnet 便宜 90% 以上)
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens,
    })
    const usage = (res as any).usage ?? {}
    void trackAiUsage({
      feature,
      modelId: 'claude-haiku-4-5-20251001',
      inputTokens: Number(usage.inputTokens ?? usage.promptTokens ?? 0),
      outputTokens: Number(usage.outputTokens ?? usage.completionTokens ?? 0),
      sourceChannel: 'anthropic',
    })
    return res.text.trim()
  }

  throw new Error(`[FreeFirst:${feature}] 無任何可用 AI 通道`)
}
