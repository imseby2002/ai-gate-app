/**
 * 用員工的公司 Email 建立 ERP 系統帳號並綁定（免註冊，密碼為公司設定的員工初始密碼）
 * POST /api/hr/employees/company-account  body: { id }
 * 限人事全權或公司負責人／IT。已有同 Email 帳號時直接綁定。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getHrContext } from '@/lib/auth/unit-access'
import { accountByEmail, autoLinkByCompanyEmail } from '@/lib/hr/account-sync'
import { getInitialPassword, provisionAccounts } from '@/lib/company/employee-provision'

export async function POST(req: NextRequest) {
  const ctx = await getHrContext('staff')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!(ctx.isAdmin || (ctx.units ?? []).includes('hr'))) return NextResponse.json({ error: '僅人事全權或公司負責人／IT 可建立帳號' }, { status: 403 })
  const admin = ctx.admin, ownerId = ctx.ownerId
  const { id } = await req.json().catch(() => ({}))
  const { data: emp } = await admin.from('hr_employees').select('id, name, company_email, profile_id').eq('id', String(id ?? '')).eq('owner_id', ownerId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (emp.profile_id) return NextResponse.json({ ok: true, already: true })
  const email = String(emp.company_email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: '請先填寫公司 Email' }, { status: 400 })

  // 已有同 Email 帳號：直接綁定
  if (!(await accountByEmail(admin, ownerId, email))) {
    const { data: owner } = await admin.from('profiles').select('company_id').eq('id', ownerId).single()
    const companyId = owner?.company_id as string | null
    if (!companyId) return NextResponse.json({ error: '找不到公司' }, { status: 400 })
    const password = await getInitialPassword(admin, companyId)
    if (!password) return NextResponse.json({ error: 'no_initial_password' }, { status: 400 })
    // 加入本公司員工白名單（Email 全系統唯一；已在別家公司名單就不建立）
    const { data: wl } = await admin.from('employee_whitelist').select('id, company_id').eq('email', email).maybeSingle()
    if (wl && wl.company_id && wl.company_id !== companyId) return NextResponse.json({ error: '此 Email 已登記在其他公司' }, { status: 409 })
    if (!wl) {
      const { error } = await admin.from('employee_whitelist').insert({ email, company_id: companyId, note: emp.name, added_by: ctx.userId })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const r = await provisionAccounts(admin, [email], password, ctx.userId)
    if (r.failed.length) return NextResponse.json({ error: r.failed[0].error }, { status: 500 })
  }
  const linked = await autoLinkByCompanyEmail(admin, ownerId, emp.id)
  if (!linked) return NextResponse.json({ error: '帳號已存在但無法綁定（可能已綁定其他員工）' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
