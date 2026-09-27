// AI 模組方案權限中心：唯一的權威判斷點（比照 lib/marketing/entitlements.ts）。
// 生效順序：內部帳號（admin／employee）→ MAX；專屬客製-企業版或所屬公司開通此模組 → MAX；
// 否則為 module_subscriptions 的帳號方案（到期或非 active 視同 FREE）。
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyBillingContext, hasCompanyModuleGrant } from '@/lib/company/entitlements'
import {
  MODULE_PLAN_FEATURES, MODULE_PLANS, MODULE_PLAN_LABEL,
  type ModuleFeatureMap, type ModulePlan, type PlanModuleId,
} from './definitions'

export interface ModuleEntitlements<K extends PlanModuleId> {
  plan: ModulePlan
  features: ModuleFeatureMap[K]
  /** 內部帳號不受方案次數限制，也不扣點 */
  internal: boolean
  /** 所屬公司帳號（chat 每日則數沿用公司成員上限用） */
  hasCompany: boolean
}

export async function getModuleEntitlements<K extends PlanModuleId>(
  userId: string,
  module: K,
): Promise<ModuleEntitlements<K>> {
  const table = MODULE_PLAN_FEATURES[module] as Record<ModulePlan, ModuleFeatureMap[K]>
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type, company_id')
    .eq('id', userId)
    .maybeSingle()
  const hasCompany = !!profile?.company_id

  if (profile?.user_type === 'admin' || profile?.user_type === 'employee') {
    return { plan: 'max', features: table.max, internal: true, hasCompany }
  }

  let data: { plan?: string; status?: string; feature_overrides?: Partial<ModuleFeatureMap[K]>; current_period_end?: string | null } | null = null
  try {
    const res = await admin
      .from('module_subscriptions')
      .select('plan, status, feature_overrides, current_period_end')
      .eq('user_id', userId)
      .eq('module', module)
      .maybeSingle()
    if (res.error) throw res.error
    data = res.data
  } catch (err) {
    // 查詢失敗就當作 free（安全預設，不多給付費功能），並記錄以便排查
    console.error('[module-plans] 訂閱查詢失敗，視同 FREE', { userId, module, err })
  }

  // 到期即失效：一次性付款、無自動續訂，讀取時檢查 current_period_end（與 CS／訂房／行銷同一套規則）
  const expired = !!data?.current_period_end && new Date(data.current_period_end).getTime() < Date.now()
  let plan: ModulePlan = (data?.status === 'active' && !expired && data?.plan && (MODULE_PLANS as string[]).includes(data.plan))
    ? (data.plan as ModulePlan)
    : 'free'

  if (plan !== 'max' && hasCompany) {
    const company = await getCompanyBillingContext(userId)
    if (company?.enterprise || await hasCompanyModuleGrant(userId, module)) plan = 'max'
  }

  const overrides = (!expired ? data?.feature_overrides ?? {} : {}) as Partial<ModuleFeatureMap[K]>
  return { plan, features: { ...table[plan], ...overrides }, internal: false, hasCompany }
}

/** 目前計量週期（UTC+8 的 'YYYY-MM'，與 chat-policy 的日界同一時區） */
export function currentUsagePeriod(now = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 3600_000)
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

/** UTC+8 當月第一天 00:00 的 UTC 時間 */
export function currentPeriodStart(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 8 * 3600_000)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 8 * 3600_000)
}

/**
 * 扣一次每月額度。limit 為 Infinity 時不計數直接通過；查詢失敗視同已達上限（fail-closed）。
 */
export async function consumeMonthlyQuota(
  userId: string, module: PlanModuleId, feature: string, limit: number,
): Promise<boolean> {
  if (limit === Infinity) return true
  if (limit <= 0) return false
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('consume_module_quota', {
    p_user_id: userId, p_module: module, p_feature: feature, p_period: currentUsagePeriod(), p_limit: limit,
  })
  if (error) {
    console.error('[module-plans] 額度扣除失敗', { userId, module, feature, error })
    return false
  }
  return data === true
}

/** 統一的「方案不足」回應（403，比照既有未開放功能的狀態碼） */
export function planRequiredResponse(message: string, plan: ModulePlan): Response {
  return new Response(
    JSON.stringify({ error: `${message}（目前方案：${MODULE_PLAN_LABEL[plan]}）`, code: 'plan_required' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  )
}

/** 統一的「本月額度用完」回應（429，比照 chat 每日上限） */
export function quotaExceededResponse(message: string, plan: ModulePlan): Response {
  return new Response(
    JSON.stringify({ error: `${message}（目前方案：${MODULE_PLAN_LABEL[plan]}）`, code: 'monthly_limit_reached' }),
    { status: 429, headers: { 'Content-Type': 'application/json' } },
  )
}
