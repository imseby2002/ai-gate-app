// 外務 AI：以 Claude + 官方 web search 工具查即時公開資料（租金行情、人口、學校、申請流程等）。
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, stepCountIs, type ModelMessage } from 'ai'
import { cookies } from 'next/headers'

export const AFFAIRS_AI_MODEL = 'claude-sonnet-4-6'

const LANG_NAME: Record<string, string> = { 'zh-TW': '繁體中文', en: 'English', vi: 'Tiếng Việt' }

export async function replyLanguage(): Promise<string> {
  const lc = (await cookies()).get('locale')?.value ?? 'zh-TW'
  return LANG_NAME[lc] ?? LANG_NAME['zh-TW']
}

export interface SearchResult {
  text: string
  sources: { url: string; title: string }[]
}

export async function generateWithSearch(opts: {
  system: string
  messages: ModelMessage[]
  maxSearches?: number
  maxOutputTokens?: number
}): Promise<SearchResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('AI 金鑰未設定')
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await generateText({
    model: anthropic(AFFAIRS_AI_MODEL),
    system: opts.system,
    messages: opts.messages,
    tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: opts.maxSearches ?? 5 }) },
    stopWhen: stepCountIs(8),
    maxOutputTokens: opts.maxOutputTokens ?? 4000,
  })
  const seen = new Set<string>()
  const sources: SearchResult['sources'] = []
  for (const s of res.sources ?? []) {
    if (s.sourceType !== 'url' || seen.has(s.url)) continue
    seen.add(s.url)
    sources.push({ url: s.url, title: s.title ?? s.url })
  }
  return { text: res.text, sources }
}

// 從模型輸出取出第一個 JSON 物件
export function parseJsonObject<T>(text: string): T | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) as T } catch { return null }
}
