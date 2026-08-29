import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listDates } from '@/lib/shift/util'

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
  if (period.status === 'confirmed') return NextResponse.json({ error: '此排班已確認，無法再修改' }, { status: 409 })

  const validDates = new Set(listDates(period.start_date, period.end_date))
  const validSlots = new Set((Array.isArray(period.slots) ? period.slots : []).map((x: { code: string }) => x.code))
  const body = await req.json().catch(() => ({}))
  const picks = Array.isArray(body.selected) ? body.selected : []
  const rows: { owner_id: string; period_id: string; employee_id: string; work_date: string; slot_code: string }[] = []
  const seen = new Set<string>()
  for (const p of picks) {
    const [d, slot] = String(p).split('|')
    if (!validDates.has(d) || !validSlots.has(slot) || seen.has(`${d}|${slot}`)) continue
    seen.add(`${d}|${slot}`)
    rows.push({ owner_id: tok.owner_id, period_id: period.id, employee_id: tok.employee_id, work_date: d, slot_code: slot })
  }

  // 整份覆寫：先刪自己的、再插入
  await admin.from('shift_availability').delete().eq('period_id', period.id).eq('employee_id', tok.employee_id)
  if (rows.length > 0) {
    const { error } = await admin.from('shift_availability').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await admin.from('shift_tokens').update({ submitted_at: new Date().toISOString() }).eq('token', token)
  return NextResponse.json({ ok: true, saved: rows.length })
}
