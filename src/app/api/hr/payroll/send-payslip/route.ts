import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getUnitContext } from '@/lib/auth/unit-access'
import { notifyApplicant } from '@/lib/hr/notify'
import { portalUrlForEmployee } from '@/lib/hr/portal'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin , status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin , status: ctx.status }
}

export async function POST(req: NextRequest) {
  const { user, supabase , status } = await getAdminUser()
  if (!user) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })

  const { payroll_ids } = await req.json().catch(() => ({}))
  if (!Array.isArray(payroll_ids) || payroll_ids.length === 0) {
    return NextResponse.json({ error: 'payroll_ids required' }, { status: 400 })
  }

  // 取得薪資明細與員工/應徵者資訊
  const { data: records, error } = await supabase
    .from('hr_payroll')
    .select(`
      id, year, month, net_pay, payslip_token,
      employee_id,
      hr_employees (
        id, name, email, phone, store, attendance_no
      )
    `)
    .in('id', payroll_ids)
    .eq('owner_id', user.id)

  if (error || !records) return NextResponse.json({ error: error?.message ?? 'Records not found' }, { status: 500 })

  let sentCount = 0
  const results: Array<{ id: string; name: string; status: string; url?: string }> = []

  const host = process.env.NEXT_PUBLIC_SITE_URL || 'https://office.im-tourist.com'

  for (const r of records) {
    const emp = r.hr_employees as any
    if (!emp) continue

    // 若無 token 則產生
    let token = r.payslip_token
    if (!token) {
      token = randomBytes(20).toString('hex')
      await supabase.from('hr_payroll').update({ payslip_token: token }).eq('id', r.id)
    }

    // 有公司子網域與打卡編號時改發員工專區連結（生日登入、自設密碼），否則沿用單月連結
    const portalUrl = await portalUrlForEmployee(user.id, emp.attendance_no ?? null)
    const payslipUrl = portalUrl ?? `${host}/payslip/${token}`
    const loginHint = portalUrl ? '\n(Lần đầu đăng nhập bằng ngày sinh DDMMYYYY, sau đó tự đặt mật khẩu.)' : ''

    // 取得應徵者資料以查詢 zalo_user_id
    const { data: cand } = await supabase
      .from('agent_hr_candidates')
      .select('zalo_user_id, notify_channel, email')
      .eq('hired_employee_id', emp.id)
      .maybeSingle()

    const subject = `【Phiếu Lương】薪資條通知 - Tháng ${r.month}/${r.year} (${emp.name})`
    const message = `Xin chào ${emp.name},\n\nPhiếu lương tháng ${r.month}/${r.year} của bạn đã được phát hành.\nThực lĩnh: ${Number(r.net_pay).toLocaleString()} VND\n\nVui lòng truy cập đường dẫn dưới đây để xem chi tiết và xác nhận phiếu lương trực tuyến:\n${payslipUrl}${loginHint}\n\nTrân trọng,\nPhòng Nhân Sự`

    const channel = cand?.notify_channel === 'zalo' ? 'zalo' : 'email'
    const target = {
      email: emp.email || cand?.email,
      notify_channel: channel,
      zalo_user_id: cand?.zalo_user_id,
      name: emp.name,
    }

    const res = await notifyApplicant(user.id, target, subject, message)
    if (res.ok) sentCount++
    results.push({ id: r.id, name: emp.name, status: res.ok ? 'sent' : (res.error || 'failed'), url: payslipUrl })
  }

  return NextResponse.json({ ok: true, sentCount, results })
}
