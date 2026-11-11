/**
 * 員工專區請假申請（原本要上班的日子請假）→ 寫入請假系統 hr_leave_requests（待審核），排班會避開
 * GET    — 自己近期的請假（含已核准、待審核、已駁回）
 * POST   — { leave_type, start_date, end_date, reason } 送出申請
 * DELETE — { id } 撤回尚未審核的申請
 */
import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { todayVN } from '@/lib/shift/rules'
import { addDays, isDate } from '@/lib/shift/time'
import { LEAVE_TYPES, leaveDays } from '@/lib/shift/leave'

type Ctx = { params: Promise<{ no: string }> }
const MAX_AHEAD = 180

export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await ctx.admin.from('hr_leave_requests')
    .select('id, leave_type, start_date, end_date, days, reason, status, created_at')
    .eq('owner_id', ctx.company.ownerId).eq('employee_id', ctx.emp.id)
    .gte('end_date', addDays(todayVN(), -60)).order('start_date', { ascending: false }).limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leaves: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const start = String(b.start_date ?? ''), end = String(b.end_date || b.start_date || '')
  const type = (LEAVE_TYPES as readonly string[]).includes(String(b.leave_type)) ? String(b.leave_type) : 'personal'
  const today = todayVN()
  if (!isDate(start) || !isDate(end) || end < start) return NextResponse.json({ error: 'Ngày không hợp lệ / 日期不正確' }, { status: 400 })
  if (start < addDays(today, -7) || end > addDays(today, MAX_AHEAD)) return NextResponse.json({ error: `Chỉ xin nghỉ trong ${MAX_AHEAD} ngày tới / 只能申請 ${MAX_AHEAD} 天內` }, { status: 400 })
  if (leaveDays(start, end) > 31) return NextResponse.json({ error: 'Tối đa 31 ngày / 一次最多 31 天' }, { status: 400 })
  const reason = String(b.reason ?? '').trim().slice(0, 300)
  if (!reason) return NextResponse.json({ error: 'Vui lòng nhập lý do / 請填寫事由' }, { status: 400 })

  // 同一期間已有待審核或已核准的請假就不重複建立
  const { data: dup } = await ctx.admin.from('hr_leave_requests').select('id')
    .eq('owner_id', ctx.company.ownerId).eq('employee_id', ctx.emp.id).in('status', ['pending', 'approved'])
    .lte('start_date', end).gte('end_date', start).limit(1)
  if (dup?.length) return NextResponse.json({ error: 'Đã có đơn nghỉ trùng ngày / 這段期間已有請假申請' }, { status: 409 })

  const { error } = await ctx.admin.from('hr_leave_requests').insert({
    owner_id: ctx.company.ownerId, employee_id: ctx.emp.id, leave_type: type,
    start_date: start, end_date: end, days: leaveDays(start, end), reason, status: 'pending', notes: '員工專區申請',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error, count } = await ctx.admin.from('hr_leave_requests').delete({ count: 'exact' })
    .eq('id', id).eq('owner_id', ctx.company.ownerId).eq('employee_id', ctx.emp.id).eq('status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'Đơn đã được duyệt, không thể rút / 已審核，無法撤回' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
