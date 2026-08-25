// 解析「Bảng tính giá vốn SP đồ uống」成本試算表。
// 版面：每列帶多個配方區塊，起始欄 base ∈ {1, 9, 17}，每塊 7 欄：
//   base   Nguyên liệu（原料）
//   base+1 ĐVT（單位）
//   base+2 Lượng（用量）
//   base+3 ĐGX（出價）  base+4 ĐGN（進價）
//   base+5 TTX（出額）  base+6 TTN（進額）
// 區塊 = 品名列 → 表頭列(Nguyên liệu…) → 原料列… → Tổng（合計）→ Giá 1kg/1000cc（單位成本）。
import type { Cell } from '@/lib/inv/xlsxRead'

export interface RdItem {
  material_name: string; unit: string; qty: number
  price_export: number; price_purchase: number; amount_export: number; amount_purchase: number
}
export interface RdRecipe {
  name: string; cup_size: string
  total_export: number; total_purchase: number
  unit_cost_export: number; unit_cost_purchase: number; unit_label: string
  items: RdItem[]
}

const BASES = [1, 9, 17]
const txt = (rows: Cell[][], r: number, c: number) => String(rows[r]?.[c] ?? '').trim()
const num = (rows: Cell[][], r: number, c: number) => {
  const v = rows[r]?.[c]
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const isHeader = (s: string) => /nguy[êe]n\s*li/i.test(s)
const isTotal = (s: string) => /^t[ổo]ng/i.test(s)
const isUnitCost = (s: string) => /^gi[áa]\s*1/i.test(s)
const isCup = (s: string) => /^c[ốôo]c\b/i.test(s)

export function parseCostSheet(rows: Cell[][]): RdRecipe[] {
  const out: RdRecipe[] = []
  const seen = new Set<string>()
  for (const base of BASES) {
    let cupSize = ''
    for (let r = 0; r < rows.length; r++) {
      const first = txt(rows, r, base)
      if (isCup(first)) { cupSize = first; continue }
      if (!(isHeader(first) && /đvt/i.test(txt(rows, r, base + 1)))) continue

      // 品名 = 表頭上方最近的非空、非表頭列
      let name = ''
      for (let pr = r - 1; pr >= Math.max(0, r - 4); pr--) {
        const t = txt(rows, pr, base)
        if (t && !isHeader(t) && !isCup(t)) { name = t; break }
      }

      const items: RdItem[] = []
      let total_export = 0, total_purchase = 0, unit_cost_export = 0, unit_cost_purchase = 0, unit_label = ''
      let rr = r + 1
      for (; rr < rows.length; rr++) {
        const f = txt(rows, rr, base)
        if (isUnitCost(f)) { unit_cost_export = num(rows, rr, base + 5); unit_cost_purchase = num(rows, rr, base + 6); unit_label = f; rr++; break }
        if (isTotal(f)) { total_export = num(rows, rr, base + 5); total_purchase = num(rows, rr, base + 6); continue }
        if (!f) { if (items.length) break; continue }
        if (isHeader(f)) break
        items.push({
          material_name: f, unit: txt(rows, rr, base + 1), qty: num(rows, rr, base + 2),
          price_export: num(rows, rr, base + 3), price_purchase: num(rows, rr, base + 4),
          amount_export: num(rows, rr, base + 5), amount_purchase: num(rows, rr, base + 6),
        })
      }
      r = rr - 1
      if (!name || items.length === 0) continue
      if (!total_export) total_export = items.reduce((s, it) => s + it.amount_export, 0)
      if (!total_purchase) total_purchase = items.reduce((s, it) => s + it.amount_purchase, 0)
      const key = name.toLowerCase()
      if (seen.has(key)) continue // 同名去重（取第一次出現）
      seen.add(key)
      out.push({ name, cup_size: cupSize, total_export, total_purchase, unit_cost_export, unit_cost_purchase, unit_label, items })
    }
  }
  return out
}
