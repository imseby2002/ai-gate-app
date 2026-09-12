// 公司會員方案權限中心：比照 src/lib/cs/entitlements.ts、src/lib/booking/entitlements.ts
// 的既有慣例（唯一權威判斷點、free/core/pro/max、一次性付款、無自動續訂、到期
// 即視同 free），但 key 是 company_id——CS／訂房方案目前都掛在「個人」帳號上，
// 公司實體本身原本沒有自己的方案。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type CompanyPlan = 'free' | 'core' | 'pro' | 'max'

export interface CompanyPlanFeatures {
  /** 意見反映系統：每月免費「功能新增/調整」次數，超過才需要老闆審核計費 */
  freeFeatureQuotaMonthly: number
}

export const COMPANY_PLAN_FEATURES: Record<CompanyPlan, CompanyPlanFeatures> = {
  free: { freeFeatureQuotaMonthly: 0 },
  core: { freeFeatureQuotaMonthly: 1 },
  pro:  { freeFeatureQuotaMonthly: 3 },
  max:  { freeFeatureQuotaMonthly: 10 },
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
