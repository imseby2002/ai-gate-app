// HR 通知：站內恆存；Telegram/Email 依 hr_settings 開關（best-effort，不 throw）。
// Telegram/ZALO 憑證沿用 social_platform_credentials（後台可設定，不寫死）。
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendToCustomer } from '@/lib/cs/send'

interface HRNotice {
  kind: string
  title: string
  body: string
  candidateId?: string
}

// 通知人事（owner）
export async function notifyHR(ownerId: string, notice: HRNotice): Promise<void> {
  const admin = createAdminClient()

  // 1) 站內（永遠寫入）
  await admin.from('hr_notifications').insert({
    owner_id: ownerId,
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    candidate_id: notice.candidateId ?? null,
  })

  // 2) 讀通知偏好
  const { data: setting } = await admin
    .from('hr_settings').select('notify_telegram, notify_email').eq('owner_id', ownerId).single()
  if (!setting) return

  const text = `${notice.title}\n\n${notice.body}`

  // Telegram（收件人 = social credentials 的 telegram_admin_chat_id）
  if (setting.notify_telegram) {
    try {
      const { data: cred } = await admin
        .from('social_platform_credentials').select('credentials')
        .eq('user_id', ownerId).eq('platform', 'telegram').single()
      const chatId = (cred?.credentials as Record<string, string> | undefined)?.telegram_admin_chat_id
      if (chatId) await sendToCustomer(ownerId, 'telegram', chatId, text)
    } catch { /* best-effort */ }
  }

  // Email（收件人 = 人事本人 profiles.email）
  if (setting.notify_email && process.env.RESEND_API_KEY) {
    try {
      const { data: profile } = await admin.from('profiles').select('email').eq('id', ownerId).single()
      if (profile?.email) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate HR <hr@im-tourist.com>',
          to: [profile.email],
          subject: notice.title,
          text: notice.body,
        })
      }
    } catch { /* best-effort */ }
  }
}

// 通知應徵者（Email 或 ZALO）。回傳結果供後台顯示。
export async function notifyApplicant(
  ownerId: string,
  candidate: { email?: string | null; notify_channel?: string | null; zalo_user_id?: string | null; name?: string },
  subject: string,
  message: string,
): Promise<{ ok: boolean; error?: string; channel?: string }> {
  const channel = candidate.notify_channel === 'zalo' ? 'zalo' : 'email'

  if (channel === 'zalo') {
    if (!candidate.zalo_user_id) return { ok: false, error: '應徵者尚未加入 ZALO OA（無 user id）' }
    const r = await sendToCustomer(ownerId, 'zalo', candidate.zalo_user_id, `${subject}\n\n${message}`)
    return r.ok ? { ok: true, channel: 'zalo' } : { ok: false, error: r.error, channel: 'zalo' }
  }

  if (!candidate.email) return { ok: false, error: '應徵者無 Email' }
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY 未設定' }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'AI Gate HR <hr@im-tourist.com>',
      to: [candidate.email],
      subject,
      text: message,
    })
    if (error) return { ok: false, error: error.message, channel: 'email' }
    return { ok: true, channel: 'email' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '寄信失敗', channel: 'email' }
  }
}
