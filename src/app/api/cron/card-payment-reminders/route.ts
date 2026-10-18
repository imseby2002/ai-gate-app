import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron（每日）：官網訂房選信用卡但尚未付款、仍待確認的申請不會自動取消，
// 每天寄信通知民宿主，直到有人手動確認或取消（status 不再是 pending）為止。
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: '未設定 RESEND_API_KEY' }, { status: 500 })

  const admin = createAdminClient()
  const { data: rows, error } = await admin.from('public_bookings')
    .select('host_user_id, confirmation_code, guest_name, guest_phone, guest_email, check_in, check_out, total_price, created_at')
    .eq('status', 'pending').eq('payment_method', 'card').neq('payment_status', 'paid')
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
</tr>`).join('')

    try {
      await resend.emails.send({
        from: `AI-GATE 訂房系統 <${fromEmail}>`,
        to,
        subject: `【待處理】${list.length} 筆官網訂房信用卡尚未付款`,
        html: `<p>${esc(profile?.name ?? '您的民宿')} 有 ${list.length} 筆官網訂房選擇信用卡付款，但尚未完成付款。</p>
<p>這些訂房<strong>不會自動取消</strong>，房間仍保留中。請聯絡旅客後，到「線上訂房申請」手動<strong>確認</strong>或<strong>取消</strong>；處理前每天都會收到這封提醒。</p>
<table style="border-collapse:collapse;font-size:14px"><tr style="background:#f1f5f9">
<th style="padding:6px 10px;text-align:left">確認碼</th><th style="padding:6px 10px;text-align:left">旅客</th><th style="padding:6px 10px;text-align:left">日期</th><th style="padding:6px 10px;text-align:right">金額</th>
</tr>${rowsHtml}</table>
${appUrl ? `<p style="margin-top:16px"><a href="${appUrl}/booking/public-bookings">前往處理</a></p>` : ''}`,
      })
      sent++
    } catch (e) {
      console.error('[card-payment-reminders] send failed', hostId, e)
      failed.push(hostId)
    }
  }

  return NextResponse.json({ hosts: byHost.size, sent, failed: failed.length })
}
