// 以「原中文字串」為 key 的翻譯：先找完全相同的 key，再試含 {變數} 的樣板 key
// （例：「每月 {n} 次免費」可對到「每月 2 次免費」），都找不到就回傳原文。
export type Dict = Record<string, string>
export type Tr = (s: string | undefined | null) => string

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function makeTr(dict: Dict | null): Tr {
  if (!dict) return s => s ?? ''
  const patterns = Object.keys(dict)
    .filter(k => /\{\w+\}/.test(k))
    .map(k => {
      const names: string[] = []
      const re = new RegExp('^' + k.split(/(\{\w+\})/).map(part => {
        const m = part.match(/^\{(\w+)\}$/)
        if (m) { names.push(m[1]); return '(.+?)' }
        return esc(part)
      }).join('') + '$', 's')
      return { re, names, out: dict[k] }
    })
  return s => {
    if (!s) return s ?? ''
    const hit = dict[s]
    if (hit !== undefined) return hit
    for (const p of patterns) {
      const m = s.match(p.re)
      if (m) return p.out.replace(/\{(\w+)\}/g, (_, n: string) => { const i = p.names.indexOf(n); return i >= 0 ? m[i + 1] : `{${n}}` })
    }
    return s
  }
}

// 遞迴翻譯物件／陣列裡的字串（函式、React 元件、其他型別原樣保留）
export function trDeep<T>(v: T, tr: Tr): T {
  if (typeof v === 'string') return tr(v) as T
  if (Array.isArray(v)) return v.map(x => trDeep(x, tr)) as T
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[k] = trDeep(x, tr)
    return out as T
  }
  return v
}
