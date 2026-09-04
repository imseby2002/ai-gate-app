// 損益小計計算（沿用 finance/pnl-schema 的 compute 規則），供總經理室彙整重用。
import { PNL_LINES, PNL_LINE_MAP, type PnlLine } from '@/app/(standalone)/finance/pnl-schema'

// 由明細 vals 解出所有科目（含 subtotal），與 finance PnlReport 的 resolveStore 同邏輯。
export function resolvePnl(vals: Record<string, number>): Record<string, number> {
  const lines = PNL_LINES; const map = PNL_LINE_MAP as Record<string, PnlLine>
  const out: Record<string, number> = {}
  const visiting = new Set<string>()
  const get = (code: string): number => {
    if (code in out) return out[code]
    if (code in vals) { out[code] = vals[code]; return out[code] }
    const line = map[code]
    if (!line?.compute) { out[code] = 0; return 0 }
    if (visiting.has(code)) return 0
    visiting.add(code)
    const c = line.compute
    let r = 0
    if (c.op === 'sum') r = c.codes.reduce((s, x) => s + get(x), 0)
    else if (c.op === 'sumSection') r = lines.filter(l => l.section === c.section && l.kind === 'detail').reduce((s, l) => s + get(l.code), 0)
    else if (c.op === 'sub') r = get(c.left) - get(c.right)
    else if (c.op === 'subMany') r = c.minus.reduce((s, x) => s - get(x), get(c.base))
    visiting.delete(code)
    out[code] = r
    return r
  }
  for (const l of lines) get(l.code)
  return out
}
