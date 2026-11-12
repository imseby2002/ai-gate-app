/**
 * 人事確認員工自填的公司 Email
 * PATCH /api/hr/employees/company-email  body: { id, approve: boolean }
 * 確認：寫入 company_email 並自動綁定同 Email 的 ERP 帳號；退回：清除待確認
 */
import { NextRequest, NextResponse } from 'next/server'
import { getHrContext, hasHrArea } from '@/lib/auth/unit-access'
import { autoLinkByCompanyEmail, companyEmailTaken } from '@/lib/hr/account-sync'

export async function PATCH(req: NextRequest) {
  const ctx = await getHrContext('staff')
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!hasHrArea(ctx, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, approve } = await req.json().catch(() => ({}))
  const { data: emp } = await ctx.admin.from('hr_employees').select('id, company_email_pending')
    .eq('id', String(id ?? '')).eq('owner_id', ctx.ownerId).maybeSingle()
  if (!emp?.company_email_pending) return NextResponse.json({ error: '沒有待確認的公司 Email' }, { status: 404 })
  const patch: Record<string, unknown> = { company_email_pending: null, company_email_requested_at: null, updated_at: new Date().toISOString() }
  if (approve) {
    const email = String(emp.company_email_pending).toLowerCase()
    const taken = await companyEmailTaken(ctx.admin, ctx.ownerId, email, emp.id)
    if (taken) return NextResponse.json({ error: taken }, { status: 409 })
    patch.company_email = email
  }
  const { error } = await ctx.admin.from('hr_employees').update(patch).eq('id', emp.id).eq('owner_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const linked = approve ? await autoLinkByCompanyEmail(ctx.admin, ctx.ownerId, emp.id) : 0
  return NextResponse.json({ ok: true, linked: linked > 0 })
}
