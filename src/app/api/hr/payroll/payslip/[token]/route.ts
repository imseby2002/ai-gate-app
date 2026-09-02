import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: p, error } = await admin
    .from('hr_payroll')
    .select(`
      id, year, month, base_salary, allowances, deductions, bonus, net_pay, notes,
      gross_salary, bhxh_amount, union_fee, pit_amount, advance_payment, audit_adjustment,
      payslip_token, payslip_confirmed, payslip_confirmed_at,
      hr_employees (
        id, name, id_number, department, position, store, staff_category, bank_account, bank_name
      )
    `)
    .eq('payslip_token', token)
    .single()

  if (error || !p) return NextResponse.json({ error: 'Phiếu lương không tồn tại hoặc đã hết hạn' }, { status: 404 })

  return NextResponse.json({ payslip: p })
}

// 員工點擊確認簽收
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('hr_payroll')
    .update({
      payslip_confirmed: true,
      payslip_confirmed_at: new Date().toISOString(),
    })
    .eq('payslip_token', token)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
