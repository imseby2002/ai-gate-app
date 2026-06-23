/**
 * POST /api/ivr/webhook/voice
 * Bird Voice callback：接收通話狀態與 DTMF 按鍵。
 * - 更新 ivr_calls 狀態
 * - 客戶按鍵 → 依 campaign+digit 找對應通路，建立 ivr_join_event 並派送加入短連結
 *
 * 公開端點（來自 Bird，無 session），以 service role 寫入。
 * TODO: 補 Bird webhook 簽章驗證（待後台確認簽章標頭與密鑰）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateShortToken, buildShortUrl, dispatchJoinLink, type DispatchChannel } from '@/lib/ivr/dispatch'

// 將 Bird 通話狀態正規化為本系統狀態
function normalizeStatus(s?: string): string | null {
  if (!s) return null
  const v = s.toLowerCase()
  if (['answered', 'in_progress', 'ongoing'].includes(v)) return 'answered'
  if (['completed', 'hangup', 'ended'].includes(v)) return 'completed'
  if (['no_answer', 'no-answer', 'busy', 'unanswered'].includes(v)) return 'no_answer'
  if (['failed', 'error'].includes(v)) return 'failed'
  return null
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const payload = await req.json().catch(() => null)
  if (!payload) return NextResponse.json({ error: 'bad_payload' }, { status: 400 })

  // Bird payload 欄位名待後台確認，先涵蓋常見命名
  const callId: string | undefined =
    payload.callId || payload.call_id || payload.id || payload?.call?.id
  const digit: string | undefined =
    payload.dtmf || payload.digit || payload.digits || payload?.dtmf?.digit
  const rawStatus: string | undefined =
    payload.status || payload.event || payload?.call?.status

  if (!callId) return NextResponse.json({ error: 'no_call_id' }, { status: 400 })

  // 依 provider_call_id 對應通話
  const { data: call } = await sb
    .from('ivr_calls')
    .select('id, user_id, campaign_id, phone, pressed_digit')
    .eq('provider_call_id', callId)
    .single()

  if (!call) return NextResponse.json({ error: 'call_not_found' }, { status: 404 })

  // 更新通話狀態
  const status = normalizeStatus(rawStatus)
  const patch: Record<string, unknown> = {}
  if (status) {
    patch.status = status
    if (status === 'completed' || status === 'no_answer' || status === 'failed') {
      patch.ended_at = new Date().toISOString()
    }
  }
  if (digit && !call.pressed_digit) patch.pressed_digit = digit
  if (Object.keys(patch).length) {
    await sb.from('ivr_calls').update(patch).eq('id', call.id)
  }

  // 無按鍵 → 僅狀態更新
  if (!digit) return NextResponse.json({ ok: true })

  // 已處理過按鍵（避免重複派送）
  if (call.pressed_digit) return NextResponse.json({ ok: true, duplicated: true })

  // 找按鍵對應
  if (!call.campaign_id) return NextResponse.json({ ok: true, note: 'no_campaign' })
  const { data: mapping } = await sb
    .from('ivr_key_mappings')
    .select('channel, target_type, join_url, label')
    .eq('campaign_id', call.campaign_id)
    .eq('digit', digit)
    .single()

  if (!mapping) return NextResponse.json({ ok: true, note: 'no_mapping' })

  // 建立 join event + 短連結
  const token = generateShortToken()
  const shortUrl = buildShortUrl(token)
  const { deliveryMethod, delivered } = await dispatchJoinLink({
    channel: mapping.channel as DispatchChannel,
    phone: call.phone,
    shortUrl,
    label: mapping.label,
  })

  await sb.from('ivr_join_events').insert({
    user_id: call.user_id,
    call_id: call.id,
    channel: mapping.channel,
    target_type: mapping.target_type,
    join_url: mapping.join_url,
    delivery_method: deliveryMethod,
    short_token: token,
    delivered_at: delivered ? new Date().toISOString() : null,
  })

  return NextResponse.json({ ok: true, dispatched: delivered })
}
