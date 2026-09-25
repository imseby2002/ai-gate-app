// 專屬客製-企業版的用量與成本警示（server only）。
// 企業版不扣點，但用量仍要讓平台看得到，並在超過議價月費一定比例時通知管理者。
// 用量以「一般客戶會被扣的點數」計：點數功能直接記點數；CHAT／生圖／影片只記在
// messages.cost_usd（實際成本），依行銷模組的加成慣例 ×3 換算成點數。
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdmin } from '@/lib/notify/adminAlert'

const CHAT_COST_TO_POINTS = 3

function taipeiMonth(): { key: string; startIso: string } {
  const now = new Date(Date.now() + 8 * 3600_000)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const key = `${y}-${String(m + 1).padStart(2, '0')}`
  return { key, startIso: new Date(Date.UTC(y, m, 1) - 8 * 3600_000).toISOString() }
}

/** 企業版公司本月用量（美元點數）：點數功能記錄＋CHAT 類成本換算 */
export async function getEnterpriseMonthUsage(companyId: string): Promise<{ pointsUsd: number; chatUsd: number; totalUsd: number }> {
  const admin = createAdminClient()
  const { startIso } = taipeiMonth()

  // record_company_usage 帶 0 只回傳本月合計，不寫入
  const { data: ledgerTotal } = await admin.rpc('record_company_usage', {
    p_company_id: companyId, p_user_id: null, p_amount: 0, p_description: null,
  })

  const { data: members } = await admin
    .from('company_members').select('member_id').eq('company_id', companyId).eq('status', 'active')
  const memberIds = (members ?? []).map(m => m.member_id).filter(Boolean) as string[]
  let chatCost = 0
  if (memberIds.length > 0) {
    const { data: rows } = await admin
      .from('messages').select('cost_usd').in('user_id', memberIds).gte('created_at', startIso)
    chatCost = (rows ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0)
  }

  const pointsUsd = Number(ledgerTotal ?? 0)
  const chatUsd = chatCost * CHAT_COST_TO_POINTS
  return { pointsUsd, chatUsd, totalUsd: pointsUsd + chatUsd }
}

/**
 * 本月用量達「議價月費 × 警示比例」時通知管理者，同一公司每月只通知一次。
 * 呼叫端不需等待結果（fire-and-forget），失敗只記錄不影響主流程。
 */
export async function checkEnterpriseCostAlert(companyId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { key } = taipeiMonth()

    const { data: already } = await admin
      .from('company_cost_alerts').select('month').eq('company_id', companyId).eq('month', key).maybeSingle()
    if (already) return

    const { data: sub } = await admin
      .from('company_subscriptions').select('enterprise, enterprise_monthly_usd, cost_alert_ratio')
      .eq('company_id', companyId).maybeSingle()
    const fee = Number(sub?.enterprise_monthly_usd ?? 0)
    if (!sub?.enterprise || fee <= 0) return

    const usage = await getEnterpriseMonthUsage(companyId)
    const threshold = fee * Number(sub.cost_alert_ratio ?? 0.5)
    if (usage.totalUsd < threshold) return

    // 先寫入紀錄再通知；主鍵衝突代表其他請求已通知過
    const { data: inserted } = await admin
      .from('company_cost_alerts')
      .upsert({ company_id: companyId, month: key, usage_usd: usage.totalUsd }, { onConflict: 'company_id,month', ignoreDuplicates: true })
      .select('month')
    if (!inserted?.length) return

    const { data: company } = await admin.from('companies').select('name').eq('id', companyId).single()
    await notifyAdmin(`【成本警示】${company?.name ?? companyId} 企業版本月用量已達月費 ${Math.round(Number(sub.cost_alert_ratio ?? 0.5) * 100)}%`, [
      `公司：${company?.name ?? companyId}`,
      `月份：${key}`,
      `議價月費：$${fee}`,
      `本月用量（以點數計）：$${usage.totalUsd.toFixed(2)}`,
      `　點數功能：$${usage.pointsUsd.toFixed(2)}`,
      `　CHAT／生圖／影片（實際成本 ×${CHAT_COST_TO_POINTS}）：$${usage.chatUsd.toFixed(2)}`,
    ])
  } catch (err) {
    console.error('[enterprise] 成本警示檢查失敗', { companyId, err })
  }
}
