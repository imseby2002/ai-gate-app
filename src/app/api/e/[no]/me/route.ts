import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'

// 登入後：員工姓名、是否已設密碼、薪資條清單
export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: portal }, { data: payslips }] = await Promise.all([
    ctx.admin.from('hr_employee_portal').select('pin_hash').eq('employee_id', ctx.emp.id).maybeSingle(),
    ctx.admin.from('hr_payroll')
      .select('id, year, month, net_pay, payslip_confirmed')
      .eq('employee_id', ctx.emp.id).eq('owner_id', ctx.company.ownerId)
      .order('year', { ascending: false }).order('month', { ascending: false }),
  ])
  return NextResponse.json({
    name: ctx.emp.name,
    company: ctx.company.name,
    hasPin: !!portal?.pin_hash,
    payslips: payslips ?? [],
  })
}
