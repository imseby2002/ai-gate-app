// 時間制排班共用：時間以「當天第幾分鐘」表示（0~1440），格子大小 SLOT_MIN。
// client/server 皆可 import。

export const SLOT_MIN = 30 // 每格分鐘數；改成 15 即為 15 分鐘一格

export interface Interval { start: number; end: number }
export interface AvailRule { id: string; employee_id: string; start_date: string; end_date: string; weekdays: number[]; start_min: number; end_min: number; note?: string }
export interface NeedRule { id: string; weekdays: number[]; start_min: number; end_min: number; headcount: number }
export interface PlanRow { id: string; employee_id: string; work_date: string; start_min: number; end_min: number; status: 'draft' | 'published' }

export const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function parseHHMM(v: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim())
  if (!m) return null
  const n = Number(m[1]) * 60 + Number(m[2])
  return n >= 0 && n <= 1440 ? n : null
}

// 全天時間選項（SLOT_MIN 一格），含 24:00 作為結束時間
export function timeOptions(includeEnd = false): number[] {
  const out: number[] = []
  for (let m = 0; m < 1440; m += SLOT_MIN) out.push(m)
  if (includeEnd) out.push(1440)
  return out
}

export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

export function weekdayOf(date: string): number {
  return new Date(date + 'T00:00:00Z').getUTCDay()
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
}

// 依起訖日期（含）列出所有日期 YYYY-MM-DD（最多 400 天）
export function listDates(start: string, end: string): string[] {
  const out: string[] = []
  if (!isDate(start) || !isDate(end)) return out
  for (let d = start, i = 0; d <= end && i < 400; d = addDays(d, 1), i++) out.push(d)
  return out
}

// 本週一
export function mondayOf(date: string): string {
  const wd = weekdayOf(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

export const matchesDay = (weekdays: number[] | null | undefined, date: string) =>
  !weekdays || weekdays.length === 0 || weekdays.includes(weekdayOf(date))

export function ruleCovers(r: Pick<AvailRule, 'start_date' | 'end_date' | 'weekdays'>, date: string) {
  return date >= r.start_date && date <= r.end_date && matchesDay(r.weekdays, date)
}

// 合併重疊或相接的區間
export function mergeIntervals(list: Interval[]): Interval[] {
  const s = [...list].sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const x of s) {
    const last = out[out.length - 1]
    if (last && x.start <= last.end) last.end = Math.max(last.end, x.end)
    else out.push({ ...x })
  }
  return out
}

// 某員工某天可上班的區間
export function availableOn(rules: AvailRule[], employeeId: string, date: string): Interval[] {
  return mergeIntervals(rules.filter(r => r.employee_id === employeeId && ruleCovers(r, date)).map(r => ({ start: r.start_min, end: r.end_min })))
}

// 某天每一格需要的人數（同一格多條規則取最大值）
export function needsOn(needs: NeedRule[], date: string): Map<number, number> {
  const out = new Map<number, number>()
  for (const n of needs) {
    if (!matchesDay(n.weekdays, date)) continue
    for (let m = Math.floor(n.start_min / SLOT_MIN) * SLOT_MIN; m < n.end_min; m += SLOT_MIN) {
      out.set(m, Math.max(out.get(m) ?? 0, n.headcount))
    }
  }
  return out
}

export const covers = (iv: Interval, slotStart: number) => iv.start <= slotStart && iv.end >= slotStart + SLOT_MIN
