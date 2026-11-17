/**
 * 門市 GPS 打卡管理
 * GET /api/shift/punch?store=&from=&to=  → { geo, rows: 每人每日彙整（工時、遲到、早退）, punches }
 * PUT /api/shift/punch  body: { store, lat, lng, radius }  設定門市打卡定位（lat/lng 為 null 則清除）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { isDate } from '@/lib/shift/time'
import { summarize, vnParts, type PlanRow, type PunchRow } from '@/lib/hr/punch'
import type { UnitContext } from '@/lib/auth/unit-access'

const deny = (ctx: UnitContext) => NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

export async function GET(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const sp = req.nextUrl.searchParams
  const store = (sp.get('store') ?? '').trim()
  if (!store || !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const today = vnParts(new Date()).date
  const from = isDate(sp.get('from')) ? sp.get('from')! : today
  const to = isDate(sp.get('to')) ? sp.get('to')! : from
  const [{ data: geo }, { data: punches }, { data: plans }] = await Promise.all([
    ctx.admin.from('pnl_stores').select('code, name, geo_lat, geo_lng, geo_radius_m').eq('owner_id', ctx.ownerId).eq('code', store).maybeSingle(),
    ctx.admin.from('hr_punches').select('id, employee_id, store, work_date, kind, punched_at, distance_m')
      .eq('owner_id', ctx.ownerId).eq('store', store).gte('work_date', from).lte('work_date', to).order('punched_at'),
    ctx.admin.from('shift_plans').select('employee_id, work_date, start_min, end_min')
      .eq('owner_id', ctx.ownerId).eq('store', store).eq('status', 'published').gte('work_date', from).lte('work_date', to),
  ])
  const list = (punches ?? []) as PunchRow[]
  const days = summarize(list, (plans ?? []) as PlanRow[])
  // 有排班但沒打卡＝缺卡
  const punched = new Set(days.map(d => `${d.employee_id}|${d.work_date}`))
  const missing = new Map<string, PlanRow[]>()
  for (const p of (plans ?? []) as PlanRow[]) {
    const k = `${p.employee_id}|${p.work_date}`
    if (punched.has(k) || p.work_date > today) continue
    if (!missing.has(k)) missing.set(k, [])
    missing.get(k)!.push(p)
  }
  const ids = [...new Set([...days.map(d => d.employee_id), ...[...missing.values()].map(v => v[0].employee_id)])]
  const { data: emps } = ids.length
    ? await ctx.admin.from('hr_employees').select('id, name, attendance_no').eq('owner_id', ctx.ownerId).in('id', ids)
    : { data: [] }
  const nameOf = new Map((emps ?? []).map(e => [e.id, `${e.name}${e.attendance_no ? `（${e.attendance_no}）` : ''}`]))
  const rows = [
    ...days.map(d => ({ ...d, name: nameOf.get(d.employee_id) ?? '', absent: false })),
    ...[...missing.values()].map(v => ({
      employee_id: v[0].employee_id, work_date: v[0].work_date, store, name: nameOf.get(v[0].employee_id) ?? '',
      firstIn: null, lastOut: null, minutes: 0, open: false, absent: true,
      planStart: Math.min(...v.map(p => p.start_min)), planEnd: Math.max(...v.map(p => p.end_min)), lateMin: 0, earlyMin: 0,
    })),
  ].sort((a, b) => b.work_date.localeCompare(a.work_date) || a.name.localeCompare(b.name))
  return NextResponse.json({ geo: geo ?? null, rows })
}

export async function PUT(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store || !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const clear = b.lat == null && b.lng == null
  const lat = Number(b.lat), lng = Number(b.lng)
  const radius = Math.round(Number(b.radius) || 150)
  if (!clear && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180))
    return NextResponse.json({ error: '座標格式錯誤' }, { status: 400 })
  if (radius < 30 || radius > 2000) return NextResponse.json({ error: '半徑需介於 30～2000 公尺' }, { status: 400 })
  const { data, error } = await ctx.admin.from('pnl_stores')
    .update({ geo_lat: clear ? null : lat, geo_lng: clear ? null : lng, geo_radius_m: radius, updated_at: new Date().toISOString() })
    .eq('owner_id', ctx.ownerId).eq('code', store).select('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: '門市主檔找不到這個門市代碼，請先到損益表門市設定新增' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
