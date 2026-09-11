import { createAdminClient } from '@/lib/supabase/admin'

// 錯誤回報（bug/ai_error）一律免費；功能新增/調整（feature/text_change）預設要
// 計費。公司可以有兩種免計費設定，擇一適用（free_features 優先）：
// - feedback_free_features=true：完全免費、不限次數
// - free_feature_quota_monthly=N：每月前 N 次功能修改免費，超過才要計費
const PAID_TYPES = new Set(['feature', 'text_change'])

function taipeiMonthStart(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00+08:00`
}

export interface FeedbackBillingResult {
  isPaid: boolean
  initialStatus: 'pending' | 'awaiting_approval'
  /** 有設定每月免費額度時才有值，方便呼叫端在通知信裡附上用量 */
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

  const quota = company?.free_feature_quota_monthly
  if (quota != null && quota > 0) {
    const { count } = await admin
      .from('user_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('type', ['feature', 'text_change'])
      .eq('is_paid', false)
      .gte('created_at', taipeiMonthStart())

    const used = count ?? 0
    if (used < quota) return { isPaid: false, initialStatus: 'pending', quota: { used: used + 1, limit: quota } }
    return { isPaid: true, initialStatus: 'awaiting_approval', quota: { used, limit: quota } }
  }

  return { isPaid: true, initialStatus: 'awaiting_approval' }
}
