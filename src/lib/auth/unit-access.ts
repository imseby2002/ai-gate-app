// 單位存取：判斷登入者是否可存取某單位（管理者/owner，或 profiles.units 含該單位），
// 並解析出資料歸屬的 ownerId（＝公司 owner 的帳號 id）。
// 通過後以 service-role client 針對 ownerId 查詢（權限已在程式層把關）。
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminUser } from '@/lib/auth/admin-check'

type Admin = ReturnType<typeof createAdminClient>

export interface UnitContext {
  ok: boolean
  userId: string
  ownerId: string       // 資料歸屬帳號（公司 owner；管理者＝自己）
  isAdmin: boolean
  admin: Admin          // service-role client
  storeCode?: string | null // 若該帳號綁定特定門市（非管理者），強制限制僅能操作此門市
}

const DENY: UnitContext = { ok: false, userId: '', ownerId: '', isAdmin: false, admin: null as unknown as Admin, storeCode: null }

// 解析公司 owner 的帳號 id
async function resolveCompanyOwner(admin: Admin, companyId: string | null): Promise<string | null> {
  if (!companyId) return null
  const { data } = await admin.from('company_members')
    .select('member_id').eq('company_id', companyId).eq('role', 'owner').eq('status', 'active').maybeSingle()
  return data?.member_id ?? null
}

// 驗證單位存取（符合任一單位即通過；總管理者或公司負責人/IT 全開）。unitKeys 例：['store', 'audit', 'hr']
export async function getUnitContextAny(unitKeys: string[]): Promise<UnitContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DENY

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, units, company_id, department').eq('id', user.id).single()
  const isSuperAdmin = isSuperAdminUser(user, profile)

  // 檢查是否為公司負責人 (owner) 或公司 IT (admin)
  let isCompanyAdmin = false
  if (profile?.company_id) {
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

  const units = profile?.units ?? []
  const hasUnit = unitKeys.some(k => units.includes(k))
  if (!isSuperAdmin && !isCompanyAdmin && !hasUnit) return DENY

  // 管理者／owner：資料在自己名下；IT 或一般成員：解析公司 owner
  let ownerId = user.id
  if (!isSuperAdmin) {
    const owner = await resolveCompanyOwner(admin, profile?.company_id ?? null)
    if (owner) {
      ownerId = owner
    }
  }

  // 門市代碼限制（管理者為 null 可跨店；門市人員綁定本店代碼）
  const storeCode = (isSuperAdmin || isCompanyAdmin) ? null : (profile?.department ? String(profile.department).trim() : null)

  return { ok: true, userId: user.id, ownerId, isAdmin: isSuperAdmin || isCompanyAdmin, admin, storeCode }
}

// 驗證單位存取。unitKey 例：'hr' / 'finance' / 'rd' / 'store' / 'affairs' / 'audit' / 'marketing'
export async function getUnitContext(unitKey: string): Promise<UnitContext> {
  if (unitKey === 'marketing' || unitKey === 'mkt') {
    return getUnitContextAny(['marketing', 'mkt'])
  }
  return getUnitContextAny([unitKey])
}

// 全公司全域資源存取（單位資料、組織架構等屬於全公司整個，非特定部門專屬，任何登入成員皆可使用）
export async function getCompanyContext(): Promise<UnitContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DENY

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, units, company_id, department').eq('id', user.id).single()
  const isSuperAdmin = isSuperAdminUser(user, profile)

  let isCompanyAdmin = false
  if (profile?.company_id) {
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

  let ownerId = user.id
  if (!isSuperAdmin) {
    const owner = await resolveCompanyOwner(admin, profile?.company_id ?? null)
    if (owner) {
      ownerId = owner
    }
  }

  const storeCode = (isSuperAdmin || isCompanyAdmin) ? null : (profile?.department ? String(profile.department).trim() : null)

  return { ok: true, userId: user.id, ownerId, isAdmin: isSuperAdmin || isCompanyAdmin, admin, storeCode }
}

