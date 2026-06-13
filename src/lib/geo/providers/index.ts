/**
 * getKeywordProvider() — 依環境變數自動選擇數據源，上層零改動。
 * 有 DATAFORSEO_* → 付費版（未來實作）；否則 → 免費版。
 */
import type { KeywordProvider } from './types'
import { FreeKeywordProvider } from './free'

export type { KeywordProvider, KeywordMetric } from './types'

export function getKeywordProvider(): KeywordProvider {
  // 未來：if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) return DataForSeoProvider
  return FreeKeywordProvider
}
