/**
 * 店長／領班代正職員工設定或取消期待休假日
 * POST /api/shift/dayoff  body: { store, employee_id, date }（已選則取消，未選則新增）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { isDate } from '@/lib/shift/time'

export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim(), employee_id = String(b.employee_id ?? ''), date = String(b.date ?? '')
  if (!store || !employee_id || !isDate(date)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  if (!storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: emp } = await ctx.admin.from('hr_employees').select('id').eq('id', employee_id).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!emp) return NextResponse.json({ error: '查無此員工' }, { status: 404 })

  const { data: cur } = await ctx.admin.from('shift_dayoff_requests').select('id')
    .eq('owner_id', ctx.ownerId).eq('employee_id', employee_id).eq('off_date', date).maybeSingle()
  if (cur) {
    await ctx.admin.from('shift_dayoff_requests').delete().eq('id', cur.id)
    return NextResponse.json({ ok: true, selected: false })
  }
  const { error } = await ctx.admin.from('shift_dayoff_requests').insert({ owner_id: ctx.ownerId, employee_id, store, off_date: date, note: '店長代設' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, selected: true })
}
