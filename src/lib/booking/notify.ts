import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationType = 'confirmation' | 'reminder' | 'checkout' | 'cancellation'

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

function nightsBetween(a: string, b: string) {
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

const DEFAULT_SUBJECT: Record<NotificationType, string> = {
  confirmation: '【訂房確認】感謝您預訂 {{bnb_name}}',
  reminder:     '【入住提醒】明天入住 {{bnb_name}}，相關資訊請查看',
  checkout:     '【退房提醒】今日退房時間 {{check_out_time}}，感謝入住',
  cancellation: '【訂單取消】您的訂房已取消',
}

const DEFAULT_BODY: Record<NotificationType, string> = {
  confirmation: `<p>親愛的 <strong>{{guest_name}}</strong> 您好，</p>
<p>感謝您預訂 <strong>{{bnb_name}}</strong>！以下是您的訂房確認資訊：</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">房型</td><td style="padding:6px 12px">{{property_name}}</td></tr>
  <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">入住日期</td><td style="padding:6px 12px">{{check_in}} {{check_in_time}}</td></tr>
  <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">退房日期</td><td style="padding:6px 12px">{{check_out}} {{check_out_time}}</td></tr>
  <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">住宿晚數</td><td style="padding:6px 12px">{{num_nights}} 晚</td></tr>
  <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">住客人數</td><td style="padding:6px 12px">{{num_guests}} 人</td></tr>
  <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">訂單金額</td><td style="padding:6px 12px">NT$ {{total_price}}</td></tr>
</table>
{{notes_block}}
<p style="margin-top:24px">如有任何問題，歡迎聯絡我們：<br>📞 {{bnb_phone}}<br>📧 {{bnb_email}}</p>
<p>期待您的到來！</p>`,
  reminder: `<p>親愛的 <strong>{{guest_name}}</strong> 您好，</p>
<p>明天就是您入住 <strong>{{bnb_name}}</strong> 的日子了！提醒您相關資訊如下：</p>
<ul>
  <li>入住時間：{{check_in_time}}</li>
  <li>退房時間：{{check_out_time}}</li>
  <li>地址：{{bnb_address}}</li>
</ul>
<p>如有任何問題，歡迎聯絡我們：{{bnb_phone}}</p>
<p>期待您的到來！</p>`,
  checkout: `<p>親愛的 <strong>{{guest_name}}</strong> 您好，</p>
<p>感謝您入住 <strong>{{bnb_name}}</strong>！提醒您今日退房時間為 <strong>{{check_out_time}}</strong>。</p>
<p>希望您住得愉快，期待下次再見！</p>`,
  cancellation: `<p>親愛的 <strong>{{guest_name}}</strong> 您好，</p>
<p>您的 <strong>{{bnb_name}}</strong> 訂房（{{check_in}} ~ {{check_out}}）已取消。</p>
<p>如有任何疑問，歡迎聯絡我們：{{bnb_phone}}</p>`,
}

interface SendResult { ok: boolean; sentTo?: string; error?: string }

/**
 * Send a booking notification email for a row in the `bookings` table.
 * Shared by the manual send route, the public-booking confirm flow, and the
 * reminder/checkout cron. Records every attempt in `booking_notifications`.
 */
export async function sendBookingNotification(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string,
  type: NotificationType,
  toOverride?: string,
): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY 未設定' }

  const [{ data: booking }, { data: profile }, { data: tpl }] = await Promise.all([
    supabase.from('bookings').select('*, properties(name)').eq('id', bookingId).eq('user_id', userId).single(),
    supabase.from('bnb_profiles').select('name,email,phone,address,check_in_time,check_out_time').eq('user_id', userId).maybeSingle(),
    supabase.from('email_templates').select('*').eq('user_id', userId).eq('type', type).maybeSingle(),
  ])

  if (!booking) return { ok: false, error: '訂單不存在' }
  const to = toOverride || booking.guest_email
  if (!to) return { ok: false, error: '旅客未填寫 Email' }

  const subject  = tpl?.subject   || DEFAULT_SUBJECT[type] || '民宿通知'
  const bodyHtml = tpl?.body_html || DEFAULT_BODY[type] || ''

  const nights = nightsBetween(booking.check_in, booking.check_out)
  const notes_block = booking.notes
    ? `<p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 12px;margin:12px 0">備註：${booking.notes}</p>`
    : ''

  const vars: Record<string, string> = {
    guest_name:     booking.guest_name ?? '旅客',
    property_name:  (booking as Record<string, unknown> & { properties?: { name: string } }).properties?.name ?? '',
    check_in:       booking.check_in,
    check_out:      booking.check_out,
    num_nights:     String(nights),
    num_guests:     String(booking.num_guests ?? 1),
    total_price:    booking.total_price ? Number(booking.total_price).toLocaleString() : '—',
    notes:          booking.notes ?? '',
    notes_block,
    bnb_name:       profile?.name ?? '民宿',
    bnb_phone:      profile?.phone ?? '',
    bnb_email:      profile?.email ?? '',
    bnb_address:    profile?.address ?? '',
    check_in_time:  profile?.check_in_time ?? '15:00',
    check_out_time: profile?.check_out_time ?? '11:00',
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const fromName  = profile?.name ?? '民宿訂房系統'

  let status = 'sent'
  let errorMsg: string | undefined
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject: fillTemplate(subject, vars),
      html: fillTemplate(bodyHtml, vars),
    })
  } catch (e) {
    status = 'failed'
    errorMsg = e instanceof Error ? e.message : String(e)
  }

  await supabase.from('booking_notifications').insert({
    user_id: userId, booking_id: bookingId, type, sent_to: to, status, error_msg: errorMsg,
  })

  return status === 'sent' ? { ok: true, sentTo: to } : { ok: false, error: errorMsg }
}
