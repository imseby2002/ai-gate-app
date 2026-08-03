/**
 * 自建表單提交通知 —— 公開表單頁與 CS 對話填表共用。
 * 立即通知（batchMode='immediate'）在這裡直接送出；
 * 每日彙整（batchMode='daily'）由 cron 批次處理，不經過這裡。
 */
import { sendToCustomer } from '@/lib/cs/send'
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

export async function notifyFormSubmission(
  userId: string,
  notifyTarget: CsFormNotifyTarget | null | undefined,
  formName: string,
  text: string,
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
    }
  } catch { /* 不中斷主流程 */ }
}
