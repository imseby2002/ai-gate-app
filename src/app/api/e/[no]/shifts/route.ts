import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { insertRule, parseRule, todayVN } from '@/lib/shift/rules'
import { addDays, isDate } from '@/lib/shift/time'
import { isFulltime } from '@/lib/shift/staff'

type Ctx = { params: Promise<{ no: string }> }

// 員工專區：工讀生的可上班時段規則、正職的期待休假日（尚未過去的），以及已發布的班表（今天起 60 天）
export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  const kind = isFulltime(emp) ? 'fulltime' : 'parttime'
  const today = todayVN()
  const [{ data: rules }, { data: plans }, { data: dayoffs }] = await Promise.all([
    admin.from('shift_avail_rules').select('id, start_date, end_date, weekdays, start_min, end_min, note')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).gte('end_date', today).order('start_date'),
    admin.from('shift_plans').select('id, store, work_date, start_min, end_min')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).eq('status', 'published')
      .gte('work_date', today).lte('work_date', addDays(today, 60)).order('work_date').order('start_min'),
    admin.from('shift_dayoff_requests').select('id, off_date, note')
      .eq('owner_id', company.ownerId).eq('employee_id', emp.id).gte('off_date', today).order('off_date'),
  ])
  return NextResponse.json({ store: emp.store || null, kind, rules: rules ?? [], plans: plans ?? [], dayoffs: dayoffs ?? [] })
}

// 新增可上班時段（每週固定）。body: { start_date, end_date, weekdays: number[]（空＝每天）, start, end, note? }
// 或一次多段：{ start_date, end_date, weekdays, ranges: [{ start: "HH:MM", end: "HH:MM" }] }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  if (!emp.store) return NextResponse.json({ error: 'Chưa có cửa hàng / 尚未設定門市，請聯絡人事' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  if (!Array.isArray(b.ranges)) {
    const r = await insertRule(admin, company.ownerId, emp.id, emp.store, b)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ rule: r.rule })
  }
  const rows = []
  for (const g of (b.ranges as Record<string, unknown>[]).slice(0, 24)) {
    const p = parseRule({ ...b, start: g.start, end: g.end })
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 })
    rows.push({ owner_id: company.ownerId, employee_id: emp.id, store: emp.store, ...p.rule })
  }
  if (rows.length === 0) return NextResponse.json({ error: 'Chưa chọn giờ / 請先點選時段' }, { status: 400 })
  const { error } = await admin.from('shift_avail_rules').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: rows.length })
}

// 指定日期的可上班時段（覆蓋這些日期原本的單日設定；每週固定的規則不受影響）。
// body: { dates: ["YYYY-MM-DD"], ranges: [{ start, end }]（空＝這些日期不填） }
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin, company, emp } = ctx
  if (!emp.store) return NextResponse.json({ error: 'Chưa có cửa hàng / 尚未設定門市，請聯絡人事' }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  const today = todayVN(), limit = addDays(today, 92)
  const dates = [...new Set((Array.isArray(b.dates) ? b.dates : []).filter(isDate) as string[])].filter(d => d >= today && d <= limit).slice(0, 92) as string[]
  if (dates.length === 0) return NextResponse.json({ error: 'Chưa chọn ngày / 請先選擇日期' }, { status: 400 })
  const rows = []
  for (const d of dates) {
    for (const g of (Array.isArray(b.ranges) ? b.ranges as Record<string, unknown>[] : []).slice(0, 24)) {
      const p = parseRule({ start_date: d, end_date: d, weekdays: [], start: g.start, end: g.end })
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 })
      rows.push({ owner_id: company.ownerId, employee_id: emp.id, store: emp.store, ...p.rule })
    }
  }
  const { data: old } = await admin.from('shift_avail_rules').select('id, start_date, end_date')
    .eq('owner_id', company.ownerId).eq('employee_id', emp.id).in('start_date', dates)
  const oldIds = (old ?? []).filter(r => r.start_date === r.end_date).map(r => r.id)
  if (oldIds.length) {
    const { error: delErr } = await admin.from('shift_avail_rules').delete().in('id', oldIds)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }
  if (rows.length) {
    const { error } = await admin.from('shift_avail_rules').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ saved: rows.length })
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
