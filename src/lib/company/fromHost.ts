// 由公司專屬子網域（<slug>.im-tourist.com）解析公司與其 owner 帳號（資料歸屬 owner_id）。
// 供公開頁（應徵、員工專區、廠商填表）在無登入狀態下判斷屬於哪家公司。
import { createAdminClient } from '@/lib/supabase/admin'
import { companySlugFromHost } from '@/lib/company/subdomain'
import { resolveCompanyOwner } from '@/lib/company/activeCompany'

export async function companyFromHost(host: string): Promise<{ companyId: string; ownerId: string; name: string } | null> {
  const slug = companySlugFromHost((host || '').split(':')[0].toLowerCase())
  if (!slug) return null
  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('id, name').eq('slug', slug).maybeSingle()
  if (!company) return null
  const ownerId = await resolveCompanyOwner(admin, company.id)
  if (!ownerId) return null
  return { companyId: company.id, ownerId, name: company.name }
}

/** owner 帳號所屬公司的子網域 slug（沒有則 null） */
export async function companySlugForOwner(ownerId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', ownerId).maybeSingle()
  if (!profile?.company_id) return null
  const { data: company } = await admin.from('companies').select('slug').eq('id', profile.company_id).maybeSingle()
  return company?.slug ?? null
}
