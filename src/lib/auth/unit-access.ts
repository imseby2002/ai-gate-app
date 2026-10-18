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
  storeCode?: string | null // 若該帳號綁定特定門市（非管理者），強制限制僅能操作此門市（多店帳號＝目前選擇的門市）
  storeCodes?: string[] | null // 帳號可操作的所有門市；null＝不限門市
  units?: string[]
}

export const ACTIVE_STORE_COOKIE = 'active_store'

// 門市範圍：管理者不限；其餘依 profiles.store_codes（多店）或 department（單店）。多店帳號以 active_store cookie 決定目前門市
async function storeScope(isAdminLike: boolean, profile: { department?: string | null; store_codes?: string[] | null } | null) {
  if (isAdminLike) return { storeCode: null, storeCodes: null }
  const list = (profile?.store_codes ?? []).map(s => String(s).trim()).filter(Boolean)
  const allowed = list.length ? list : (profile?.department ? [String(profile.department).trim()] : [])
  if (allowed.length === 0) return { storeCode: null, storeCodes: null }
  let active = allowed[0]
  if (allowed.length > 1) {
    const { cookies } = await import('next/headers')
    const c = (await cookies()).get(ACTIVE_STORE_COOKIE)?.value
    const picked = c ? decodeURIComponent(c) : ''
    if (allowed.includes(picked)) active = picked
  }
  return { storeCode: active, storeCodes: allowed }
}

const DENY_401: UnitContext = { ok: false, status: 401, userId: '', ownerId: '', isAdmin: false, admin: null as unknown as Admin, storeCode: null }
const DENY_403: UnitContext = { ok: false, status: 403, userId: '', ownerId: '', isAdmin: false, admin: null as unknown as Admin, storeCode: null }

// 驗證單位存取（符合任一單位即通過；總管理者或公司負責人/IT 全開）。unitKeys 例：['store', 'audit', 'hr']
export async function getUnitContextAny(unitKeys: string[]): Promise<UnitContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DENY_401

  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin.from('profiles').select('user_type, units, company_id, department, store_codes').eq('id', user.id).single()
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

  // 門市代碼限制（管理者為 null 可跨店；門市人員綁定本店或所管理的門市）
  const { storeCode, storeCodes } = await storeScope(isSuperAdmin || isCompanyAdmin, profile)

  return { ok: true, status: 200, userId: user.id, ownerId, isAdmin: isSuperAdmin || isCompanyAdmin, admin, storeCode, storeCodes, units }
}

// 驗證單位存取。unitKey 例：'hr' / 'finance' / 'rd' / 'store' / 'affairs' / 'audit' / 'marketing'
export async function getUnitContext(unitKey: string): Promise<UnitContext> {
  if (unitKey === 'marketing' || unitKey === 'mkt') {
    return getUnitContextAny(['marketing', 'mkt'])
  }
  return getUnitContextAny([unitKey])
}

// 檢查門市是否在帳號可操作範圍內（storeCodes 為 null＝不限）
export function storeAllowed(ctx: UnitContext, store: string | null | undefined): boolean {
  if (!ctx.storeCodes) return true
  return !!store && ctx.storeCodes.includes(store)
}

// 全公司全域資源存取（單位資料、組織架構等屬於全公司整個，非特定部門專屬，任何登入成員皆可使用）
export async function getCompanyContext(): Promise<UnitContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DENY_401

  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin.from('profiles').select('user_type, units, company_id, department, store_codes').eq('id', user.id).single()
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

  const { storeCode, storeCodes } = await storeScope(isSuperAdmin || isCompanyAdmin, profile)

  return { ok: true, status: 200, userId: user.id, ownerId, isAdmin: isSuperAdmin || isCompanyAdmin, admin, storeCode, storeCodes, units: profile?.units ?? [] }
}

