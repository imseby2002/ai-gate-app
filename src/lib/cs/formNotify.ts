/**
 * 自建表單提交通知 —— 公開表單頁與 CS 對話填表共用。
 * 立即通知（batchMode='immediate'）在這裡直接送出；
 * 每日彙整（batchMode='daily'）由 cron 批次處理，不經過這裡。
 */
import { sendToCustomer } from '@/lib/cs/send'
import { isSafeWebhookUrl } from '@/lib/ssrf'
import type { CsFormField, CsFormNotifyTarget } from '@/app/api/marketing/cs-forms/route'

export function formatFormSubmission(
  formName: string,
  fields: CsFormField[],
  answers: Record<string, string>,
  roomRef: string | null,
  isUpdate = false,
): string {
  const lines = fields
    .map(f => (answers[f.id] ? `${f.label}：${answers[f.id]}` : null))
    .filter((l): l is string => !!l)
  const header = isUpdate ? '✏️ ' + formName + ' 已更新（客人改了原本的內容，以此為準）' : `📋 ${formName} 新提交`
  return `${header}\n${roomRef ? `房號/訂單：${roomRef}\n` : ''}${lines.join('\n')}`
}

export function formatFormSubmissionBatch(
  formName: string,
  fields: CsFormField[],
  submissions: Array<{ answers: Record<string, string>; room_ref: string | null; created_at: string }>,
): string {
  const items = submissions.map((s, i) => {
    const time = new Date(s.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
    const lines = fields
      .map(f => (s.answers[f.id] ? `${f.label}：${s.answers[f.id]}` : null))
      .filter((l): l is string => !!l)
    return `${i + 1}. ${time}${s.room_ref ? `（房號/訂單：${s.room_ref}）` : ''}\n${lines.join('\n')}`
  })
  return `📋 ${formName} 今日彙整（共 ${submissions.length} 筆）\n\n${items.join('\n\n')}`.slice(0, 4500)
}

function buildAnswersByLabel(fields: CsFormField[], answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) if (answers[f.id]) out[f.label] = answers[f.id]
  return out
}

export interface NotifyResult { ok: boolean; error?: string }

// 用表單自己指定的 Telegram Bot Token 直接送出（跳過平台分頁那組共用 Bot）——
// 前提跟 LINE 那組一樣：這個 Bot 本身要先被加入目標群組。
async function pushTelegramWithToken(botToken: string, chatId: string, text: string): Promise<NotifyResult> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return { ok: true }
    const body = await res.text().catch(() => '')
    return { ok: false, error: `Telegram 送訊失敗 (${res.status})：${body.slice(0, 200)}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Telegram 送訊發生未知錯誤' }
  }
}

// 用表單自己指定的 OA 憑證直接 push（跳過平台分頁那組共用憑證）——
// 讓不同表單可以各自綁定不同的 LINE 官方帳號（例如早餐店自己的 OA），
// 前提跟平台分頁那組憑證一樣：這個 OA 帳號本身要先被加入目標群組。
async function pushLineWithToken(token: string, to: string, text: string): Promise<NotifyResult> {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return { ok: true }
    const body = await res.text().catch(() => '')
    return { ok: false, error: `LINE push 失敗 (${res.status})：${body.slice(0, 200)}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'LINE push 發生未知錯誤' }
  }
}

// 真實案例：客人透過公開表單訂了早餐，通知一直沒送到——原因是呼叫端不管這裡實際
// 有沒有送成功，一律直接把 notified_at 標記為已通知（且用 void 不等結果、內部把
// 所有錯誤都吞掉），LINE token 失效/過期這種真的送不出去的狀況完全沒有人知道。
// 這裡改成把「是否真的送成功」老實回傳出去，呼叫端才能依實際結果決定要不要標記
// notified_at，失敗時也留下原因方便之後排查或重試。
export async function notifyFormSubmission(
  userId: string,
  notifyTarget: CsFormNotifyTarget | null | undefined,
  formName: string,
  text: string,
  webhook?: { fields: CsFormField[]; answers: Record<string, string>; roomRef: string | null },
): Promise<NotifyResult> {
  if (!notifyTarget?.platform || !notifyTarget.to) return { ok: false, error: '尚未設定通知對象' }
  try {
    if (notifyTarget.platform === 'line') {
      if (notifyTarget.lineToken?.trim()) {
        return await pushLineWithToken(notifyTarget.lineToken.trim(), notifyTarget.to, text)
      }
      const r = await sendToCustomer(userId, 'line', notifyTarget.to, text)
      return { ok: r.ok, error: r.error }
    } else if (notifyTarget.platform === 'telegram') {
      if (notifyTarget.telegramBotToken?.trim()) {
        return await pushTelegramWithToken(notifyTarget.telegramBotToken.trim(), notifyTarget.to, text)
      }
      const r = await sendToCustomer(userId, 'telegram', notifyTarget.to, text)
      return { ok: r.ok, error: r.error }
    } else if (notifyTarget.platform === 'email' && process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: notifyTarget.to,
        subject: `新表單提交通知：${formName}`,
        text,
      })
      return error ? { ok: false, error: String(error.message ?? error) } : { ok: true }
    } else if (notifyTarget.platform === 'webhook' && isSafeWebhookUrl(notifyTarget.to)) {
      const res = await fetch(notifyTarget.to, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formName,
          text,
          roomRef: webhook?.roomRef ?? null,
          answers: webhook?.answers ?? {},
          answersByLabel: webhook ? buildAnswersByLabel(webhook.fields, webhook.answers) : {},
          submittedAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(8000),
      })
      return res.ok ? { ok: true } : { ok: false, error: `webhook 回應 ${res.status}` }
    }
    return { ok: false, error: '通知平台設定不完整或不支援' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '通知時發生未知錯誤' }
  }
}
