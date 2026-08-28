import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 錄取一鍵轉員工：由 agent_hr_candidates 建立 hr_employees，並回填 hired_employee_id + stage=hired
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: cand, error: cErr } = await supabase
    .from('agent_hr_candidates')
    .select('*').eq('id', id).eq('user_id', user.id).single()
  if (cErr || !cand) return NextResponse.json({ error: cErr?.message ?? 'not found' }, { status: 404 })
  if (cand.hired_employee_id) {
    return NextResponse.json({ error: '此應徵者已轉為員工' }, { status: 409 })
  }

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
      staff_category,
      employment_type: staff_category === 'hourly' ? 'part-time' : 'full-time',
      // 正職需馬上投保；工讀待薪資超過門檻再由使用者確認
      insurance_required: staff_category === 'fulltime',
      insurance_status: staff_category === 'fulltime' ? 'pending' : 'none',
      notes: cand.notes ?? '',
      status: 'active',
    })
    .select('id').single()
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const { data: updated, error: uErr } = await supabase
    .from('agent_hr_candidates')
    .update({ stage: 'hired', hired_employee_id: emp.id })
    .eq('id', id).eq('user_id', user.id)
    .select('*').single()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  return NextResponse.json({ candidate: updated, employee_id: emp.id })
}
