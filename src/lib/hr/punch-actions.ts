// 員工 GPS 打卡共用邏輯：員工專區（/api/e/[no]/punch）與 ERP 登入打卡（/api/me/punch）
import type { createAdminClient } from '@/lib/supabase/admin'
import { addDays } from '@/lib/shift/time'
import { MAX_ACCURACY_M, OPEN_SHIFT_HOURS, companyTz, distanceM, summarize, syncMonthlyAttendance, tzParts, type PlanRow, type PunchRow } from '@/lib/hr/punch'

type Admin = ReturnType<typeof createAdminClient>
export type PunchEmp = { id: string; name: string; attendance_no: string; store?: string | null; managed_stores?: unknown }
export type PunchResult = { status: number; body: Record<string, unknown> }
type Emp = { store?: string | null; managed_stores?: unknown }

// 可打卡的門市：所屬門市、管理門市、今天班表上的門市
function storeCodes(emp: Emp, planStores: string[]) {
  return [...new Set([emp.store, ...(Array.isArray(emp.managed_stores) ? emp.managed_stores : []), ...planStores]
    .map(c => String(c ?? '').trim()).filter(Boolean))]
}

// 員工沒有指定門市（例如只有一個營業點的公司）→ 公司所有門市都可打卡
async function withFallback(admin: Admin, owner: string, codes: string[]) {
  if (codes.length) return codes
  const { data } = await admin.from('pnl_stores').select('code').eq('owner_id', owner).eq('archived', false)
  return (data ?? []).map(r => String(r.code))
}

// 員工專區：今天（含跨夜未下班）的打卡紀錄、近 7 天彙整、可打卡門市是否已設定定位
export async function punchStatus(admin: Admin, ownerId: string, emp: PunchEmp): Promise<Record<string, unknown>> {
  const company = { ownerId }
  const tz = await companyTz(admin, company.ownerId)
  const today = tzParts(new Date(), tz).date, from = addDays(today, -6)
  const [{ data: punches }, { data: plans }] = await Promise.all([
    admin.from('hr_punches').select('id, employee_id, store, work_date, kind, punched_at, distance_m')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).gte('work_date', from).order('punched_at'),
    admin.from('shift_plans').select('employee_id, store, work_date, start_min, end_min')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).eq('status', 'published').gte('work_date', from).lte('work_date', today),
  ])
  const codes = await withFallback(admin, company.ownerId, storeCodes(emp, (plans ?? []).filter(p => p.work_date === today).map(p => p.store)))
  const { data: stores } = codes.length
    ? await admin.from('pnl_stores').select('code, name, geo_lat, geo_lng, geo_radius_m').eq('owner_id', company.ownerId).in('code', codes)
    : { data: [] }
  const list = (punches ?? []) as PunchRow[]
  const last = list[list.length - 1]
  const openIn = last && last.kind === 'in' && Date.now() - Date.parse(last.punched_at) < OPEN_SHIFT_HOURS * 3600_000
  return {
    today, tz,
    next: openIn ? 'out' : 'in',
    punches: list.filter(p => p.work_date === today || (openIn && p.id === last.id)),
    days: summarize(list, (plans ?? []) as PlanRow[], tz).reverse(),
    stores: (stores ?? []).map(s => ({ code: s.code, name: s.name, ready: s.geo_lat != null && s.geo_lng != null, radius: s.geo_radius_m })),
  }
}

// 打卡。body: { lat, lng, accuracy }。伺服器判斷上班／下班，並只接受門市半徑內的位置
export async function doPunch(admin: Admin, ownerId: string, emp: PunchEmp, b: { lat?: unknown; lng?: unknown; accuracy?: unknown }): Promise<PunchResult> {
  const company = { ownerId }
  const lat = Number(b.lat), lng = Number(b.lng), accuracy = Number(b.accuracy)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return { status: 400, body: { error: 'Không lấy được vị trí / 無法取得定位' } }
  if (Number.isFinite(accuracy) && accuracy > MAX_ACCURACY_M)
    return { status: 400, body: { error: `Vị trí không chính xác (±${Math.round(accuracy)}m), hãy bật vị trí chính xác / 定位誤差太大（±${Math.round(accuracy)} 公尺），請開啟精確位置後再試` } }

  const tz = await companyTz(admin, company.ownerId)
  const now = new Date(), { date: today } = tzParts(now, tz)
  const { data: lastRows } = await admin.from('hr_punches').select('kind, work_date, store, punched_at')
    .eq('owner_id', company.ownerId).eq('employee_id', emp.id).order('punched_at', { ascending: false }).limit(1)
  const last = lastRows?.[0]
  if (last && now.getTime() - Date.parse(last.punched_at) < 60_000)
    return { status: 429, body: { error: 'Vừa chấm công rồi / 剛剛已打過卡' } }
  const isOut = !!last && last.kind === 'in' && now.getTime() - Date.parse(last.punched_at) < OPEN_SHIFT_HOURS * 3600_000
  const workDate = isOut ? last!.work_date : today

  const { data: plans } = await admin.from('shift_plans').select('store')
    .eq('owner_id', company.ownerId).eq('employee_id', emp.id).eq('status', 'published').eq('work_date', today)
  const codes = await withFallback(admin, company.ownerId, storeCodes(emp, (plans ?? []).map(p => p.store)))
  if (!codes.length) return { status: 400, body: { error: 'Chưa có cửa hàng / 尚未設定門市，請聯絡人事' } }
  const { data: stores } = await admin.from('pnl_stores').select('code, name, geo_lat, geo_lng, geo_radius_m')
    .eq('owner_id', company.ownerId).in('code', codes)
  const ready = (stores ?? []).filter(s => s.geo_lat != null && s.geo_lng != null)
  if (!ready.length) return { status: 400, body: { error: 'Cửa hàng chưa cài đặt vị trí chấm công / 門市尚未設定打卡定位，請聯絡店長' } }
  const ranked = ready.map(s => ({ s, d: distanceM(lat, lng, s.geo_lat as number, s.geo_lng as number) })).sort((x, y) => x.d - y.d)
  // 下班打卡優先同一門市
  const hit = (isOut ? ranked.find(r => r.s.code === last!.store && r.d <= (r.s.geo_radius_m ?? 150)) : null)
    ?? ranked.find(r => r.d <= (r.s.geo_radius_m ?? 150))
  if (!hit) {
    const n = ranked[0]
    return { status: 403, body: { error: `Ngoài phạm vi cửa hàng (cách ${Math.round(n.d)}m) / 不在門市範圍內（距離 ${n.s.name || n.s.code} ${Math.round(n.d)} 公尺，需在 ${n.s.geo_radius_m ?? 150} 公尺內）` } }
  }

  // 下班記在上班的門市（工時才算得到同一筆考勤）
  const row = {
    owner_id: company.ownerId, employee_id: emp.id, attendance_no: emp.attendance_no, store: isOut ? last!.store : hit.s.code,
    work_date: workDate, kind: isOut ? 'out' : 'in', punched_at: now.toISOString(),
    lat, lng, accuracy_m: Number.isFinite(accuracy) ? accuracy : null, distance_m: Math.round(hit.d),
  }
  const { error } = await admin.from('hr_punches').insert(row)
  if (error) return { status: 500, body: { error: error.message } }
  if (isOut) await syncMonthlyAttendance(admin, company.ownerId, { id: emp.id, name: emp.name, attendance_no: emp.attendance_no }, row.store, workDate)
  return { status: 200, body: { ok: true, kind: row.kind, store: hit.s.name || hit.s.code, distance: row.distance_m } }
}
