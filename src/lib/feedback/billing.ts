import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyEntitlements } from '@/lib/company/entitlements'

// 錯誤回報（bug/ai_error）一律免費；功能新增/調整（feature/text_change）預設要
// 計費。公司的每月免費額度，優先順序：
// 1. feedback_free_features=true：完全免費、不限次數（手動覆寫，最優先）
// 2. companies.free_feature_quota_monthly：手動覆寫的每月次數（有設定就蓋過方案預設）
// 3. 公司會員方案（company_subscriptions，free/core/pro/max）的預設每月次數
const PAID_TYPES = new Set(['feature', 'text_change'])

function taipeiMonthStart(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00+08:00`
}

export interface FeedbackBillingResult {
  isPaid: boolean
  initialStatus: 'pending' | 'awaiting_approval'
  /** 有適用每月免費額度時才有值，方便呼叫端在通知信裡附上用量 */
  quota?: { used: number; limit: number }
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
