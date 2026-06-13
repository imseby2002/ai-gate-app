/**
 * FreeKeywordProvider — 免費關鍵字訊號（不裝套件、不需金鑰）
 * 使用 Google Autocomplete 公開 endpoint 取得建議詞，作為「搜尋訊號」代理。
 * volume 無法測得故為 null（volumeSource='estimated'，以建議詞數量/出現位置代理熱度）。
 */
import type { KeywordProvider, KeywordMetric } from './types'

const HL: Record<string, string> = { 'zh-TW': 'zh-TW', zh: 'zh-TW', en: 'en', vi: 'vi' }
const GL: Record<string, string> = { 'zh-TW': 'tw', zh: 'tw', en: 'us', vi: 'vn' }

async function autocomplete(term: string, hl: string, gl: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&q=${encodeURIComponent(term)}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json()
    // Firefox client 格式：[query, [suggestions...]]
    return Array.isArray(data?.[1]) ? data[1].filter((s: unknown) => typeof s === 'string') : []
  } catch {
    return []
  }
}

export const FreeKeywordProvider: KeywordProvider = {
  name: 'free',
  async getMetrics(seed, locale, location) {
    const hl = HL[locale] ?? 'zh-TW'
    const gl = location || GL[locale] || 'tw'

    const suggestions = await autocomplete(seed, hl, gl)
    // 以建議詞出現「即為被搜尋訊號」：愈靠前的建議代表愈熱門 → 用位置反推相對熱度
    const metrics: KeywordMetric[] = suggestions.slice(0, 10).map((kw) => ({
      keyword: kw,
      volume: null,
      volumeSource: 'estimated',
      competition: null,
      relatedQueries: suggestions,
      trend: null,
    }))

    // seed 本身也回一筆（即使無建議，至少標 unknown）
    metrics.unshift({
      keyword: seed,
      volume: null,
      volumeSource: suggestions.length > 0 ? 'estimated' : 'unknown',
      competition: null,
      relatedQueries: suggestions,
      trend: null,
    })

    return metrics
  },
}
