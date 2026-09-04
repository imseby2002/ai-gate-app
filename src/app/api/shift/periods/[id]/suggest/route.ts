import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { listDates, sanitizeSlots } from '@/lib/shift/util'
import { computeSuggestion, type AvailRow } from '@/lib/shift/suggest'

type Ctx = { params: Promise<{ id: string }> }

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// 產生自動排班建議：覆寫該期別的 shift_assignments，並將狀態設為 suggested。
// body: { need?（每格需要人數，預設 1） }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await params
  const { data: period } = await supabase.from('shift_periods')
    .select('start_date, end_date, slots, status').eq('id', id).eq('owner_id', user.id).single()
  if (!period) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (period.status === 'confirmed') return NextResponse.json({ error: '此排班已確認，無法重新建議' }, { status: 409 })

  const b = await req.json().catch(() => ({}))
  const need = Math.max(1, parseInt(String(b.need)) || 1)

  const { data: avail } = await supabase.from('shift_availability')
    .select('employee_id, work_date, slot_code').eq('owner_id', user.id).eq('period_id', id)
  const dates = listDates(period.start_date, period.end_date)
  const slots = sanitizeSlots(period.slots)
  const picks = computeSuggestion(dates, slots, (avail ?? []) as AvailRow[], need)

  await supabase.from('shift_assignments').delete().eq('owner_id', user.id).eq('period_id', id)
  if (picks.length > 0) {
    const rows = picks.map(p => ({ owner_id: user.id, period_id: id, ...p }))
    const { error } = await supabase.from('shift_assignments').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await supabase.from('shift_periods').update({ status: 'suggested', updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id)
  return NextResponse.json({ ok: true, assigned: picks.length })
}
