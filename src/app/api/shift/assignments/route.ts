import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
const dateOrNull = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }

async function periodEditable(supabase: Awaited<ReturnType<typeof getAdminUser>>['supabase'], ownerId: string, periodId: string) {
  const { data } = await supabase.from('shift_periods').select('status').eq('id', periodId).eq('owner_id', ownerId).single()
  return data && data.status !== 'confirmed'
}

// 手動加一個指派。body: { period_id, employee_id, work_date, slot_code }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const period_id = s(b.period_id), employee_id = s(b.employee_id), slot_code = s(b.slot_code)
  const work_date = dateOrNull(b.work_date)
  if (!period_id || !employee_id || !slot_code || !work_date) return NextResponse.json({ error: '參數不足' }, { status: 400 })
  if (!(await periodEditable(supabase, user.id, period_id))) return NextResponse.json({ error: '此排班已確認，無法調整' }, { status: 409 })
  const { error } = await supabase.from('shift_assignments')
    .upsert({ owner_id: user.id, period_id, employee_id, work_date, slot_code }, { onConflict: 'period_id,employee_id,work_date,slot_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 移除一個指派。body: { period_id, employee_id, work_date, slot_code }
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const period_id = s(b.period_id), employee_id = s(b.employee_id), slot_code = s(b.slot_code)
  const work_date = dateOrNull(b.work_date)
  if (!period_id || !employee_id || !slot_code || !work_date) return NextResponse.json({ error: '參數不足' }, { status: 400 })
  if (!(await periodEditable(supabase, user.id, period_id))) return NextResponse.json({ error: '此排班已確認，無法調整' }, { status: 409 })
  const { error } = await supabase.from('shift_assignments').delete()
    .eq('owner_id', user.id).eq('period_id', period_id).eq('employee_id', employee_id).eq('work_date', work_date).eq('slot_code', slot_code)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
