// 單位存取：判斷登入者是否可存取某單位（管理者/owner，或 profiles.units 含該單位），
// 並解析出資料歸屬的 ownerId（＝公司 owner 的帳號 id）。
// 通過後以 service-role client 針對 ownerId 查詢（權限已在程式層把關）。
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminUser } from '@/lib/auth/admin-check'
import { resolveCompanyOwner, resolveActiveCompanyId } from '@/lib/company/activeCompany'

type Admin = ReturnType<typeof createAdminClient>

export interface UnitContext {
  ok: boolean
  status: 200 | 401 | 403 // 未登入 → 401；已登入但無此單位權限 → 403；通過 → 200
  userId: string
  ownerId: string       // 資料歸屬帳號（公司 owner；管理者＝自己）
  isAdmin: boolean
  admin: Admin          // service-role client
  storeCode?: string | null // 若該帳號綁定特定門市（非管理者），強制限制僅能操作此門市
}

const DENY_401: UnitContext = { ok: false, status: 401, userId: '', ownerId: '', isAdmin: false, admin: null as unknown as Admin, storeCode: null }
const DENY_403: UnitContext = { ok: false, status: 403, userId: '', ownerId: '', isAdmin: false, admin: null as unknown as Admin, storeCode: null }

// 驗證單位存取（符合任一單位即通過；總管理者或公司負責人/IT 全開）。unitKeys 例：['store', 'audit', 'hr']
export async function getUnitContextAny(unitKeys: string[]): Promise<UnitContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DENY_401

  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin.from('profiles').select('user_type, units, company_id, department').eq('id', user.id).single()
  // 查詢失敗時 profile 是 null，底下會因為 units 為空而回 403——使用者被擋在外面，
  // 卻沒有任何線索可查。權限判斷維持 fail-closed（該擋還是擋），但錯誤要留下來。
  if (profileErr) console.error('[unit-access] profiles 查詢失敗', { userId: user.id, error: profileErr })
  const isSuperAdmin = isSuperAdminUser(user, profile)
  const activeCompanyId = await resolveActiveCompanyId(admin, user.id, isSuperAdmin, profile?.company_id ?? null)

  // 檢查是否為公司負責人 (owner) 或公司 IT (admin)
  let isCompanyAdmin = false
  if (activeCompanyId) {
    const { data: m, error: memberErr } = await admin.from('company_members')
      .select('role')
      .eq('company_id', activeCompanyId)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (memberErr) console.error('[unit-access] company_members(role) 查詢失敗', { userId: user.id, companyId: activeCompanyId, error: memberErr })
    if (m?.role === 'owner' || m?.role === 'admin') {
      isCompanyAdmin = true
    }
  }

  const units = profile?.units ?? []
  const hasUnit = unitKeys.some(k => units.includes(k))
  if (!isSuperAdmin && !isCompanyAdmin && !hasUnit) return DENY_403

  // 總管理員若剛好也是某家公司的真員工（有 activeCompanyId），資料控管跟一般
  // 員工一致，一樣解析到那家公司的 owner；沒有公司身分時才停留在自己名下
  // （純後台管理員，不隸屬任何公司）。
  let ownerId = user.id
  const owner = await resolveCompanyOwner(admin, activeCompanyId)
  if (owner) {
    ownerId = owner
  }

  // 門市代碼限制（管理者為 null 可跨店；門市人員綁定本店代碼）
  const storeCode = (isSuperAdmin || isCompanyAdmin) ? null : (profile?.department ? String(profile.department).trim() : null)

  return { ok: true, status: 200, userId: user.id, ownerId, isAdmin: isSuperAdmin || isCompanyAdmin, admin, storeCode }
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
  if (!user) return DENY_401

  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin.from('profiles').select('user_type, units, company_id, department').eq('id', user.id).single()
  // 查詢失敗時 profile 是 null，底下會因為 units 為空而回 403——使用者被擋在外面，
  // 卻沒有任何線索可查。權限判斷維持 fail-closed（該擋還是擋），但錯誤要留下來。
  if (profileErr) console.error('[unit-access] profiles 查詢失敗', { userId: user.id, error: profileErr })
  const isSuperAdmin = isSuperAdminUser(user, profile)
  const activeCompanyId = await resolveActiveCompanyId(admin, user.id, isSuperAdmin, profile?.company_id ?? null)

  let isCompanyAdmin = false
  if (activeCompanyId) {
    const { data: m, error: memberErr } = await admin.from('company_members')
      .select('role')
      .eq('company_id', activeCompanyId)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (memberErr) console.error('[unit-access] company_members(role) 查詢失敗', { userId: user.id, companyId: activeCompanyId, error: memberErr })
    if (m?.role === 'owner' || m?.role === 'admin') {
      isCompanyAdmin = true
    }
  }

  let ownerId = user.id
  const owner = await resolveCompanyOwner(admin, activeCompanyId)
  if (owner) {
    ownerId = owner
  }

  const storeCode = (isSuperAdmin || isCompanyAdmin) ? null : (profile?.department ? String(profile.department).trim() : null)

  return { ok: true, status: 200, userId: user.id, ownerId, isAdmin: isSuperAdmin || isCompanyAdmin, admin, storeCode }
}

