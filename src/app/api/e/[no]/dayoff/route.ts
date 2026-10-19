import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { todayVN } from '@/lib/shift/rules'
import { addDays, isDate } from '@/lib/shift/time'

type Ctx = { params: Promise<{ no: string }> }
const MAX_AHEAD = 92

// 正職員工切換期待休假日：已選則取消，未選則新增。body: { date: "YYYY-MM-DD", note? }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  const b = await req.json().catch(() => ({}))
  const date = String(b.date ?? '')
  const today = todayVN()
  if (!isDate(date) || date < today || date > addDays(today, MAX_AHEAD)) {
    return NextResponse.json({ error: `Chỉ chọn được trong ${MAX_AHEAD} ngày tới / 只能選今天起 ${MAX_AHEAD} 天內` }, { status: 400 })
  }
  const { data: cur } = await admin.from('shift_dayoff_requests').select('id')
    .eq('owner_id', company.ownerId).eq('employee_id', emp.id).eq('off_date', date).maybeSingle()
  if (cur) {
    await admin.from('shift_dayoff_requests').delete().eq('id', cur.id)
    return NextResponse.json({ ok: true, selected: false })
  }
  const { error } = await admin.from('shift_dayoff_requests').insert({
    owner_id: company.ownerId, employee_id: emp.id, store: emp.store ?? '', off_date: date, note: String(b.note ?? '').slice(0, 200),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, selected: true })
}
