import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// 錄取一鍵轉員工：自動生成工號（Employee ID / attendance_no），建立 hr_employees，並回填 hired_employee_id + stage=hired
export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: cand, error: cErr } = await supabase
    .from('agent_hr_candidates')
    .select('*').eq('id', id).eq('user_id', user.id).single()
  if (cErr || !cand) return NextResponse.json({ error: cErr?.message ?? 'not found' }, { status: 404 })
  if (cand.hired_employee_id) {
    return NextResponse.json({ error: '此應徵者已轉為員工' }, { status: 409 })
  }

  // 1. 自動計算並生成工號 (Employee ID)
  const { data: existingEmps } = await supabase
    .from('hr_employees')
    .select('attendance_no')
    .eq('owner_id', user.id)

  const storePrefix = (cand.store || 'EMP').toUpperCase()
  let maxSeq = 0
  for (const e of existingEmps ?? []) {
    const num = parseInt(String(e.attendance_no || '').replace(/\D/g, ''))
    if (!isNaN(num) && num > maxSeq) maxSeq = num
  }
  const nextNo = String(maxSeq + 1).padStart(3, '0')
  const attendance_no = `${storePrefix}-${nextNo}`

  // 2. 建立正式員工檔案
  const staff_category = cand.staff_category === 'hourly' ? 'hourly' : 'fulltime'
  const { data: emp, error: eErr } = await supabase
    .from('hr_employees')
    .insert({
      owner_id: user.id,
      name: cand.name,
      email: cand.email ?? '',
      phone: cand.phone ?? '',
      position: cand.position ?? '',
      id_number: cand.id_number ?? '',
      store: cand.store ?? '',
      attendance_no,
      staff_category,
      employment_type: staff_category === 'hourly' ? 'part-time' : 'full-time',
      hire_date: new Date().toISOString().slice(0, 10),
      insurance_required: staff_category === 'fulltime',
      insurance_status: staff_category === 'fulltime' ? 'pending' : 'none',
      notes: cand.notes ?? '',
      status: 'active',
    })
    .select('id').single()

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  // 3. 回填應徵者狀態
  const { data: updated, error: uErr } = await supabase
    .from('agent_hr_candidates')
    .update({ stage: 'hired', hired_employee_id: emp.id })
    .eq('id', id).eq('user_id', user.id)
    .select('*').single()

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  return NextResponse.json({
    candidate: updated,
    employee_id: emp.id,
    attendance_no,
    message: `已成功建立員工檔案！自動生成工號：${attendance_no}`,
  })
}
