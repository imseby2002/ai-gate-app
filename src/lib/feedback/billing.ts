import { createAdminClient } from '@/lib/supabase/admin'

// 錯誤回報（bug/ai_error）一律免費；功能新增/調整（feature/text_change）預設要
// 計費，但所屬公司若被標記 feedback_free_features 就視同免費，直接走自動修復。
const PAID_TYPES = new Set(['feature', 'text_change'])

export async function resolveFeedbackBilling(
  companyId: string | null,
  type: string
): Promise<{ isPaid: boolean; initialStatus: 'pending' | 'awaiting_approval' }> {
  if (!PAID_TYPES.has(type)) return { isPaid: false, initialStatus: 'pending' }

  if (companyId) {
    const admin = createAdminClient()
    const { data: company } = await admin
      .from('companies')
      .select('feedback_free_features')
      .eq('id', companyId)
      .single()
    if (company?.feedback_free_features) return { isPaid: false, initialStatus: 'pending' }
  }

  return { isPaid: true, initialStatus: 'awaiting_approval' }
}
