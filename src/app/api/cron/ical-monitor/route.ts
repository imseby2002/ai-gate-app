import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import { ICAL_PLATFORMS } from '@/lib/booking/ical-sync'

// Vercel Cron（每日）：iCal 偵測報告。寄給民宿主人一封彙整信：
//  1) 過去 24h 由 iCal 新進的訂房（哪間房、哪幾天、哪個平台；iCal 沒有姓名單號會特別標示）
//  2) 過去 24h 由 iCal 取消（事件從平台 feed 消失）而自動釋出的房況
//  3) iCal 同步健康狀態（有錯誤或太久沒同步的設定）
// 只有「有內容」才寄，避免每天空信打擾。

const GENERIC_NAME = /^(reserved|closed|not\s*available|blocked|airbnb|booking\.?com|agoda|trip\.?com|asiayo|ota|guest|unavailable|busy|預約|已預訂|關閉|不可訂)?$/i
const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const platName = (p: string | null) => ICAL_PLATFORMS[p ?? 'other']?.name ?? p ?? '其他平台'

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: '未設定 RESEND_API_KEY' }, { status: 500 })

  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()

  // 有啟用 iCal 的民宿主才需要偵測
  const { data: icalUsers } = await admin.from('ical_settings').select('user_id').eq('sync_enabled', true)
  const userIds = [...new Set((icalUsers ?? []).map(r => r.user_id))]
  if (userIds.length === 0) return NextResponse.json({ hosts: 0 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const fmtRange = (ci: string, co: string) => `${ci} ~ ${co}`
  let sent = 0

  for (const uid of userIds) {
    // 房名對照
    const { data: props } = await admin.from('properties').select('id, name').eq('user_id', uid)
    const propName = new Map((props ?? []).map(p => [p.id, p.name as string]))
    const roomOf = (id: string | null) => (id && propName.get(id)) || '未指定房型'

    const [{ data: news }, { data: cancels }, { data: suspects }, { data: settings }] = await Promise.all([
      admin.from('bookings')
        .select('property_id, platform, check_in, check_out, guest_name, created_at')
        .eq('user_id', uid).eq('source', 'ical').neq('status', 'cancelled').gte('created_at', since)
        .order('check_in'),
      admin.from('bookings')
        .select('property_id, platform, check_in, check_out, updated_at')
        .eq('user_id', uid).eq('source', 'ical').eq('status', 'cancelled').gte('updated_at', since)
        .order('check_in'),
      // 有人工資料、但事件已從平台 feed 消失（疑似客人取消，系統不敢自動刪）
      admin.from('bookings')
        .select('property_id, platform, check_in, check_out, guest_name')
        .eq('user_id', uid).eq('status', 'confirmed').not('ical_missing_since', 'is', null)
        .order('check_in'),
      admin.from('ical_settings')
        .select('platform, platform_name, property_id, last_sync_error, last_synced_at, sync_interval')
        .eq('user_id', uid).eq('sync_enabled', true),
    ])

    // 健康檢查：有錯誤、或超過 max(2×間隔, 3 小時) 沒成功同步
    const now = Date.now()
    const unhealthy = (settings ?? []).filter(s => {
      if (s.last_sync_error) return true
      if (!s.last_synced_at) return true
      const mins = (now - new Date(s.last_synced_at).getTime()) / 60000
      return mins > Math.max((s.sync_interval ?? 60) * 2, 180)
    })

    const newRows = news ?? []
    const cancelRows = cancels ?? []
    const suspectRows = suspects ?? []
    if (newRows.length === 0 && cancelRows.length === 0 && suspectRows.length === 0 && unhealthy.length === 0) continue

    let to = ''
    const { data: profile } = await admin.from('bnb_profiles').select('name, email').eq('user_id', uid).maybeSingle()
    to = profile?.email?.trim() || ''
    if (!to) { const { data: u } = await admin.auth.admin.getUserById(uid); to = u?.user?.email ?? '' }
    if (!to) continue

    const row = (cells: string[]) => `<tr>${cells.map(c => `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${c}</td>`).join('')}</tr>`
    const newHtml = newRows.length === 0 ? '' : `
<h3 style="margin:16px 0 6px">🆕 新進訂房（iCal）${newRows.length} 筆</h3>
<table style="border-collapse:collapse;font-size:14px"><tr style="background:#f1f5f9">
<th style="padding:6px 10px;text-align:left">房型</th><th style="padding:6px 10px;text-align:left">日期</th><th style="padding:6px 10px;text-align:left">平台</th><th style="padding:6px 10px;text-align:left">旅客</th></tr>
${newRows.map(b => {
  const generic = GENERIC_NAME.test((b.guest_name ?? '').trim())
  const guest = generic
    ? '<span style="color:#b45309">iCal 匯入・無姓名單號，請至平台後台確認</span>'
    : esc(b.guest_name ?? '')
  return row([esc(roomOf(b.property_id)), esc(fmtRange(b.check_in, b.check_out)), esc(platName(b.platform)), guest])
}).join('')}</table>`

    const cancelHtml = cancelRows.length === 0 ? '' : `
<h3 style="margin:16px 0 6px">❌ 平台取消・已自動釋出房況 ${cancelRows.length} 筆</h3>
<table style="border-collapse:collapse;font-size:14px"><tr style="background:#f1f5f9">
<th style="padding:6px 10px;text-align:left">房型</th><th style="padding:6px 10px;text-align:left">日期</th><th style="padding:6px 10px;text-align:left">平台</th></tr>
${cancelRows.map(b => row([esc(roomOf(b.property_id)), esc(fmtRange(b.check_in, b.check_out)), esc(platName(b.platform))])).join('')}</table>`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const suspectHtml = suspectRows.length === 0 ? '' : `
<h3 style="margin:16px 0 6px;color:#b45309">⚠️ 人工訂單疑似被平台取消 ${suspectRows.length} 筆（請確認是否釋出）</h3>
<p style="font-size:13px;color:#475569;margin:0 0 6px">以下是你有補過資料、但訂單已從平台 feed 消失的訂房。為避免誤刪真實訂單，系統不自動取消；請到日曆確認，若客人確實取消可一鍵釋出該房況。</p>
<table style="border-collapse:collapse;font-size:14px"><tr style="background:#fef3c7">
<th style="padding:6px 10px;text-align:left">房型</th><th style="padding:6px 10px;text-align:left">日期</th><th style="padding:6px 10px;text-align:left">平台</th><th style="padding:6px 10px;text-align:left">旅客</th></tr>
${suspectRows.map(b => row([esc(roomOf(b.property_id)), esc(fmtRange(b.check_in, b.check_out)), esc(platName(b.platform)), esc(b.guest_name ?? '')])).join('')}</table>
${appUrl ? `<p style="margin:8px 0 0"><a href="${appUrl}/booking/calendar">前往日曆確認／釋出</a></p>` : ''}`

    const healthHtml = unhealthy.length === 0
      ? '<p style="color:#16a34a;margin:16px 0 0">✅ iCal 同步運作正常。</p>'
      : `<h3 style="margin:16px 0 6px;color:#dc2626">⚠️ iCal 同步異常 ${unhealthy.length} 筆</h3><ul style="font-size:13px;color:#475569">${
          unhealthy.map(s => `<li>${esc(s.platform_name || platName(s.platform))}（${esc(roomOf(s.property_id))}）：${
            s.last_sync_error ? esc(String(s.last_sync_error).slice(0, 120)) : s.last_synced_at ? `太久沒成功同步（上次 ${new Date(s.last_synced_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}）` : '尚未同步過'
          }</li>`).join('')}</ul>`

    try {
      await resend.emails.send({
        from: `AI-GATE iCal 偵測 <${fromEmail}>`,
        to,
        subject: `【iCal 偵測】${profile?.name ?? '您的民宿'}：新進 ${newRows.length}・取消 ${cancelRows.length}${suspectRows.length ? `・待確認 ${suspectRows.length}` : ''}${unhealthy.length ? `・異常 ${unhealthy.length}` : ''}`,
        html: `<p>${esc(profile?.name ?? '您的民宿')} 過去 24 小時的 iCal 房況異動：</p>${newHtml}${cancelHtml}${suspectHtml}${healthHtml}
<p style="margin-top:16px;font-size:12px;color:#94a3b8">iCal 來源的訂單沒有姓名與訂單編號；若需要旅客資訊，請到該平台後台查詢，或確認 Email 自動匯入是否已設定。</p>`,
      })
      sent++
    } catch (e) {
      console.error('[ical-monitor] send failed', uid, e)
    }
  }

  return NextResponse.json({ hosts: userIds.length, sent })
}
