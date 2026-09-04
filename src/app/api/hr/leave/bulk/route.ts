import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getHrUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const LEAVE_TYPES = new Set(['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other'])
const LEAVE_TYPE_MAP: Record<string, string> = {
  '特休': 'annual', '年假': 'annual', '事假': 'personal', '病假': 'sick', '產假': 'maternity', '陪產假': 'paternity', '無薪假': 'unpaid', '其他': 'other',
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getHrUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  const { data: emps } = await supabase
    .from('hr_employees')
    .select('id, name, attendance_no')
    .eq('owner_id', user.id)

  const empList = emps || []
  const toInsert: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? r.employee_name ?? '').trim()
    const attendanceNo = String(r.attendance_no ?? '').trim()
    const startDate = String(r.start_date ?? '').trim()
    const endDate = String(r.end_date ?? startDate).trim()

    if (!name && !attendanceNo) {
      errors.push({ line, reason: '缺少員工姓名或編號' })
      continue
    }

    if (!startDate) {
      errors.push({ line, reason: '缺少請假開始日期' })
      continue
    }

    const emp = empList.find(e => {
      if (attendanceNo && e.attendance_no && e.attendance_no.trim() === attendanceNo) return true
      if (name && e.name && e.name.trim() === name) return true
      return false
    })

    if (!emp) {
      errors.push({ line, reason: `找不到符合的員工「${name || attendanceNo}」` })
      continue
    }

    let leaveType = String(r.leave_type ?? 'personal').trim().toLowerCase()
    if (LEAVE_TYPE_MAP[leaveType]) {
      leaveType = LEAVE_TYPE_MAP[leaveType]
    } else if (!LEAVE_TYPES.has(leaveType)) {
      leaveType = 'personal'
    }

    let status = String(r.status ?? 'approved').trim().toLowerCase()
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      status = status.includes('准') ? 'approved' : status.includes('待') ? 'pending' : status.includes('拒') ? 'rejected' : 'approved'
    }

    toInsert.push({
      owner_id: user.id,
      employee_id: emp.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days: Number(r.days) || 1,
      reason: String(r.reason ?? '').trim(),
      status,
      notes: String(r.notes ?? r.note ?? '').trim(),
    })
  }

  let inserted = 0
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('hr_leaves')
      .insert(toInsert)
      .select('id')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted = data?.length ?? 0
  }

  return NextResponse.json({ ok: true, inserted, errors })
}
