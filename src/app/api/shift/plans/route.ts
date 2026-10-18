import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { isDate, SLOT_MIN } from '@/lib/shift/time'
import type { UnitContext } from '@/lib/auth/unit-access'

const validMin = (v: number) => Number.isInteger(v) && v >= 0 && v <= 1440 && v % SLOT_MIN === 0
const deny = (ctx: UnitContext) => NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })

async function overlap(ctx: UnitContext, employeeId: string, date: string, start: number, end: number, exceptId?: string) {
  let q = ctx.admin.from('shift_plans').select('id, store, start_min, end_min').eq('owner_id', ctx.ownerId).eq('employee_id', employeeId).eq('work_date', date)
  if (exceptId) q = q.neq('id', exceptId)
  const { data } = await q
  return (data ?? []).find(p => p.start_min < end && p.end_min > start) ?? null
}

// 新增班。body: { store, employee_id, work_date, start_min, end_min }
export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim(), employee_id = String(b.employee_id ?? ''), work_date = String(b.work_date ?? '')
  const start_min = Number(b.start_min), end_min = Number(b.end_min)
  if (!store || !employee_id || !isDate(work_date) || !validMin(start_min) || !validMin(end_min) || end_min <= start_min) {
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  }
  if (!storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: emp } = await ctx.admin.from('hr_employees').select('id').eq('id', employee_id).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!emp) return NextResponse.json({ error: '查無此員工' }, { status: 404 })
  const clash = await overlap(ctx, employee_id, work_date, start_min, end_min)
  if (clash) return NextResponse.json({ error: clash.store === store ? '與此員工當天其他班重疊' : `此員工當天已排在 ${clash.store}` }, { status: 409 })
  const { data, error } = await ctx.admin.from('shift_plans')
    .insert({ owner_id: ctx.ownerId, store, employee_id, work_date, start_min, end_min, status: 'draft' }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

// 調整班的時間（調整後變回草稿，需重新發布）。body: { id, start_min, end_min }
export async function PATCH(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const b = await req.json().catch(() => ({}))
  const start_min = Number(b.start_min), end_min = Number(b.end_min)
  if (!b.id || !validMin(start_min) || !validMin(end_min) || end_min <= start_min) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  const { data: cur } = await ctx.admin.from('shift_plans').select('id, store, employee_id, work_date').eq('id', String(b.id)).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!cur || !storeAllowed(ctx, cur.store)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const clash = await overlap(ctx, cur.employee_id, cur.work_date, start_min, end_min, cur.id)
  if (clash) return NextResponse.json({ error: '與此員工當天其他班重疊' }, { status: 409 })
  const { data, error } = await ctx.admin.from('shift_plans')
    .update({ start_min, end_min, status: 'draft', updated_at: new Date().toISOString() }).eq('id', cur.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

// 刪除班。body: { id }
export async function DELETE(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return deny(ctx)
  const { id } = await req.json().catch(() => ({}))
  const { data: cur } = await ctx.admin.from('shift_plans').select('id, store').eq('id', String(id ?? '')).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!cur || !storeAllowed(ctx, cur.store)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { error } = await ctx.admin.from('shift_plans').delete().eq('id', cur.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
