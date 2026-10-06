import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../../_auth'

const FIELDS = `
  id, year, month, base_salary, allowances, deductions, bonus, net_pay, notes,
  gross_salary, bhxh_amount, union_fee, pit_amount, advance_payment, audit_adjustment,
  payslip_confirmed, payslip_confirmed_at,
  hr_employees ( id, name, id_number, department, position, store, staff_category, bank_account, bank_name )
`

export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string; id: string }> }) {
  const { no, id } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await ctx.admin.from('hr_payroll').select(FIELDS)
    .eq('id', id).eq('employee_id', ctx.emp.id).eq('owner_id', ctx.company.ownerId).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ payslip: data })
}

// 確認簽收
export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string; id: string }> }) {
  const { no, id } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await ctx.admin.from('hr_payroll')
    .update({ payslip_confirmed: true, payslip_confirmed_at: new Date().toISOString() })
    .eq('id', id).eq('employee_id', ctx.emp.id).eq('owner_id', ctx.company.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
