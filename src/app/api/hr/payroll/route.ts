import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const employee_id = searchParams.get('employee_id')

  let query = supabase
    .from('hr_payroll')
    .select('*, hr_employees(name, department, position)')
    .eq('owner_id', user.id)

  if (year) query = query.eq('year', parseInt(year))
  if (month) query = query.eq('month', parseInt(month))
  if (employee_id) query = query.eq('employee_id', employee_id)

  const { data, error } = await query.order('year', { ascending: false }).order('month', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payroll: data })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { employee_id, year, month, base_salary, allowances, deductions, bonus, notes } = body
  if (!employee_id || !year || !month) {
    return NextResponse.json({ error: 'employee_id, year, month required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('hr_payroll')
    .upsert({
      owner_id: user.id, employee_id, year, month,
      base_salary: base_salary ?? 0,
      allowances: allowances ?? 0,
      deductions: deductions ?? 0,
      bonus: bonus ?? 0,
      notes: notes ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'employee_id,year,month' })
    .select('*, hr_employees(name, department, position)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payroll: data })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (updates.status === 'paid' && !updates.paid_at) {
    updates.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('hr_payroll')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', user.id)
    .select('*, hr_employees(name, department, position)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payroll: data })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('hr_payroll').delete().eq('id', id).eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
