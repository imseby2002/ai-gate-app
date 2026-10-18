import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { insertRule, todayVN } from '@/lib/shift/rules'
import { addDays } from '@/lib/shift/time'

type Ctx = { params: Promise<{ no: string }> }

// 員工專區：自己的可上班時段規則（尚未結束的）與已發布的班表（今天起 60 天）
export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  if (!emp.store) return NextResponse.json({ store: null, rules: [], plans: [] })
  const today = todayVN()
  const [{ data: rules }, { data: plans }] = await Promise.all([
    admin.from('shift_avail_rules').select('id, start_date, end_date, weekdays, start_min, end_min, note')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).gte('end_date', today).order('start_date'),
    admin.from('shift_plans').select('id, store, work_date, start_min, end_min')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).eq('status', 'published')
      .gte('work_date', today).lte('work_date', addDays(today, 60)).order('work_date').order('start_min'),
  ])
  return NextResponse.json({ store: emp.store, rules: rules ?? [], plans: plans ?? [] })
}

// 新增一條可上班時段。body: { start_date, end_date, weekdays: number[]（空＝每天）, start: "HH:MM", end: "HH:MM", note? }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  if (!emp.store) return NextResponse.json({ error: 'Chưa có cửa hàng / 尚未設定門市，請聯絡人事' }, { status: 400 })
  const r = await insertRule(admin, company.ownerId, emp.id, emp.store, await req.json().catch(() => ({})))
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ rule: r.rule })
}

// 刪除自己的一條規則。body: { id }
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  const { error } = await ctx.admin.from('shift_avail_rules').delete()
    .eq('id', String(id ?? '')).eq('employee_id', ctx.emp.id).eq('owner_id', ctx.company.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
