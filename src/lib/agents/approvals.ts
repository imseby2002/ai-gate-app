// 核准回覆 → 續跑 run 的通用邏輯。
// 不論回覆從哪個管道進來（Telegram callback、LINE/WhatsApp webhook、SMS 收件…），
// 都呼叫這裡的 resumeRunAfterApproval，取代舊 telegram-webhook 對 marketing_campaigns 的專用寫法。
import { createAdminClient } from '@/lib/supabase/admin'
import type { ApprovalStatus } from './types'

export type ApprovalOutcome = 'approved' | 'rejected' | 'feedback'

const OUTCOME_TO_STATUS: Record<ApprovalOutcome, ApprovalStatus> = {
  approved: 'approved',
  rejected: 'rejected',
  feedback: 'feedback',
}

/** 從 Telegram callback_data（'agent_approval:<uuid>:approve'）解析 approvalId + outcome */
export function parseApprovalCallback(callbackData: string): { approvalId: string; outcome: ApprovalOutcome } | null {
  const m = callbackData.match(/^agent_approval:([0-9a-f-]{36}):(approve|reject|modify)$/i)
  if (!m) return null
  const outcome: ApprovalOutcome = m[2] === 'approve' ? 'approved' : m[2] === 'reject' ? 'rejected' : 'feedback'
  return { approvalId: m[1], outcome }
}

/**
 * 純文字回覆管道（SMS、LINE/WhatsApp/Zalo 等客服 webhook 共用）的退回策略：
 * 找該使用者在此管道最新一筆待處理核准。
 *
 * channelThreadId 必填且務必傳入「發話者在該平台的 id」：像 LINE/WhatsApp 這類
 * webhook 是所有客戶共用同一支端點，核准請求是老闆用自己的帳號回覆，
 * 若不比對 channel_thread_id 是否等於老闆本人的 id，一般客戶隨口說「好」「OK」
 * 就會被誤判成核准回覆、吃掉本該給客服的訊息。
 */
export async function findLatestPendingApproval(userId: string, channel: string, channelThreadId: string) {
  if (!channelThreadId) return undefined
  const admin = createAdminClient()
  const { data } = await admin
    .from('agent_approvals')
    .select('id')
    .eq('user_id', userId)
    .eq('channel', channel)
    .eq('channel_thread_id', channelThreadId)
    .in('status', ['pending', 'awaiting_feedback'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id as string | undefined
}

export async function resumeRunAfterApproval(
  approvalId: string,
  outcome: ApprovalOutcome,
  feedback?: string,
): Promise<{ ok: boolean; runId?: string; error?: string }> {
  const admin = createAdminClient()
  const { data: approval, error: fetchErr } = await admin
    .from('agent_approvals')
    .select('id, run_id, status')
    .eq('id', approvalId)
    .maybeSingle()
  if (fetchErr || !approval) return { ok: false, error: '找不到此核准請求' }
  if (!['pending', 'awaiting_feedback'].includes(approval.status)) {
    return { ok: false, error: '此核准請求已處理過' }
  }

  await admin
    .from('agent_approvals')
    .update({
      status: OUTCOME_TO_STATUS[outcome],
      feedback: feedback ?? null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', approvalId)

  if (!approval.run_id) return { ok: true }

  await admin
    .from('agent_runs')
    .update({ status: 'running', trigger_type: 'followup_approval', next_tick_at: new Date().toISOString() })
    .eq('id', approval.run_id)
    .eq('status', 'waiting_approval')

  // best-effort 立即續跑：不等待、不阻塞呼叫端（webhook 需快速回 200 給平台）
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  const cronSecret = process.env.CRON_SECRET
  if (baseUrl && cronSecret) {
    fetch(`${baseUrl}/api/cron/agent-tick`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch(() => { /* 失敗無妨，下一次 cron 輪詢會撿到 */ })
  }

  return { ok: true, runId: approval.run_id }
}
