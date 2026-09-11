import { Resend } from 'resend'

// 意見反映系統的統一 email 通知（新的計費項目待審、AI 產生 PR 待合併、AI 判斷需人工處理）。
// 通知失敗不影響主流程，靜默忽略即可——資料本來就已經寫進 user_feedback，管理後台看得到。
export async function notifyFeedbackAdmin(subject: string, lines: string[]) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const notifyTo = process.env.SUPPORT_NOTIFY_EMAIL ?? 'imseby@gmail.com'
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'marketing@aigate.app'
    await resend.emails.send({
      from: `AI GATE 系統 <${fromEmail}>`,
      to: [notifyTo],
      subject,
      text: lines.join('\n'),
    })
  } catch {
    // ignore
  }
}
