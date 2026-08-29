// 排班共用：時段預設與日期工具。
export interface Slot { code: string; label: string }

export const DEFAULT_SLOTS: Slot[] = [
  { code: 'am', label: '早' },
  { code: 'pm', label: '午' },
  { code: 'night', label: '晚' },
]

// 依起訖日期（含）列出所有日期 YYYY-MM-DD
export function listDates(start: string, end: string): string[] {
  const out: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return out
  let t = Date.parse(start + 'T00:00:00Z')
  const last = Date.parse(end + 'T00:00:00Z')
  let guard = 0
  while (t <= last && guard++ < 400) {
    out.push(new Date(t).toISOString().slice(0, 10))
    t += 86400000
  }
  return out
}

export function sanitizeSlots(v: unknown): Slot[] {
  if (!Array.isArray(v)) return DEFAULT_SLOTS
  const out: Slot[] = []
  const seen = new Set<string>()
  for (const s of v) {
    const code = String((s as Slot)?.code ?? '').trim().slice(0, 20)
    const label = String((s as Slot)?.label ?? '').trim().slice(0, 20)
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({ code, label: label || code })
  }
  return out.length ? out : DEFAULT_SLOTS
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
export function weekday(date: string): string {
  const d = new Date(date + 'T00:00:00Z')
  return WEEKDAY[d.getUTCDay()] ?? ''
}
