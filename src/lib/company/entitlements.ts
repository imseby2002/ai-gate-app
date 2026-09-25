// 公司會員方案權限中心：比照 src/lib/cs/entitlements.ts、src/lib/booking/entitlements.ts
// 的既有慣例（唯一權威判斷點、free/core/pro/max、一次性付款、無自動續訂、到期
// 即視同 free），但 key 是 company_id——CS／訂房方案目前都掛在「個人」帳號上，
// 公司實體本身原本沒有自己的方案。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// 'company' 為模組化計價方案（見 lib/company/pricing.ts）；core/pro/max 保留給既有訂閱
export type CompanyPlan = 'free' | 'core' | 'pro' | 'max' | 'company'

export interface CompanyPlanFeatures {
  /** 意見反映系統：每月免費「功能新增/調整」次數，超過才需要老闆審核計費 */
  freeFeatureQuotaMonthly: number
}

export const COMPANY_PLAN_FEATURES: Record<CompanyPlan, CompanyPlanFeatures> = {
  free: { freeFeatureQuotaMonthly: 0 },
  core: { freeFeatureQuotaMonthly: 1 },
  pro:  { freeFeatureQuotaMonthly: 3 },
  max:  { freeFeatureQuotaMonthly: 10 },
  // 公司基本費含每月 1 次免費微調
  company: { freeFeatureQuotaMonthly: 1 },
}

/**
 * 取得某公司目前的會員方案與解析後的權限。
 * 沒有 company_subscriptions 資料 = free（免遷移既有公司）。
 * feature_overrides 可疊加在方案預設值之上，供個別公司客製權益使用。
 */
export async function getCompanyEntitlements(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ plan: CompanyPlan; features: CompanyPlanFeatures }> {
  void supabase
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { data } = await admin
    .from('company_subscriptions')
    .select('plan, status, feature_overrides, current_period_end')
    .eq('company_id', companyId)
    .maybeSingle()

  // 到期即失效：一次性付款、無自動續訂與定時降級 cron，一律在讀取時檢查
  // current_period_end，過期就視同免費方案（與 CS／訂房模組同一套規則）。
  const expired = !!data?.current_period_end && new Date(data.current_period_end).getTime() < Date.now()

  const plan: CompanyPlan = (data?.status === 'active' && !expired && data?.plan && data.plan in COMPANY_PLAN_FEATURES)
    ? (data.plan as CompanyPlan)
    : 'free'

  const overrides = (!expired ? data?.feature_overrides ?? {} : {}) as Partial<CompanyPlanFeatures>
  const features: CompanyPlanFeatures = { ...COMPANY_PLAN_FEATURES[plan], ...overrides }

  return { plan, features }
}

/**
 * ownerId 是否因所屬公司的 'company' 方案而取得某模組的 MAX 權益。
 * 條件：公司訂閱為 active 的 'company' 方案、未到期，且該模組在 companies.enabled_modules 內。
 * CS／訂房／行銷的 entitlements 會呼叫這裡，公司成員不必再各自購買模組方案。
 */
export async function hasCompanyModuleGrant(ownerId: string, moduleId: string): Promise<boolean> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  try {
    const { data: profile } = await admin.from('profiles').select('company_id').eq('id', ownerId).maybeSingle()
    if (!profile?.company_id) return false

    const [{ data: sub }, { data: company }] = await Promise.all([
      admin.from('company_subscriptions').select('plan, status, current_period_end').eq('company_id', profile.company_id).maybeSingle(),
      admin.from('companies').select('enabled_modules').eq('id', profile.company_id).maybeSingle(),
    ])
    if (sub?.plan !== 'company' || sub.status !== 'active') return false
    if (sub.current_period_end && new Date(sub.current_period_end).getTime() < Date.now()) return false
    return (company?.enabled_modules ?? []).includes(moduleId)
  } catch (err) {
    // 查詢失敗視同沒有公司權益（安全預設），並記錄
    console.error('[company entitlements] module grant lookup failed', { ownerId, moduleId, err })
    return false
  }
}

export interface CompanyBillingContext {
  companyId: string
  /** 專屬客製-企業版：不扣點、CHAT 完全開放、功能修改不限次數 */
  enterprise: boolean
}

/**
 * userId 所屬公司若有有效的公司版（'company' 方案），回傳公司 id 與是否為專屬客製-企業版；否則 null。
 * 扣點（lib/skills/billing.ts）、CHAT 限制、意見反映計費都依此判斷。
 */
export async function getCompanyBillingContext(userId: string): Promise<CompanyBillingContext | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', userId).maybeSingle()
  if (!profile?.company_id) return null
  const [{ data: active, error }, { data: enterprise, error: entErr }] = await Promise.all([
    admin.rpc('company_plan_active', { p_company_id: profile.company_id }),
    admin.rpc('company_enterprise_active', { p_company_id: profile.company_id }),
  ])
  if (error || entErr) {
    console.error('[company entitlements] 公司方案狀態查詢失敗', { userId, error: error ?? entErr })
    return null
  }
  return active ? { companyId: profile.company_id, enterprise: !!enterprise } : null
}

/** 扣點改走公司錢包時的公司 id（有效公司版才有）；否則 null */
export async function getBillingCompanyId(userId: string): Promise<string | null> {
  return (await getCompanyBillingContext(userId))?.companyId ?? null
}
