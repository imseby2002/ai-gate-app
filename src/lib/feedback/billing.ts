import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyEntitlements } from '@/lib/company/entitlements'
import { ENTERPRISE_FEEDBACK_DEFAULT_HOURS, ENTERPRISE_TIER_DEFS, isEnterpriseTier } from '@/lib/company/enterprise-plans'

// 錯誤回報（bug/ai_error）一律免費；功能新增/調整（feature/text_change）預設要
// 計費。公司的每月免費額度，優先順序：
// 1. feedback_free_features=true 或未指定等級的舊企業版：完全免費、不限次數（最優先）
//    已指定等級的企業版改以「每月客製工時」計算（CORE 0、PRO 4、MAX 10 小時；每件未填實際工時以 1 小時計；MAX 上月未用完可留到本月，最多 10 小時）
// 2. companies.free_feature_quota_monthly：手動覆寫的每月次數（有設定就蓋過方案預設）
// 3. 公司會員方案（company_subscriptions，free/core/pro/max）的預設每月次數
const PAID_TYPES = new Set(['feature', 'text_change'])

function taipeiMonthStart(monthOffset = 0): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00+08:00`
}

export interface FeedbackBillingResult {
  isPaid: boolean
  initialStatus: 'pending' | 'awaiting_approval'
  /** 有適用每月免費額度時才有值，方便呼叫端在通知信裡附上用量 */
  quota?: { used: number; limit: number; unit?: 'hours' }
}

export async function resolveFeedbackBilling(
  companyId: string | null,
  type: string
): Promise<FeedbackBillingResult> {
  if (!PAID_TYPES.has(type)) return { isPaid: false, initialStatus: 'pending' }
  if (!companyId) return { isPaid: true, initialStatus: 'awaiting_approval' }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('feedback_free_features, free_feature_quota_monthly')
    .eq('id', companyId)
    .single()

  if (company?.feedback_free_features) return { isPaid: false, initialStatus: 'pending' }

  const { data: enterprise } = await admin.rpc('company_enterprise_active', { p_company_id: companyId })
  if (enterprise) {
    const { data: sub } = await admin.from('company_subscriptions').select('enterprise_tier').eq('company_id', companyId).maybeSingle()
    // 未指定等級的舊企業版：功能新增／調整不限次數、不計費
    if (!isEnterpriseTier(sub?.enterprise_tier)) return { isPaid: false, initialStatus: 'pending' }

    // 已指定等級：本月已用工時（免費件，未填實際工時以預設時數計）＋本件預設時數 不超過內含工時才免費
    const def = ENTERPRISE_TIER_DEFS[sub.enterprise_tier]
    const hoursSince = async (from: string, to?: string) => {
      let q = admin
        .from('user_feedback')
        .select('custom_hours')
        .eq('company_id', companyId)
        .in('type', ['feature', 'text_change'])
        .eq('is_paid', false)
        .gte('created_at', from)
      if (to) q = q.lt('created_at', to)
      const { data: rows } = await q
      return (rows ?? []).reduce((s, r) => s + Number(r.custom_hours ?? ENTERPRISE_FEEDBACK_DEFAULT_HOURS), 0)
    }
    const used = await hoursSince(taipeiMonthStart())
    // 上個月未用完的工時可留到本月（MAX 最多 10 小時）
    const carried = def.rolloverHours > 0
      ? Math.min(def.rolloverHours, Math.max(0, def.customHours - await hoursSince(taipeiMonthStart(-1), taipeiMonthStart())))
      : 0
    const limit = def.customHours + carried
    if (used + ENTERPRISE_FEEDBACK_DEFAULT_HOURS <= limit) {
      return { isPaid: false, initialStatus: 'pending', quota: { used: used + ENTERPRISE_FEEDBACK_DEFAULT_HOURS, limit, unit: 'hours' } }
    }
    return { isPaid: true, initialStatus: 'awaiting_approval', quota: { used, limit, unit: 'hours' } }
  }

  // 手動覆寫次數優先於方案預設；沒有手動覆寫才吃會員方案的預設額度
  let quotaLimit = company?.free_feature_quota_monthly
  if (quotaLimit == null) {
    const { features } = await getCompanyEntitlements(admin, companyId)
    quotaLimit = features.freeFeatureQuotaMonthly
  }

  if (quotaLimit != null && quotaLimit > 0) {
    const { count } = await admin
      .from('user_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('type', ['feature', 'text_change'])
      .eq('is_paid', false)
      .gte('created_at', taipeiMonthStart())

    const used = count ?? 0
    if (used < quotaLimit) return { isPaid: false, initialStatus: 'pending', quota: { used: used + 1, limit: quotaLimit } }
    return { isPaid: true, initialStatus: 'awaiting_approval', quota: { used, limit: quotaLimit } }
  }

  return { isPaid: true, initialStatus: 'awaiting_approval' }
}
