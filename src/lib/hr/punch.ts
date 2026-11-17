// 手機 GPS 打卡：距離計算、越南時間、每日工時／遲到早退彙整，以及寫入每月考勤（hr_attendance）
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export const MAX_ACCURACY_M = 300 // 定位誤差超過這個值不收（避免室內粗略定位誤判）
export const OPEN_SHIFT_HOURS = 16 // 上班打卡後 16 小時內的下一次打卡視為下班（跨夜班）
export const GPS_ATT_TYPE = 'GPS'

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

// 越南時間（UTC+7）的日期與當天分鐘數
export function vnParts(t: Date | string): { date: string; min: number } {
  const d = new Date(new Date(t).getTime() + 7 * 3600_000)
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

export interface PunchRow { id?: string; employee_id: string; store: string; work_date: string; kind: 'in' | 'out'; punched_at: string; distance_m?: number | null }
export interface PlanRow { employee_id: string; work_date: string; start_min: number; end_min: number }
export interface DaySummary {
  employee_id: string; work_date: string; store: string
  firstIn: string | null; lastOut: string | null; minutes: number; open: boolean
  planStart: number | null; planEnd: number | null; lateMin: number; earlyMin: number
}

// 依（員工, 工作日）配對上下班：每個「上班」配下一個「下班」，算總分鐘；與已發布班表比對遲到／早退
export function summarize(punches: PunchRow[], plans: PlanRow[]): DaySummary[] {
  const groups = new Map<string, PunchRow[]>()
  for (const p of punches) {
    const k = `${p.employee_id}|${p.work_date}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(p)
  }
  const planMap = new Map<string, PlanRow[]>()
  for (const p of plans) {
    const k = `${p.employee_id}|${p.work_date}`
    if (!planMap.has(k)) planMap.set(k, [])
    planMap.get(k)!.push(p)
  }
  const out: DaySummary[] = []
  for (const [k, list] of groups) {
    list.sort((a, b) => a.punched_at.localeCompare(b.punched_at))
    let minutes = 0, inAt: string | null = null
    for (const p of list) {
      if (p.kind === 'in') inAt = inAt ?? p.punched_at
      else if (inAt) { minutes += Math.max(0, (Date.parse(p.punched_at) - Date.parse(inAt)) / 60000); inAt = null }
    }
    const firstIn = list.find(p => p.kind === 'in')?.punched_at ?? null
    const lastOut = [...list].reverse().find(p => p.kind === 'out')?.punched_at ?? null
    const pl = planMap.get(k) ?? []
    const planStart = pl.length ? Math.min(...pl.map(p => p.start_min)) : null
    const planEnd = pl.length ? Math.max(...pl.map(p => p.end_min)) : null
    const [employee_id, work_date] = k.split('|')
    // 打卡分鐘以班表日期為基準（跨夜下班 +1440）
    const minOf = (iso: string) => { const v = vnParts(iso); return v.min + (v.date > work_date ? 1440 : 0) }
    const lateMin = planStart != null && firstIn ? Math.max(0, minOf(firstIn) - planStart) : 0
    const earlyMin = planEnd != null && lastOut && !inAt ? Math.max(0, planEnd - minOf(lastOut)) : 0
    out.push({ employee_id, work_date, store: list[0].store, firstIn, lastOut, minutes: Math.round(minutes), open: !!inAt, planStart, planEnd, lateMin, earlyMin })
  }
  return out.sort((a, b) => a.work_date.localeCompare(b.work_date))
}

const monthRange = (year: number, month: number) => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { start, next }
}

// 重新計算某員工某月在某門市的 GPS 打卡工時，寫入 hr_attendance（att_type = GPS）。
// 若該月該門市已有考勤機匯入的資料（att_type 不是 GPS）則不覆蓋。手動補登保留。
export async function syncMonthlyAttendance(db: Admin, owner: string, emp: { id: string; name: string; attendance_no: string }, store: string, workDate: string) {
  const year = Number(workDate.slice(0, 4)), month = Number(workDate.slice(5, 7))
  const { start, next } = monthRange(year, month)
  const { data: rows } = await db.from('hr_punches').select('employee_id, store, work_date, kind, punched_at')
    .eq('owner_id', owner).eq('employee_id', emp.id).eq('store', store).gte('work_date', start).lt('work_date', next)
  const days = summarize((rows ?? []) as PunchRow[], [])
  const minutes = days.reduce((s, d) => s + d.minutes, 0)
  const workDays = days.filter(d => d.minutes > 0).length
  const { data: existing } = await db.from('hr_attendance').select('id, att_type')
    .eq('owner_id', owner).eq('year', year).eq('month', month).eq('store', store).eq('attendance_no', emp.attendance_no).maybeSingle()
  if (existing && existing.att_type !== GPS_ATT_TYPE) return
  const row = { machine_hours: Math.round(minutes / 60 * 100) / 100, work_days: workDays, name: emp.name, att_type: GPS_ATT_TYPE, updated_at: new Date().toISOString() }
  if (existing) await db.from('hr_attendance').update(row).eq('id', existing.id)
  else await db.from('hr_attendance').insert({ owner_id: owner, year, month, store, attendance_no: emp.attendance_no, adjust_hours: 0, adjust_note: '', ...row })
}
