/**
 * ERP 登入打卡（不需公司子網域）：依登入帳號綁定的員工資料（目前所在公司優先）打卡
 * GET  /api/me/punch → 與員工專區相同的打卡狀態（另附 company）
 * POST /api/me/punch  body: { lat, lng, accuracy }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompanyId, resolveCompanyOwner } from '@/lib/company/activeCompany'
import { doPunch, punchStatus } from '@/lib/hr/punch-actions'

export const dynamic = 'force-dynamic'

async function myEmployee() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, company_id').eq('id', user.id).maybeSingle()
  const companyId = await resolveActiveCompanyId(admin, user.id, profile?.user_type === 'admin', (profile?.company_id as string | null) ?? null)
  const owner = await resolveCompanyOwner(admin, companyId)
  let q = admin.from('hr_employees').select('id, name, attendance_no, owner_id, store, managed_stores')
    .eq('profile_id', user.id).eq('status', 'active')
  if (owner) q = q.eq('owner_id', owner)
  const { data: emp } = await q.limit(1).maybeSingle()
  if (!emp) return { status: 404 as const }
  if (!String(emp.store ?? '').trim() && Array.isArray(emp.managed_stores) && emp.managed_stores.length) emp.store = String(emp.managed_stores[0])
  const { data: company } = companyId ? await admin.from('companies').select('name').eq('id', companyId).maybeSingle() : { data: null }
  return { status: 200 as const, admin, emp: { ...emp, attendance_no: String(emp.attendance_no ?? '') }, company: company?.name ?? '' }
}

const NO_EMP = '此帳號尚未綁定在職員工資料，請聯絡人事 / Tài khoản chưa liên kết hồ sơ nhân viên'

export async function GET() {
  const r = await myEmployee()
  if (r.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (r.status === 404) return NextResponse.json({ error: NO_EMP }, { status: 404 })
  return NextResponse.json({ ...(await punchStatus(r.admin, r.emp.owner_id, r.emp)), employee: r.emp.name, company: r.company })
}

export async function POST(req: NextRequest) {
  const r = await myEmployee()
  if (r.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (r.status === 404) return NextResponse.json({ error: NO_EMP }, { status: 404 })
  const res = await doPunch(r.admin, r.emp.owner_id, r.emp, await req.json().catch(() => ({})))
  return NextResponse.json(res.body, { status: res.status })
}
