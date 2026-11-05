import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany } from '@/lib/company/membership'
import { getInitialPassword, provisionAccounts, MIN_INITIAL_PASSWORD } from '@/lib/company/employee-provision'

// 為本公司員工名單中「尚未註冊」的 Email 直接建立帳號（免註冊、免驗證信），密碼用公司設定的初始密碼。
// body: { emails?: string[], password? }（未指定 emails＝全部未註冊者；未帶 password＝用公司初始密碼）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '尚未屬於任何公司' }, { status: 400 })
  if (company.role !== 'owner' && company.role !== 'admin') return NextResponse.json({ error: '僅公司負責人或管理員可建立帳號' }, { status: 403 })

  const admin = createAdminClient()
  const b = await req.json().catch(() => ({}))
  const password = b.password ? String(b.password) : await getInitialPassword(admin, company.companyId)
  if (!password) return NextResponse.json({ error: 'no_initial_password' }, { status: 400 })
  if (password.length < MIN_INITIAL_PASSWORD) return NextResponse.json({ error: `初始密碼至少 ${MIN_INITIAL_PASSWORD} 碼` }, { status: 400 })
  const only = Array.isArray(b.emails) ? new Set((b.emails as unknown[]).map(e => String(e).toLowerCase().trim())) : null

  const { data: list } = await admin.from('employee_whitelist').select('email').eq('company_id', company.companyId)
  const emails = (list ?? []).map(r => String(r.email).toLowerCase().trim()).filter(e => !only || only.has(e))
  return NextResponse.json(await provisionAccounts(admin, emails, password, user.id))
}
