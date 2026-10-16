import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listDates } from '@/lib/shift/util'
import { saveAvailability } from '@/lib/shift/availability'

type Ctx = { params: Promise<{ token: string }> }
type Admin = ReturnType<typeof createAdminClient>

async function resolve(admin: Admin, token: string) {
  const { data: tok } = await admin.from('shift_tokens')
    .select('owner_id, period_id, employee_id, employee_name, submitted_at').eq('token', token).single()
  if (!tok) return null
  const { data: period } = await admin.from('shift_periods')
    .select('id, store, title, start_date, end_date, slots, status').eq('id', tok.period_id).single()
  if (!period) return null
  return { tok, period }
}

// 員工以 token 讀取：期別、日期、時段、自己目前已勾選的可上班。
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const r = await resolve(admin, token)
  if (!r) return NextResponse.json({ error: '連結無效' }, { status: 404 })
  const { tok, period } = r
  const { data: avail } = await admin.from('shift_availability')
    .select('work_date, slot_code').eq('period_id', period.id).eq('employee_id', tok.employee_id)
  return NextResponse.json({
    employee_name: tok.employee_name,
    period: { title: period.title, store: period.store, start_date: period.start_date, end_date: period.end_date, slots: period.slots, status: period.status },
    dates: listDates(period.start_date, period.end_date),
    selected: (avail ?? []).map(a => `${a.work_date}|${a.slot_code}`),
    submitted_at: tok.submitted_at,
  })
}

// 員工送出可上班（整份覆寫）。body: { selected: ["YYYY-MM-DD|slot", ...] }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params
  const admin = createAdminClient()
  const r = await resolve(admin, token)
  if (!r) return NextResponse.json({ error: '連結無效' }, { status: 404 })
  const { tok, period } = r
  const body = await req.json().catch(() => ({}))
  const res = await saveAvailability(admin, period, tok.owner_id, tok.employee_id, body.selected)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  await admin.from('shift_tokens').update({ submitted_at: new Date().toISOString() }).eq('token', token)
  return NextResponse.json({ ok: true, saved: res.saved })
}
