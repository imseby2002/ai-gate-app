/**
 * 考核評分：領班評分（store）、辦公室評分（office）。
 * 評等 → 獎金金額對應表存在 hr_settings.eval_tiers，存檔時依表算出 tier_amount 快照。
 * 預設評等沿用薪資表「Xếp hạng」實際出現的等級；金額預設 0，由人事設定。
 */
export type EvalKind = 'store' | 'office'
export const EVAL_KINDS: EvalKind[] = ['store', 'office']
export interface Tier { rating: string; amount: number }
export type EvalTiers = Record<EvalKind, Tier[]>

const DEFAULT_RATINGS = ['A+', 'A-', 'B++', 'B+', 'B']

export function normTiers(raw: unknown): EvalTiers {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const one = (v: unknown): Tier[] => {
    const arr = Array.isArray(v) ? v : []
    const out: Tier[] = []
    for (const t of arr) {
      const o = (t ?? {}) as Record<string, unknown>
      const rating = String(o.rating ?? '').trim().slice(0, 20)
      if (!rating || out.some(x => x.rating === rating)) continue
      out.push({ rating, amount: Math.max(0, Number(o.amount) || 0) })
    }
    return out.length ? out.slice(0, 20) : DEFAULT_RATINGS.map(rating => ({ rating, amount: 0 }))
  }
  return { store: one(src.store), office: one(src.office) }
}

export const normKind = (k: unknown): EvalKind => (k === 'office' ? 'office' : 'store')

export function tierAmount(tiers: EvalTiers, kind: EvalKind, rating: string): number {
  return tiers[kind].find(t => t.rating === rating)?.amount ?? 0
}
