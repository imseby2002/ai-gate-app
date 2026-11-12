/**
 * 員工專區：自填公司 Email（送人事確認，確認後才綁定 ERP 帳號，避免填別人的 Email 取得權限）
 * GET  → { company_email（已確認）, pending（待確認）, requested_at }
 * POST { email } 送出／更新；{ email: '' } 撤回待確認
 */
import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../_auth'
import { cleanCompanyEmail, companyEmailTaken } from '@/lib/hr/account-sync'

type Ctx = { params: Promise<{ no: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await ctx.admin.from('hr_employees').select('company_email, company_email_pending, company_email_requested_at')
    .eq('id', ctx.emp.id).eq('owner_id', ctx.company.ownerId).single()
  return NextResponse.json({ company_email: data?.company_email ?? null, pending: data?.company_email_pending ?? null, requested_at: data?.company_email_requested_at ?? null })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { no } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const email = cleanCompanyEmail(b.email)
  if (email === undefined) return NextResponse.json({ error: 'Email không hợp lệ / Email 格式不正確' }, { status: 400 })
  if (email) {
    const taken = await companyEmailTaken(ctx.admin, ctx.company.ownerId, email, ctx.emp.id)
    if (taken) return NextResponse.json({ error: 'Email đã được dùng / 此 Email 已被其他員工使用' }, { status: 409 })
  }
  const { error } = await ctx.admin.from('hr_employees').update({
    company_email_pending: email, company_email_requested_at: email ? new Date().toISOString() : null,
  }).eq('id', ctx.emp.id).eq('owner_id', ctx.company.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
