import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany } from '@/lib/company/membership'

// 為本公司員工名單中「尚未註冊」的 Email 直接建立帳號（免驗證信），初始密碼由管理員輸入，員工登入後自行修改。
// body: { password, emails?: string[] }（未指定 emails＝全部未註冊者）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '尚未屬於任何公司' }, { status: 400 })
  if (company.role !== 'owner' && company.role !== 'admin') return NextResponse.json({ error: '僅公司負責人或管理員可建立帳號' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const password = String(b.password ?? '')
  if (password.length < 8) return NextResponse.json({ error: '初始密碼至少 8 碼' }, { status: 400 })
  const only = Array.isArray(b.emails) ? new Set((b.emails as unknown[]).map(e => String(e).toLowerCase().trim())) : null

  const admin = createAdminClient()
  const { data: list } = await admin.from('employee_whitelist').select('email').eq('company_id', company.companyId)
  const emails = [...new Set((list ?? []).map(r => String(r.email).toLowerCase().trim()))].filter(e => !only || only.has(e))
  const { data: profs } = emails.length ? await admin.from('profiles').select('email').in('email', emails) : { data: [] }
  const registered = new Set((profs ?? []).map(p => String(p.email).toLowerCase()))

  const created: string[] = [], failed: { email: string; error: string }[] = []
  for (const email of emails.filter(e => !registered.has(e))) {
    // 建立後由資料庫觸發器依員工名單綁定公司（user_type=employee、company_members）
    const { error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: email.split('@')[0], must_change_password: true, provisioned_by: user.id },
    })
    if (error) failed.push({ email, error: error.message }); else created.push(email)
  }
  return NextResponse.json({ created, failed, skipped: emails.length - created.length - failed.length })
}
