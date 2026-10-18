import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { insertRule } from '@/lib/shift/rules'

// 店長代員工填可上班時段（員工沒用員工專區時）。body: { store, employee_id, start_date, end_date, weekdays, start, end, note? }
export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  if (!store || !storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: emp } = await ctx.admin.from('hr_employees').select('id').eq('id', String(b.employee_id ?? '')).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!emp) return NextResponse.json({ error: '查無此員工' }, { status: 404 })
  const r = await insertRule(ctx.admin, ctx.ownerId, emp.id, store, b)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ rule: r.rule })
}

// 刪除一條可上班規則。body: { id }
export async function DELETE(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const { id } = await req.json().catch(() => ({}))
  const { data: cur } = await ctx.admin.from('shift_avail_rules').select('id, store').eq('id', String(id ?? '')).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!cur || !storeAllowed(ctx, cur.store)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await ctx.admin.from('shift_avail_rules').delete().eq('id', cur.id)
  return NextResponse.json({ ok: true })
}
