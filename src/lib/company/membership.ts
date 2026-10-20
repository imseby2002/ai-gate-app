import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompanyId } from '@/lib/company/activeCompany'

export type CompanyRole = 'owner' | 'admin' | 'manager' | 'viewer'

export interface UserCompany {
  companyId: string
  name: string
  role: CompanyRole
}

// 查詢使用者目前所屬的公司（支援右上角切換公司，預設為 profiles.company_id）。沒有公司回傳 null。
// 用 service-role：company_members/companies 的 RLS 只讓「同公司」的人互看，
// 這裡是共用的伺服器端 helper，呼叫端本來就已經驗證過是本人在查自己。
export async function getUserCompany(userId: string): Promise<UserCompany | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id, user_type')
    .eq('id', userId)
    .maybeSingle()
  const isSuperAdmin = profile?.user_type === 'admin'
  const companyId = await resolveActiveCompanyId(admin, userId, isSuperAdmin, profile?.company_id ?? null)
  if (!companyId) return null

  const [{ data: company }, { data: membership }] = await Promise.all([
    admin.from('companies').select('id, name').eq('id', companyId).maybeSingle(),
    admin.from('company_members').select('role').eq('company_id', companyId).eq('member_id', userId).eq('status', 'active').maybeSingle(),
  ])
  if (!company) return null

  const role = (membership?.role || (isSuperAdmin ? 'admin' : null)) as CompanyRole | null
  if (!role) return null

  return { companyId: company.id, name: company.name, role }
}

export async function isCompanyOwnerOrAdmin(userId: string): Promise<boolean> {
  const company = await getUserCompany(userId)
  return !!company && (company.role === 'owner' || company.role === 'admin')
}

// 可為公司錢包線上儲值的人：公司負責人／管理員／經理，或個人單位（profiles.units）含財務（'finance'）的成員。
export async function canTopUpCompanyWallet(userId: string): Promise<UserCompany | null> {
  const company = await getUserCompany(userId)
  if (!company) return null
  if (company.role === 'owner' || company.role === 'admin' || company.role === 'manager') return company
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('units').eq('id', userId).single()
  return (profile?.units ?? []).includes('finance') ? company : null
}
