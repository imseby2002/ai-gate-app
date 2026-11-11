/**
 * 排班總表審核請假（門市單位／門市領班，限可管理的門市員工）
 * PATCH /api/shift/leave  body: { id, status: 'approved' | 'rejected', notes? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'

export async function PATCH(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? ''), status = String(b.status ?? '')
  if (!id || !['approved', 'rejected'].includes(status)) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { data: lv } = await ctx.admin.from('hr_leave_requests').select('id, employee_id, notes').eq('id', id).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!lv) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data: emp } = await ctx.admin.from('hr_employees').select('store, managed_stores').eq('id', lv.employee_id).eq('owner_id', ctx.ownerId).maybeSingle()
  const stores = [emp?.store, ...((emp?.managed_stores as string[] | null) ?? [])].filter((s): s is string => !!s)
  if (!stores.some(s => storeAllowed(ctx, s))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const note = String(b.notes ?? '').trim().slice(0, 300)
  const { error } = await ctx.admin.from('hr_leave_requests').update({
    status, reviewed_at: new Date().toISOString(),
    ...(note ? { notes: [lv.notes, note].filter(Boolean).join('\n') } : {}),
  }).eq('id', id).eq('owner_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
