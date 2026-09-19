import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

interface AdminAlertSettings {
  notify_email: string | null
  telegram_bot_token: string | null
  telegram_chat_id: string | null
}

let cached: { settings: AdminAlertSettings | null; at: number } | null = null

async function getSettings(): Promise<AdminAlertSettings | null> {
  // 短暫快取：同一次 serverless 執行內若連續呼叫多次通知，不用每次都查表
  if (cached && Date.now() - cached.at < 30000) return cached.settings
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_notify_settings')
    .select('notify_email, telegram_bot_token, telegram_chat_id')
    .eq('id', 1)
    .maybeSingle()
  cached = { settings: data ?? null, at: Date.now() }
  return cached.settings
}

export interface NotifyAdminResult {
  emailSent: boolean
  emailError: string | null
  telegramSent: boolean
  telegramError: string | null
}

// 平台管理者通知：CS 協助請求、意見反映等後台需要即時知道的事件。
// 收件人／Telegram 設定可在 /admin/notify-settings 後台調整，未設定時退回環境變數與預設值。
// Email 走 Resend、Telegram 走 Bot API。一般呼叫端（送出通知本身）不理會回傳值，
// 通知失敗不影響主流程；回傳結果只給 /admin/notify-settings 的「測試通知」按鈕用來顯示成敗。
export async function notifyAdmin(subject: string, lines: string[]): Promise<NotifyAdminResult> {
  const settings = await getSettings()
  const result: NotifyAdminResult = { emailSent: false, emailError: null, telegramSent: false, telegramError: null }

  const emailTo = settings?.notify_email?.trim() || process.env.SUPPORT_NOTIFY_EMAIL || 'imseby@gmail.com'
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'marketing@aigate.app'
      await resend.emails.send({
        from: `IMT 系統通知 <${fromEmail}>`,
        to: [emailTo],
        subject,
        text: lines.join('\n'),
      })
      result.emailSent = true
    } catch (e) {
      result.emailError = e instanceof Error ? e.message : String(e)
    }
  } else {
    result.emailError = '未設定 RESEND_API_KEY'
  }

  const botToken = settings?.telegram_bot_token?.trim()
  const chatId = settings?.telegram_chat_id?.trim()
  if (botToken && chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `${subject}\n\n${lines.join('\n')}` }),
      })
      if (res.ok) {
        result.telegramSent = true
      } else {
        const body = await res.json().catch(() => ({}))
        result.telegramError = body?.description ?? `HTTP ${res.status}`
      }
    } catch (e) {
      result.telegramError = e instanceof Error ? e.message : String(e)
    }
  } else {
    result.telegramError = '尚未設定 Telegram bot token／chat id'
  }

  return result
}
