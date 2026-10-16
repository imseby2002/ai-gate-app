import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { listDates } from '@/lib/shift/util'
import { saveAvailability } from '@/lib/shift/availability'

type Ctx = { params: Promise<{ no: string }> }
const today = () => new Date().toISOString().slice(0, 10)

// 工讀生（part-time）在員工專區填可上班時段：列出本店尚未結束的排班期、自己的勾選與已排班別
export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  if (emp.employment_type !== 'part-time' || !emp.store) return NextResponse.json({ partTime: false, periods: [] })

  const { data: periods } = await admin.from('shift_periods')
    .select('id, title, start_date, end_date, slots, status')
    .eq('owner_id', company.ownerId).eq('store', emp.store).gte('end_date', today())
    .order('start_date')
  const ids = (periods ?? []).map(p => p.id)
  const [{ data: avail }, { data: assigns }] = ids.length
    ? await Promise.all([
      admin.from('shift_availability').select('period_id, work_date, slot_code').in('period_id', ids).eq('employee_id', emp.id),
      admin.from('shift_assignments').select('period_id, work_date, slot_code').in('period_id', ids).eq('employee_id', emp.id),
    ])
    : [{ data: [] }, { data: [] }]

  return NextResponse.json({
    partTime: true,
    store: emp.store,
    periods: (periods ?? []).map(p => ({
      ...p,
      dates: listDates(p.start_date, p.end_date),
      selected: (avail ?? []).filter(a => a.period_id === p.id).map(a => `${a.work_date}|${a.slot_code}`),
      assigned: p.status === 'confirmed'
        ? (assigns ?? []).filter(a => a.period_id === p.id).map(a => `${a.work_date}|${a.slot_code}`)
        : [],
    })),
  })
}

// 送出某排班期的可上班時段（整份覆寫）。body: { period_id, selected: ["YYYY-MM-DD|slot", ...] }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  if (emp.employment_type !== 'part-time' || !emp.store) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { data: period } = await admin.from('shift_periods')
    .select('id, start_date, end_date, slots, status')
    .eq('id', String(body.period_id ?? '')).eq('owner_id', company.ownerId).eq('store', emp.store).maybeSingle()
  if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const res = await saveAvailability(admin, period, company.ownerId, emp.id, body.selected)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  // 排班期建立後才入職的工讀生沒有填報紀錄，補一筆讓店長看得到已交
  const now = new Date().toISOString()
  const { data: tok } = await admin.from('shift_tokens').select('id').eq('period_id', period.id).eq('employee_id', emp.id).limit(1).maybeSingle()
  if (tok) await admin.from('shift_tokens').update({ submitted_at: now }).eq('id', tok.id)
  else await admin.from('shift_tokens').insert({
    owner_id: company.ownerId, period_id: period.id, employee_id: emp.id, employee_name: emp.name ?? '',
    token: randomBytes(18).toString('base64url'), submitted_at: now,
  })
  return NextResponse.json({ ok: true, saved: res.saved })
}
