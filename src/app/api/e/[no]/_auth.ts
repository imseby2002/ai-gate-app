// 員工專區 API 共用：由子網域解析公司，並驗證工作階段屬於這個打卡編號的在職員工
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { companyFromHost } from '@/lib/company/fromHost'
import { PORTAL_COOKIE, verifySession } from '@/lib/hr/portal'

export async function portalCompany(req: NextRequest) {
  return companyFromHost(req.headers.get('host') ?? '')
}

export async function portalEmployee(req: NextRequest, no: string) {
  const company = await portalCompany(req)
  if (!company) return null
  const eid = verifySession(req.cookies.get(PORTAL_COOKIE)?.value)
  if (!eid) return null
  const admin = createAdminClient()
  const { data: emp } = await admin.from('hr_employees')
    .select('id, name, attendance_no, status, owner_id')
    .eq('id', eid).eq('owner_id', company.ownerId).maybeSingle()
  if (!emp || emp.status !== 'active' || emp.attendance_no !== no) return null
  return { admin, company, emp }
}
