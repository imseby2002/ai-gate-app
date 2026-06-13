/**
 * 機會分數 = 搜尋訊號分 × 商業意圖分 × AI 端競爭稀缺分（各 0–1），輸出 0–100。
 * 即使沒有真實搜尋量也能算（以 Autocomplete 出現代理搜尋訊號）。
 */
import type { KeywordMetric } from './providers/types'

export type Intent = 'info' | 'local' | 'compare' | 'transact'

// 商業意圖分：愈接近成交分數愈高
const INTENT_SCORE: Record<Intent, number> = {
  transact: 1.0,
  compare: 0.8,
  local: 0.7,
  info: 0.4,
}

export function intentScore(intent: string | null | undefined): number {
  return INTENT_SCORE[(intent as Intent)] ?? 0.4
}

/**
 * 搜尋訊號分：
 * - 有實測 volume → log 正規化（1 萬以上趨近滿分）
 * - 無 volume → 以 Autocomplete 建議詞數量代理（出現愈多代表愈多人搜）
 */
export function searchSignal(metrics: KeywordMetric[]): { score: number; source: KeywordMetric['volumeSource'] } {
  const measured = metrics.find(m => m.volume != null)
  if (measured?.volume != null) {
    const score = Math.min(1, Math.log10(measured.volume + 1) / 4) // 10^4=10000 → 1
    return { score: Math.max(0.05, score), source: 'measured' }
  }
  const suggestions = metrics[0]?.relatedQueries?.length ?? 0
  if (suggestions > 0) {
    return { score: Math.min(1, suggestions / 8), source: 'estimated' }
  }
  return { score: 0.2, source: 'unknown' } // 未知時給保守底分，不歸零
}

/** scarcity：AI 端現有引用來源「愈少愈弱」→ 機會愈大（0–1，1=幾乎沒人佔位） */
export function clampScarcity(raw: number): number {
  if (!Number.isFinite(raw)) return 0.5
  return Math.min(1, Math.max(0, raw))
}

export function opportunity(signal: number, intent: number, scarcity: number): number {
  return Math.round(signal * intent * scarcity * 100)
}
