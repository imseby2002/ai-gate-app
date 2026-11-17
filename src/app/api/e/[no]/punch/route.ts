import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { addDays } from '@/lib/shift/time'
import { MAX_ACCURACY_M, OPEN_SHIFT_HOURS, distanceM, summarize, syncMonthlyAttendance, vnParts, type PlanRow, type PunchRow } from '@/lib/hr/punch'

type Ctx = { params: Promise<{ no: string }> }
type Emp = { store?: string | null; managed_stores?: unknown }

// 可打卡的門市：所屬門市、管理門市、今天班表上的門市
function storeCodes(emp: Emp, planStores: string[]) {
  return [...new Set([emp.store, ...(Array.isArray(emp.managed_stores) ? emp.managed_stores : []), ...planStores]
    .map(c => String(c ?? '').trim()).filter(Boolean))]
}

// 員工專區：今天（含跨夜未下班）的打卡紀錄、近 7 天彙整、可打卡門市是否已設定定位
export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  const today = vnParts(new Date()).date, from = addDays(today, -6)
  const [{ data: punches }, { data: plans }] = await Promise.all([
    admin.from('hr_punches').select('id, employee_id, store, work_date, kind, punched_at, distance_m')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).gte('work_date', from).order('punched_at'),
    admin.from('shift_plans').select('employee_id, store, work_date, start_min, end_min')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).eq('status', 'published').gte('work_date', from).lte('work_date', today),
  ])
  const codes = storeCodes(emp, (plans ?? []).filter(p => p.work_date === today).map(p => p.store))
  const { data: stores } = codes.length
    ? await admin.from('pnl_stores').select('code, name, geo_lat, geo_lng, geo_radius_m').eq('owner_id', company.ownerId).in('code', codes)
    : { data: [] }
  const list = (punches ?? []) as PunchRow[]
  const last = list[list.length - 1]
  const openIn = last && last.kind === 'in' && Date.now() - Date.parse(last.punched_at) < OPEN_SHIFT_HOURS * 3600_000
  return NextResponse.json({
    today,
    next: openIn ? 'out' : 'in',
    punches: list.filter(p => p.work_date === today || (openIn && p.id === last.id)),
    days: summarize(list, (plans ?? []) as PlanRow[]).reverse(),
    stores: (stores ?? []).map(s => ({ code: s.code, name: s.name, ready: s.geo_lat != null && s.geo_lng != null, radius: s.geo_radius_m })),
  })
}

// 打卡。body: { lat, lng, accuracy }。伺服器判斷上班／下班，並只接受門市半徑內的位置
export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  const b = await req.json().catch(() => ({}))
  const lat = Number(b.lat), lng = Number(b.lng), accuracy = Number(b.accuracy)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return NextResponse.json({ error: 'Không lấy được vị trí / 無法取得定位' }, { status: 400 })
  if (Number.isFinite(accuracy) && accuracy > MAX_ACCURACY_M)
    return NextResponse.json({ error: `Vị trí không chính xác (±${Math.round(accuracy)}m), hãy bật vị trí chính xác / 定位誤差太大（±${Math.round(accuracy)} 公尺），請開啟精確位置後再試` }, { status: 400 })

  const now = new Date(), { date: today } = vnParts(now)
  const { data: lastRows } = await admin.from('hr_punches').select('kind, work_date, store, punched_at')
    .eq('owner_id', company.ownerId).eq('employee_id', emp.id).order('punched_at', { ascending: false }).limit(1)
  const last = lastRows?.[0]
  if (last && now.getTime() - Date.parse(last.punched_at) < 60_000)
    return NextResponse.json({ error: 'Vừa chấm công rồi / 剛剛已打過卡' }, { status: 429 })
  const isOut = !!last && last.kind === 'in' && now.getTime() - Date.parse(last.punched_at) < OPEN_SHIFT_HOURS * 3600_000
  const workDate = isOut ? last!.work_date : today

  const { data: plans } = await admin.from('shift_plans').select('store')
    .eq('owner_id', company.ownerId).eq('employee_id', emp.id).eq('status', 'published').eq('work_date', today)
  const codes = storeCodes(emp, (plans ?? []).map(p => p.store))
  if (!codes.length) return NextResponse.json({ error: 'Chưa có cửa hàng / 尚未設定門市，請聯絡人事' }, { status: 400 })
  const { data: stores } = await admin.from('pnl_stores').select('code, name, geo_lat, geo_lng, geo_radius_m')
    .eq('owner_id', company.ownerId).in('code', codes)
  const ready = (stores ?? []).filter(s => s.geo_lat != null && s.geo_lng != null)
  if (!ready.length) return NextResponse.json({ error: 'Cửa hàng chưa cài đặt vị trí chấm công / 門市尚未設定打卡定位，請聯絡店長' }, { status: 400 })
  const ranked = ready.map(s => ({ s, d: distanceM(lat, lng, s.geo_lat as number, s.geo_lng as number) })).sort((x, y) => x.d - y.d)
  // 下班打卡優先同一門市
  const hit = (isOut ? ranked.find(r => r.s.code === last!.store && r.d <= (r.s.geo_radius_m ?? 150)) : null)
    ?? ranked.find(r => r.d <= (r.s.geo_radius_m ?? 150))
  if (!hit) {
    const n = ranked[0]
    return NextResponse.json({ error: `Ngoài phạm vi cửa hàng (cách ${Math.round(n.d)}m) / 不在門市範圍內（距離 ${n.s.name || n.s.code} ${Math.round(n.d)} 公尺，需在 ${n.s.geo_radius_m ?? 150} 公尺內）` }, { status: 403 })
  }

  // 下班記在上班的門市（工時才算得到同一筆考勤）
  const row = {
    owner_id: company.ownerId, employee_id: emp.id, attendance_no: emp.attendance_no, store: isOut ? last!.store : hit.s.code,
    work_date: workDate, kind: isOut ? 'out' : 'in', punched_at: now.toISOString(),
    lat, lng, accuracy_m: Number.isFinite(accuracy) ? accuracy : null, distance_m: Math.round(hit.d),
  }
  const { error } = await admin.from('hr_punches').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (isOut) await syncMonthlyAttendance(admin, company.ownerId, { id: emp.id, name: emp.name, attendance_no: emp.attendance_no }, row.store, workDate)
  return NextResponse.json({ ok: true, kind: row.kind, store: hit.s.name || hit.s.code, distance: row.distance_m })
}
