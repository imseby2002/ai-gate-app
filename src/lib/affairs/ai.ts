// 外務 AI：以網路搜尋鏈查即時公開資料（租金行情、人口、學校、申請流程等）。
import type { ModelMessage } from 'ai'
import { cookies } from 'next/headers'
import { webSearchGenerate } from '@/lib/ai/web-search'


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
  // 共用搜尋鏈：免費（FreeLLM / CLIProxy）→ Gemini＋Google 搜尋（免費額度優先）→ Perplexity → Claude 搜尋
  // 外務結果要列出參考來源，免費通道沒回傳網址時改用下一個
  const r = await webSearchGenerate({
    system: opts.system,
    messages: opts.messages,
    maxSearches: opts.maxSearches ?? 5,
    maxOutputTokens: opts.maxOutputTokens ?? 4000,
    feature: 'affairs',
    requireSources: true,
  })
  return { text: r.text, sources: r.sources }
}

// 從模型輸出取出第一個 JSON 物件
export function parseJsonObject<T>(text: string): T | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) as T } catch { return null }
}
