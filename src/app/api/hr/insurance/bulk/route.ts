import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getHrUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getHrUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  const { data: emps } = await supabase
    .from('hr_employees')
    .select('id, name, id_number, attendance_no')
    .eq('owner_id', user.id)

  const empList = emps || []
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? r.employee_name ?? '').trim()
    const idNumber = String(r.id_number ?? '').trim()
    const attendanceNo = String(r.attendance_no ?? '').trim()

    if (!name && !idNumber && !attendanceNo) {
      errors.push({ line, reason: '缺少員工姓名或身分證號或出勤編號' })
      continue
    }

    const emp = empList.find(e => {
      if (idNumber && e.id_number && e.id_number.trim() === idNumber) return true
      if (attendanceNo && e.attendance_no && e.attendance_no.trim() === attendanceNo) return true
      if (name && e.name && e.name.trim() === name) return true
      return false
    })

    if (!emp) {
      errors.push({ line, reason: `找不到符合的員工「${name || idNumber || attendanceNo}」` })
      continue
    }

    let insuranceRequired = r.insurance_required
    if (typeof insuranceRequired === 'string') {
      insuranceRequired = ['true', '1', '是', 'yes', 'y', '需保'].includes(insuranceRequired.toLowerCase().trim())
    } else if (insuranceRequired === undefined || insuranceRequired === null || insuranceRequired === '') {
      insuranceRequired = true
    }

    let insuranceStatus = String(r.insurance_status ?? '').trim().toLowerCase()
    if (!['none', 'pending', 'enrolled'].includes(insuranceStatus)) {
      insuranceStatus = insuranceStatus.includes('已') ? 'enrolled' : insuranceStatus.includes('待') ? 'pending' : 'none'
    }

    const patch: Record<string, unknown> = {
      insurance_required: !!insuranceRequired,
      insurance_status: insuranceStatus,
      insurance_number: String(r.insurance_number ?? '').trim(),
      insurance_salary: Number(r.insurance_salary) || 0,
    }

    const { error } = await supabase
      .from('hr_employees')
      .update(patch)
      .eq('id', emp.id)

    if (error) {
      errors.push({ line, reason: `更新「${emp.name}」保險資料失敗: ${error.message}` })
    } else {
      updated++
    }
  }

  return NextResponse.json({ ok: true, updated, errors })
}
