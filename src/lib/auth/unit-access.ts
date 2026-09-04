// 單位存取：判斷登入者是否可存取某單位（管理者/owner，或 profiles.units 含該單位），
// 並解析出資料歸屬的 ownerId（＝公司 owner 的帳號 id）。
// 通過後以 service-role client 針對 ownerId 查詢（權限已在程式層把關）。
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export interface UnitContext {
  ok: boolean
  status: 200 | 401 | 403  // 200＝通過；401＝未登入；403＝已登入但無權限
  userId: string
  ownerId: string       // 資料歸屬帳號（公司 owner；管理者＝自己）
  isAdmin: boolean
  admin: Admin          // service-role client
}

const UNAUTHENTICATED: UnitContext = { ok: false, status: 401, userId: '', ownerId: '', isAdmin: false, admin: null as unknown as Admin }
const FORBIDDEN: UnitContext = { ok: false, status: 403, userId: '', ownerId: '', isAdmin: false, admin: null as unknown as Admin }

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
  if (!user) return UNAUTHENTICATED

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('user_type, units, company_id').eq('id', user.id).single()
  const isSuperAdmin = profile?.user_type === 'admin'

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
  if (!isSuperAdmin && !isCompanyAdmin && !hasUnit) return FORBIDDEN

  // 管理者／owner：資料在自己名下；IT 或一般成員：解析公司 owner
  let ownerId = user.id
  if (!isSuperAdmin) {
    const owner = await resolveCompanyOwner(admin, profile?.company_id ?? null)
    if (owner) {
      ownerId = owner
    }
  }
  return { ok: true, status: 200, userId: user.id, ownerId, isAdmin: isSuperAdmin || isCompanyAdmin, admin }
}

// 驗證單位存取。unitKey 例：'hr' / 'finance' / 'rd' / 'store' / 'affairs' / 'audit'
export async function getUnitContext(unitKey: string): Promise<UnitContext> {
  return getUnitContextAny([unitKey])
}
