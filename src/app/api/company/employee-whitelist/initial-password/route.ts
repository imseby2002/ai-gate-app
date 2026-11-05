import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany } from '@/lib/company/membership'
import { getInitialPassword, setInitialPassword, MIN_INITIAL_PASSWORD } from '@/lib/company/employee-provision'

async function ctx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const company = await getUserCompany(user.id)
  if (!company) return { res: NextResponse.json({ error: '尚未屬於任何公司' }, { status: 400 }) }
  if (company.role !== 'owner' && company.role !== 'admin') return { res: NextResponse.json({ error: '僅公司負責人或管理員可設定' }, { status: 403 }) }
  return { user, company, admin: createAdminClient() }
}

// GET /api/company/employee-whitelist/initial-password  → { password: string | null }（僅公司負責人／管理員）
export async function GET() {
  const c = await ctx()
  if (c.res) return c.res
  const password = await getInitialPassword(c.admin, c.company.companyId)
  return NextResponse.json({ password }, { headers: { 'Cache-Control': 'no-store' } })
}

// PUT body: { password }  設定本公司員工初始密碼（加密儲存）
export async function PUT(req: NextRequest) {
  const c = await ctx()
  if (c.res) return c.res
  const b = await req.json().catch(() => ({}))
  const password = String(b.password ?? '')
  if (password.length < MIN_INITIAL_PASSWORD) return NextResponse.json({ error: `初始密碼至少 ${MIN_INITIAL_PASSWORD} 碼` }, { status: 400 })
  const { error } = await setInitialPassword(c.admin, c.company.companyId, password, c.user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
