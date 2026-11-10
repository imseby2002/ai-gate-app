import type { FeatureModule } from './universal-tracker'
import { generateTextWithFallback, FALLBACK_CHAINS, type Attempt } from './proxy-fallback'

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
    maxOutputTokens = 2000,
  } = opts

  // 指定的 CLIProxy 模型優先，其後沿用擷取鏈：免費（CLIProxy / Groq / FreeLLM / OpenRouter 免費）
  // → Claude Haiku 5.5 → DeepSeek Flash（直連或 OpenRouter 依每日比價）
  const chain: Attempt[] = [
    { via: 'cli-proxy', model: preferredProxyModel === 'auto' ? 'gemini-3-flash' : preferredProxyModel },
    ...FALLBACK_CHAINS.extraction,
  ]
  try {
    const { result } = await generateTextWithFallback(chain, {
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens,
    }, { feature, timeoutMs: 30000 })
    return result.text.trim()
  } catch (e) {
    throw new Error(`[FreeFirst:${feature}] 無任何可用 AI 通道：${e instanceof Error ? e.message : String(e)}`)
  }
}
