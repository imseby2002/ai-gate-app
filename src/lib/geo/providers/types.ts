/**
 * GEO 關鍵字數據源介面 — 上層只認 KeywordProvider，不認具體工具。
 * 免費起步（FreeKeywordProvider），未來付費（DataForSeoProvider）無痛升級。
 */
export interface KeywordMetric {
  keyword: string
  volume: number | null
  volumeSource: 'measured' | 'estimated' | 'unknown'
  competition: number | null
  relatedQueries: string[]
  trend: 'rising' | 'flat' | 'falling' | null
}

export interface KeywordProvider {
  name: string
  getMetrics(seed: string, locale: string, location: string): Promise<KeywordMetric[]>
}
