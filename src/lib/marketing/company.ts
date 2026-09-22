// 行銷中心（marketing.im-tourist.com）用：驗證行銷模組權限，並解析
//   ownerId（資料歸屬＝公司 owner）與 memberIds（公司全體成員 id，供公司級日誌彙整）。
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompanyId } from '@/lib/company/activeCompany'

type Admin = ReturnType<typeof createAdminClient>
export interface MktCompany { admin: Admin; userId: string; ownerId: string; memberIds: string[] }

export async function marketingCompany(): Promise<MktCompany | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin.from('profiles').select('user_type, is_active, enabled_modules, units, company_id').eq('id', user.id).single()
  // 查詢失敗與「查無此人／帳號停用」都會走到 return null、呼叫端一律當成沒權限，
  // 兩者要分得出來。行為維持 fail-closed，但錯誤要留下。
  if (profileErr) console.error('[marketing-company] profiles 查詢失敗', { userId: user.id, error: profileErr })
  if (!profile || profile.is_active === false) return null
  const isSuperAdmin = profile.user_type === 'admin'
  const activeCompanyId = await resolveActiveCompanyId(admin, user.id, isSuperAdmin, profile.company_id ?? null)

  let isCompanyAdmin = false
  if (activeCompanyId) {
    const { data: m, error: memberErr } = await admin.from('company_members')
      .select('role')
      .eq('company_id', activeCompanyId)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (memberErr) console.error('[marketing-company] company_members(role) 查詢失敗', { userId: user.id, companyId: activeCompanyId, error: memberErr })
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
  if (activeCompanyId) {
    const { data: members, error: membersErr } = await admin.from('company_members')
      .select('member_id, role').eq('company_id', activeCompanyId).eq('status', 'active')
    // 查詢失敗會讓 ownerId 退回使用者自己，資料範圍整個跑掉（會看到空資料）而且無聲。
    if (membersErr) console.error('[marketing-company] company_members 查詢失敗', { companyId: activeCompanyId, error: membersErr })
    const rows = members ?? []
    const owner = rows.find(m => m.role === 'owner')?.member_id
    if (owner) ownerId = owner
    if (rows.length) memberIds = [...new Set(rows.map(m => m.member_id as string))]
  }
  return { admin, userId: user.id, ownerId, memberIds }
}
