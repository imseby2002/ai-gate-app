import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/booking/payment'
import { verifyCronAuth } from '@/lib/cron/auth'

// Vercel Cron（每日）：仍待確認的官網訂房申請（到店付款／轉帳／信用卡）每天寄信通知民宿主，
// 直到手動確認、取消，或未收款超過 48 小時被 release-stale-bookings 自動取消為止。
export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: '未設定 RESEND_API_KEY' }, { status: 500 })

  const admin = createAdminClient()
  const { data: rows, error } = await admin.from('public_bookings')
    .select('host_user_id, confirmation_code, guest_name, guest_phone, guest_email, check_in, check_out, total_price, payment_method, payment_status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byHost = new Map<string, NonNullable<typeof rows>>()
  for (const r of rows ?? []) {
    const list = byHost.get(r.host_user_id) ?? []
    list.push(r)
    byHost.set(r.host_user_id, list)
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const payLabel = (m: string | null, st: string | null) =>
    st === 'paid' ? '已收款' : st === 'reported' ? '已回報匯款' : m === 'card' ? '尚未刷卡' : m === 'transfer' ? '待匯款' : '到店收款'
  const autoCancelAt = (created: string) => new Date(new Date(created).getTime() + 48 * 3600_000)
    .toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  let sent = 0
  const failed: string[] = []

  for (const [hostId, list] of byHost) {
    const { data: profile } = await admin.from('bnb_profiles').select('name, email').eq('user_id', hostId).maybeSingle()
    let to = profile?.email?.trim() || ''
    if (!to) {
      const { data: u } = await admin.auth.admin.getUserById(hostId)
      to = u?.user?.email ?? ''
    }
    if (!to) { failed.push(hostId); continue }

    const rowsHtml = list.map(b => `<tr>
<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace">${esc(b.confirmation_code ?? '')}</td>
<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(b.guest_name ?? '')}<br><span style="color:#64748b;font-size:12px">${esc(b.guest_phone ?? b.guest_email ?? '')}</span></td>
<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(b.check_in)} ~ ${esc(b.check_out)}</td>
<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${b.total_price != null ? `NT$ ${Number(b.total_price).toLocaleString()}` : '—'}</td>
<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(PAYMENT_METHOD_LABEL[b.payment_method as PaymentMethod] ?? '到店付款')}・${payLabel(b.payment_method, b.payment_status)}</td>
<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#64748b">${b.payment_status === 'paid' ? '已收款，不會自動取消' : `${autoCancelAt(b.created_at)} 前未處理將自動取消`}</td>
</tr>`).join('')

    try {
      await resend.emails.send({
        from: `AI-GATE 訂房系統 <${fromEmail}>`,
        to,
        subject: `【待處理】${list.length} 筆官網訂房申請等待確認`,
        html: `<p>${esc(profile?.name ?? '您的民宿')} 有 ${list.length} 筆官網訂房申請尚未處理，房間保留中。</p>
<p>請到「線上訂房申請」手動<strong>確認</strong>或<strong>取消</strong>。未收款的申請建立超過 48 小時會自動取消；處理前每天都會收到這封提醒。</p>
<table style="border-collapse:collapse;font-size:14px"><tr style="background:#f1f5f9">
<th style="padding:6px 10px;text-align:left">確認碼</th><th style="padding:6px 10px;text-align:left">旅客</th><th style="padding:6px 10px;text-align:left">日期</th><th style="padding:6px 10px;text-align:right">金額</th><th style="padding:6px 10px;text-align:left">付款</th><th style="padding:6px 10px;text-align:left">備註</th>
</tr>${rowsHtml}</table>
${appUrl ? `<p style="margin-top:16px"><a href="${appUrl}/booking/public-bookings">前往處理</a></p>` : ''}`,
      })
      sent++
    } catch (e) {
      console.error('[pending-booking-reminders] send failed', hostId, e)
      failed.push(hostId)
    }
  }

  return NextResponse.json({ hosts: byHost.size, sent, failed: failed.length })
}
