// 跨管道通知/核准抽象層。
// 內部轉呼叫既有的傳輸機制（Telegram / sendToCustomer / telephony sendSms / resend），
// 不重造傳輸邏輯；只負責「解析用哪個管道、寄給誰」與「寫入 agent_approvals」。
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendToCustomer } from '@/lib/cs/send'
import { getTelephonyProvider } from '@/lib/telephony'
import type { NotifyChannel, NotifyHumanParams, NotifyHumanResult, RequestApprovalParams } from './types'

interface ResolvedTarget {
  channel: NotifyChannel
  // 各管道實際送達所需的收件資訊
  telegramBotToken?: string
  telegramChatId?: string
  email?: string
  smsPhone?: string
  platformSelfId?: string
}

async function resolveChannelAndTarget(userId: string, preferred?: NotifyChannel): Promise<ResolvedTarget | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email, telegram_bot_token, telegram_chat_id, preferred_notify_channel, preferred_notify_target')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return null

  const target = (profile.preferred_notify_target ?? {}) as Record<string, string>
  const order: NotifyChannel[] = preferred
    ? [preferred]
    : [(profile.preferred_notify_channel as NotifyChannel) ?? 'telegram', 'telegram', 'email']

  for (const channel of order) {
    if (channel === 'telegram' && profile.telegram_bot_token && profile.telegram_chat_id) {
      return { channel, telegramBotToken: profile.telegram_bot_token, telegramChatId: profile.telegram_chat_id }
    }
    if (channel === 'email' && profile.email) {
      return { channel, email: profile.email }
    }
    if (channel === 'sms' && target.sms_phone) {
      return { channel, smsPhone: target.sms_phone }
    }
    if (['line', 'whatsapp', 'whatsapp-personal', 'zalo'].includes(channel) && target[`${channel}_id`]) {
      return { channel, platformSelfId: target[`${channel}_id`] }
    }
  }
  // 兜底：email 一定有（profiles.email 必填）
  return profile.email ? { channel: 'email', email: profile.email } : null
}

async function deliver(target: ResolvedTarget, userId: string, title: string, body: string): Promise<NotifyHumanResult> {
  const text = `${title}\n\n${body}`
  try {
    if (target.channel === 'in_app') {
      return { ok: true, channel: 'in_app' }
    }
    if (target.channel === 'telegram' && target.telegramBotToken && target.telegramChatId) {
      const res = await fetch(`https://api.telegram.org/bot${target.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: target.telegramChatId, text, parse_mode: 'HTML' }),
      })
      const data = await res.json()
      if (!data.ok) return { ok: false, error: data.description ?? 'Telegram 傳送失敗' }
      return { ok: true, channel: 'telegram', externalId: String(data.result?.message_id ?? '') }
    }
    if (target.channel === 'email' && target.email) {
      if (!process.env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY 未設定' }
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate Agent <agent@im-tourist.com>',
        to: [target.email],
        subject: title,
        text: body,
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true, channel: 'email', externalId: data?.id }
    }
    if (target.channel === 'sms' && target.smsPhone) {
      const provider = getTelephonyProvider()
      if (!provider.isConfigured()) return { ok: false, error: '電話/簡訊服務未設定' }
      const ok = await provider.sendSms({ phone: target.smsPhone, text: text.slice(0, 480) })
      return ok ? { ok: true, channel: 'sms' } : { ok: false, error: 'SMS 發送失敗' }
    }
    if (['line', 'whatsapp', 'whatsapp-personal', 'zalo'].includes(target.channel) && target.platformSelfId) {
      const result = await sendToCustomer(userId, target.channel, target.platformSelfId, text)
      return result.ok ? { ok: true, channel: target.channel } : { ok: false, error: result.error }
    }
    return { ok: false, error: `尚未設定 ${target.channel} 管道` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function notifyHuman(params: NotifyHumanParams): Promise<NotifyHumanResult> {
  const target = await resolveChannelAndTarget(params.userId, params.channel)
  if (!target) return { ok: false, error: '找不到可用的通知管道' }
  return deliver(target, params.userId, params.title, params.body)
}

export async function requestHumanApproval(
  params: RequestApprovalParams,
): Promise<{ approvalId: string }> {
  const admin = createAdminClient()
  const target = await resolveChannelAndTarget(params.userId, params.channel)
  const channel: NotifyChannel = target?.channel ?? 'in_app'

  const { data: approval, error } = await admin
    .from('agent_approvals')
    .insert({
      run_id: params.runId,
      user_id: params.userId,
      role_id: params.roleId,
      action_type: params.actionType,
      summary: params.summary,
      details: params.details ?? {},
      risk_level: params.riskLevel ?? 'medium',
      channel,
      channel_thread_id: channel === 'telegram' ? target?.telegramChatId : target?.platformSelfId ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !approval) throw new Error(`建立核准請求失敗：${error?.message}`)

  const title = `🔔 需要您核准（${params.riskLevel ?? 'medium'} 風險）`
  const body =
    `角色：${params.roleId}\n動作類型：${params.actionType}\n\n${params.summary}\n\n` +
    (channel === 'telegram'
      ? '請點擊下方按鈕回覆，或直接在此對話回覆意見。'
      : channel === 'in_app'
        ? '請至 agent.im-tourist.com 的「待核准」頁面處理。'
        : '請回覆「同意」核准，或回覆「拒絕」與您的意見。')

  if (channel === 'telegram' && target?.telegramBotToken && target.telegramChatId) {
    const res = await fetch(`https://api.telegram.org/bot${target.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: target.telegramChatId,
        text: `${title}\n\n${body}`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ 允許', callback_data: `agent_approval:${approval.id}:approve` },
            { text: '✏️ 修改意見', callback_data: `agent_approval:${approval.id}:modify` },
            { text: '❌ 拒絕', callback_data: `agent_approval:${approval.id}:reject` },
          ]],
        },
      }),
    })
    const data = await res.json()
    if (data.ok && data.result?.message_id) {
      await admin.from('agent_approvals').update({ external_message_id: String(data.result.message_id) }).eq('id', approval.id)
    }
  } else if (target) {
    await deliver(target, params.userId, title, body)
  }

  return { approvalId: approval.id }
}
