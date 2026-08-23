import { createAdminClient } from '@/lib/supabase/admin'

export type CompanyRole = 'owner' | 'admin' | 'manager' | 'viewer'

export interface UserCompany {
  companyId: string
  name: string
  role: CompanyRole
}

// 查詢使用者目前所屬的公司（一人一公司）。沒有公司回傳 null。
// 用 service-role：company_members/companies 的 RLS 只讓「同公司」的人互看，
// 這裡是共用的伺服器端 helper，呼叫端本來就已經驗證過是本人在查自己。
export async function getUserCompany(userId: string): Promise<UserCompany | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single()
  if (!profile?.company_id) return null

  const [{ data: company }, { data: membership }] = await Promise.all([
    admin.from('companies').select('id, name').eq('id', profile.company_id).single(),
    admin.from('company_members').select('role').eq('company_id', profile.company_id).eq('member_id', userId).eq('status', 'active').maybeSingle(),
  ])
  if (!company || !membership) return null

  return { companyId: company.id, name: company.name, role: membership.role as CompanyRole }
}

export async function isCompanyOwnerOrAdmin(userId: string): Promise<boolean> {
  const company = await getUserCompany(userId)
  return !!company && (company.role === 'owner' || company.role === 'admin')
}
