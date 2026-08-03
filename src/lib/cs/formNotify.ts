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
): string {
  const lines = fields
    .map(f => (answers[f.id] ? `${f.label}：${answers[f.id]}` : null))
    .filter((l): l is string => !!l)
  return `📋 ${formName} 新提交\n${roomRef ? `房號/訂單：${roomRef}\n` : ''}${lines.join('\n')}`
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

export async function notifyFormSubmission(
  userId: string,
  notifyTarget: CsFormNotifyTarget | null | undefined,
  formName: string,
  text: string,
  webhook?: { fields: CsFormField[]; answers: Record<string, string>; roomRef: string | null },
): Promise<void> {
  if (!notifyTarget?.platform || !notifyTarget.to) return
  try {
    if (notifyTarget.platform === 'line') {
      await sendToCustomer(userId, 'line', notifyTarget.to, text)
    } else if (notifyTarget.platform === 'email' && process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: notifyTarget.to,
        subject: `新表單提交通知：${formName}`,
        text,
      })
    } else if (notifyTarget.platform === 'webhook' && isSafeWebhookUrl(notifyTarget.to)) {
      await fetch(notifyTarget.to, {
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
    }
  } catch { /* 不中斷主流程 */ }
}
