// 門市每小時業績：匯入解析與「星期 × 小時」平均（AI 排班建議用）
import type { createAdminClient } from '@/lib/supabase/admin'
import { addDays, weekdayOf } from './time'

type Admin = ReturnType<typeof createAdminClient>

export interface HourStat { weekday: number; hour: number; days: number; orders: number; cups: number; revenue: number }

const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }

// Excel 日期可能是序號、Date 或字串（YYYY-MM-DD、YYYY/MM/DD、DD/MM/YYYY）
export function parseDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

// 小時：15、"15"、"15:00"、"15:00-16:00"、Excel 時間小數 0.625
export function parseHour(v: unknown): number | null {
  if (typeof v === 'number') {
    if (v > 0 && v < 1) return Math.floor(v * 24 + 1e-6)
    return Number.isInteger(v) && v >= 0 && v <= 23 ? v : null
  }
  const m = /^(\d{1,2})/.exec(String(v ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  return h >= 0 && h <= 23 ? h : null
}

export function parseSalesRow(r: Record<string, unknown>) {
  const sale_date = parseDate(r.date)
  const hour = parseHour(r.hour)
  if (!sale_date) return { error: '日期格式錯誤' }
  if (hour == null) return { error: '小時格式錯誤（0–23 或 15:00）' }
  return { row: { sale_date, hour, orders: Math.round(num(r.orders)), cups: num(r.cups), revenue: num(r.revenue) } }
}

// 指定日期前 weeks 週的「星期 × 小時」平均（只計有資料的日子）
export async function hourlyProfile(admin: Admin, ownerId: string, store: string, before: string, weeks = 8) {
  const from = addDays(before, -weeks * 7)
  const { data } = await admin.from('store_hourly_sales').select('sale_date, hour, orders, cups, revenue')
    .eq('owner_id', ownerId).eq('store', store).gte('sale_date', from).lt('sale_date', before).limit(5000)
  const rows = data ?? []
  const daysByWd = new Map<number, Set<string>>()
  const acc = new Map<string, HourStat>()
  for (const r of rows) {
    const wd = weekdayOf(r.sale_date)
    ;(daysByWd.get(wd) ?? daysByWd.set(wd, new Set()).get(wd)!).add(r.sale_date)
    const k = `${wd}|${r.hour}`
    const a = acc.get(k) ?? { weekday: wd, hour: r.hour, days: 0, orders: 0, cups: 0, revenue: 0 }
    a.orders += Number(r.orders) || 0; a.cups += Number(r.cups) || 0; a.revenue += Number(r.revenue) || 0
    acc.set(k, a)
  }
  const stats = [...acc.values()].map(a => {
    const d = daysByWd.get(a.weekday)?.size || 1
    return { ...a, days: d, orders: Math.round(a.orders / d * 10) / 10, cups: Math.round(a.cups / d * 10) / 10, revenue: Math.round(a.revenue / d) }
  }).sort((x, y) => x.weekday - y.weekday || x.hour - y.hour)
  const dates = [...new Set(rows.map(r => r.sale_date))].sort()
  return { from, to: addDays(before, -1), days: dates.length, firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null, stats }
}
