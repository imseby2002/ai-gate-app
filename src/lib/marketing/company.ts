// 行銷中心（marketing.im-tourist.com）用：驗證行銷模組權限，並解析
//   ownerId（資料歸屬＝公司 owner）與 memberIds（公司全體成員 id，供公司級日誌彙整）。
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>
export interface MktCompany { admin: Admin; userId: string; ownerId: string; memberIds: string[] }

export async function marketingCompany(): Promise<MktCompany | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, is_active, enabled_modules, units, company_id').eq('id', user.id).single()
  if (!profile || profile.is_active === false) return null
  const isSuperAdmin = profile.user_type === 'admin'
  let isCompanyAdmin = false
  if (profile.company_id) {
    const { data: m } = await admin.from('company_members')
      .select('role')
      .eq('company_id', profile.company_id)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (m?.role === 'owner' || m?.role === 'admin') {
      isCompanyAdmin = true
    }
  }

  if (!isSuperAdmin && !isCompanyAdmin) {
    const enabled: string[] = profile.enabled_modules ?? []
    const units: string[] = profile.units ?? []
    const hasMarketingAccess = enabled.includes('marketing') || units.includes('marketing') || units.includes('mkt')
    if (!hasMarketingAccess) return null
  }

  let ownerId = user.id
  let memberIds: string[] = [user.id]
  if (profile.company_id) {
    const { data: members } = await admin.from('company_members')
      .select('member_id, role').eq('company_id', profile.company_id).eq('status', 'active')
    const rows = members ?? []
    const owner = rows.find(m => m.role === 'owner')?.member_id
    if (!isSuperAdmin && owner) ownerId = owner
    if (rows.length) memberIds = [...new Set(rows.map(m => m.member_id as string))]
  }
  return { admin, userId: user.id, ownerId, memberIds }
}
