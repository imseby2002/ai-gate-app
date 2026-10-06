import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LEGACY_PAYSLIP_CUTOFF, portalUrlForEmployee } from '@/lib/hr/portal'

// 員工專區上線後，舊單月連結保留 30 天過渡期（回傳新網址供提醒），之後停用
async function legacyStatus(token: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('hr_payroll').select('owner_id, hr_employees ( attendance_no )').eq('payslip_token', token).maybeSingle()
  if (!data) return { portalUrl: null, expired: false }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portalUrl = await portalUrlForEmployee(data.owner_id, (data.hr_employees as any)?.attendance_no ?? null)
  return { portalUrl, expired: !!portalUrl && Date.now() >= LEGACY_PAYSLIP_CUTOFF.getTime() }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const legacy = await legacyStatus(token)
  if (legacy.expired) {
    return NextResponse.json({ error: 'Đường dẫn này đã ngừng sử dụng / 此網址已停用，請改用員工專區', portal_url: legacy.portalUrl }, { status: 410 })
  }

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

  return NextResponse.json({ payslip: p, portal_url: legacy.portalUrl })
}

// 員工點擊確認簽收
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })
  if ((await legacyStatus(token)).expired) return NextResponse.json({ error: 'Expired' }, { status: 410 })

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
