// 依歷史每小時業績與假日估算人數需求（不用 AI，算法透明）：
// 預估杯數 ＝ 近 12 週同星期同小時平均杯數（平日資料）× 假日倍數；人數 ＝ ⌈預估杯數 ÷ 每人每小時可做杯數⌉，限制在最少／最多人數內。
// 假日倍數：歷史上假日當天業績 ÷ 同星期平日平均；歷史沒有假日資料時用設定值。
import type { createAdminClient } from '@/lib/supabase/admin'
import { SLOT_MIN, addDays, listDates, weekdayOf } from './time'
import type { ShiftSettings } from './settings'

type Admin = ReturnType<typeof createAdminClient>

export interface EstRange { start_min: number; end_min: number; headcount: number }
export interface EstDay { date: string; holiday: string | null; factor: number; peak: number | null; ranges: EstRange[] }

export async function estimateNeeds(db: Admin, owner: string, store: string, from: string, to: string, s: ShiftSettings) {
  const histFrom = addDays(from, -84)
  const [{ data: sales }, { data: hols }] = await Promise.all([
    db.from('store_hourly_sales').select('sale_date, hour, orders, cups').eq('owner_id', owner).eq('store', store)
      .gte('sale_date', histFrom).lt('sale_date', from).limit(10000),
    db.from('shift_holidays').select('date, name').eq('owner_id', owner).gte('date', histFrom).lte('date', to),
  ])
  const holiday = new Map((hols ?? []).map(h => [h.date as string, String(h.name ?? '')]))
  const rows = sales ?? []
  // 有杯數就用杯數，否則用單數
  const useCups = rows.some(r => Number(r.cups) > 0)
  const val = (r: { cups: unknown; orders: unknown }) => Number(useCups ? r.cups : r.orders) || 0

  const dayTotal = new Map<string, number>()
  const wdDays = new Map<number, Set<string>>()
  const wdHour = new Map<string, number>()
  const hourAll = new Map<number, number>()
  const normalDays = new Set<string>()
  for (const r of rows) {
    const d = r.sale_date as string, v = val(r)
    dayTotal.set(d, (dayTotal.get(d) ?? 0) + v)
    if (holiday.has(d)) continue
    normalDays.add(d)
    const wd = weekdayOf(d)
    ;(wdDays.get(wd) ?? wdDays.set(wd, new Set()).get(wd)!).add(d)
    wdHour.set(`${wd}|${r.hour}`, (wdHour.get(`${wd}|${r.hour}`) ?? 0) + v)
    hourAll.set(r.hour, (hourAll.get(r.hour) ?? 0) + v)
  }
  const avgAt = (wd: number, h: number): number | null => {
    const n = wdDays.get(wd)?.size ?? 0
    if (n) return (wdHour.get(`${wd}|${h}`) ?? 0) / n
    return normalDays.size ? (hourAll.get(h) ?? 0) / normalDays.size : null
  }

  // 假日倍數
  const ratios: number[] = []
  for (const [d, total] of dayTotal) {
    if (!holiday.has(d)) continue
    const same = [...(wdDays.get(weekdayOf(d)) ?? [])]
    if (!same.length) continue
    const base = same.reduce((a, x) => a + (dayTotal.get(x) ?? 0), 0) / same.length
    if (base > 0) ratios.push(total / base)
  }
  const factor = ratios.length ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length * 100) / 100 : s.holidayFactor
  const factorSource: 'history' | 'setting' = ratios.length ? 'history' : 'setting'

  const days: EstDay[] = listDates(from, to).map(date => {
    const hol = holiday.get(date) ?? null
    const f = hol != null ? factor : 1
    const ranges: EstRange[] = []
    let peak: number | null = null
    for (let m = Math.floor(s.openStart / SLOT_MIN) * SLOT_MIN; m < s.openEnd; m += SLOT_MIN) {
      const avg = avgAt(weekdayOf(date), Math.floor(m / 60))
      const exp = avg == null ? null : avg * f
      if (exp != null) peak = Math.max(peak ?? 0, Math.round(exp))
      const head = exp == null ? s.minStaff : Math.min(s.maxStaff, Math.max(s.minStaff, Math.ceil(exp / s.cupsPerStaffHour)))
      const last = ranges[ranges.length - 1]
      if (last && last.headcount === head && last.end_min === m) last.end_min = m + SLOT_MIN
      else ranges.push({ start_min: m, end_min: m + SLOT_MIN, headcount: head })
    }
    return { date, holiday: hol, factor: f, peak, ranges: ranges.filter(r => r.headcount > 0) }
  })
  return { salesDays: dayTotal.size, unit: useCups ? 'cups' as const : 'orders' as const, holidayFactor: factor, factorSource, days }
}
