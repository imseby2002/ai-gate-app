import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { listDates } from '@/lib/shift/util'

type Ctx = { params: Promise<{ id: string }> }

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}
const s = (v: unknown) => String(v ?? '').trim()

// 排班期明細：期別、員工（含填報連結與是否已交）、日期、可上班彙整。
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { data: period } = await supabase.from('shift_periods')
    .select('id, store, title, start_date, end_date, slots, status').eq('id', id).eq('owner_id', user.id).single()
  if (!period) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const [{ data: tokens }, { data: avail }, { data: assigns }] = await Promise.all([
    supabase.from('shift_tokens').select('employee_id, employee_name, token, submitted_at').eq('owner_id', user.id).eq('period_id', id),
    supabase.from('shift_availability').select('employee_id, work_date, slot_code').eq('owner_id', user.id).eq('period_id', id),
    supabase.from('shift_assignments').select('employee_id, work_date, slot_code').eq('owner_id', user.id).eq('period_id', id),
  ])
  return NextResponse.json({
    period, dates: listDates(period.start_date, period.end_date),
    employees: tokens ?? [], availability: avail ?? [], assignments: assigns ?? [],
  })
}

// 更新期別（標題／狀態）。body: { title?, status? }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.title !== undefined) upd.title = s(b.title)
  if (b.status !== undefined && ['collecting', 'suggested', 'confirmed'].includes(s(b.status))) upd.status = s(b.status)
  const { error } = await supabase.from('shift_periods').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
