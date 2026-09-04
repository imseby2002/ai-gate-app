import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getHrUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getHrUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { rows } = (await req.json()) as { rows?: Record<string, unknown>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有可匯入的資料' }, { status: 400 })
  }

  const errors: { line: number; reason: string }[] = []

  // 取得所有員工姓名與編號對照
  const { data: emps } = await supabase
    .from('hr_employees')
    .select('id, name, attendance_no')
    .eq('owner_id', user.id)

  const empList = emps || []
  let inserted = 0
  let updated = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const line = i + 2
    const name = String(r.name ?? r.employee_name ?? '').trim()
    const attendanceNo = String(r.attendance_no ?? '').trim()
    const year = Number(r.year) || new Date().getFullYear()
    const month = Number(r.month) || (new Date().getMonth() + 1)

    if (!name && !attendanceNo) {
      errors.push({ line, reason: '缺少員工姓名或出勤編號' })
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

    const payload = {
      owner_id: user.id,
      employee_id: emp.id,
      year,
      month,
      bonus: Number(r.bonus) || 0,
      reward: Number(r.reward) || 0,
      penalty: Number(r.penalty) || 0,
      score: r.score !== undefined && r.score !== '' ? Number(r.score) : null,
      notes: String(r.notes ?? r.note ?? '').trim(),
      updated_at: new Date().toISOString(),
    }

    const { data: existingEval } = await supabase
      .from('hr_evaluations')
      .select('id')
      .eq('owner_id', user.id)
      .eq('employee_id', emp.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()

    if (existingEval) {
      const { error } = await supabase
        .from('hr_evaluations')
        .update(payload)
        .eq('id', existingEval.id)
      if (error) {
        errors.push({ line, reason: `更新「${emp.name}」考核失敗: ${error.message}` })
      } else {
        updated++
      }
    } else {
      const { error } = await supabase
        .from('hr_evaluations')
        .insert(payload)
      if (error) {
        errors.push({ line, reason: `新增「${emp.name}」考核失敗: ${error.message}` })
      } else {
        inserted++
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, updated, errors })
}
