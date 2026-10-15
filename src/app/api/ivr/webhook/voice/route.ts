/**
 * POST /api/ivr/webhook/voice
 * Bird Voice callback：接收通話狀態與 DTMF 按鍵。
 * - 更新 ivr_calls 狀態
 * - voice_call.ended → 依 data.billable_ms 實際秒數 × 國別費率 × 方案倍率扣點（billed_at 原子鎖防重送重扣）
 * - 客戶按鍵 → 依 campaign+digit 找對應通路，建立 ivr_join_event 並派送加入短連結
 *
 * 公開端點（來自 Bird，無 session），以 service role 寫入。
 * 簽章驗證：Standard Webhooks（webhook-id / webhook-timestamp / webhook-signature）。
 * Bird 事件格式：{ type: 'voice_call.initiated|answered|ended', data: { call_id, status, billable_ms, ... } }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateShortToken, buildShortUrl, dispatchJoinLink, type DispatchChannel } from '@/lib/ivr/dispatch'
import { verifyBirdStandardWebhook } from '@/lib/ivr/verify'
import { callCost, chargeUsage } from '@/lib/marketing/billing'

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

  const rawBody = await req.text()
  const verified = verifyBirdStandardWebhook(
    rawBody,
    req.headers.get('webhook-id'),
    req.headers.get('webhook-timestamp'),
    req.headers.get('webhook-signature'),
  )

  // 留存原始內容，用來確認 Bird 實際的欄位名與簽章標頭（不存 cookie／authorization 值）
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    headers[k] = ['cookie', 'authorization'].includes(k) ? '[redacted]' : v.slice(0, 500)
  })
  await sb.from('ivr_webhook_logs').insert({ provider: 'bird', headers, body: rawBody.slice(0, 20000), verified })

  if (!verified) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let payload: Record<string, any> | null = null
  try { payload = JSON.parse(rawBody) } catch { payload = null }
  if (!payload) return NextResponse.json({ error: 'bad_payload' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (payload.data ?? payload) as Record<string, any>
  const eventType: string = payload.type ?? ''
  const callId: string | undefined = data.call_id || data.callId || data.id
  const digit: string | undefined = data.dtmf || data.digit || data.digits
  // voice_call.ended 的 data.status 是結束原因（answered = 有接通）
  const rawStatus: string | undefined = eventType === 'voice_call.ended'
    ? (data.status === 'answered' ? 'completed' : data.status || 'failed')
    : eventType === 'voice_call.answered' ? 'answered' : data.status

  if (!callId) return NextResponse.json({ error: 'no_call_id' }, { status: 400 })

  // 依 provider_call_id 對應通話
  const { data: call } = await sb
    .from('ivr_calls')
    .select('id, user_id, campaign_id, phone, pressed_digit, billed_at')
    .eq('provider_call_id', callId)
    .maybeSingle()

  // 非本系統發起的通話（例如後台測試撥號）→ 回 200 避免 Bird 重送
  if (!call) return NextResponse.json({ ok: true, note: 'call_not_found' })

  if (eventType === 'voice_call.ended' && !call.billed_at) {
    const durationSec = Math.ceil((Number(data.billable_ms) || 0) / 1000)
    const { data: claimed } = await sb
      .from('ivr_calls')
      .update({ billed_at: new Date().toISOString(), duration_sec: durationSec })
      .eq('id', call.id)
      .is('billed_at', null)
      .select('id')
    if (claimed?.length) {
      const minutes = Math.ceil(durationSec / 60)
      const credits = await chargeUsage(call.user_id, callCost(call.phone, 'bird', durationSec), `[marketing] 電話行銷通話 ${minutes} 分鐘`)
      await sb.from('ivr_calls').update({ billed_credits: credits }).eq('id', call.id)
    }
  }

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
  const { deliveryMethod, delivered, costUsd } = await dispatchJoinLink({
    channel: mapping.channel as DispatchChannel,
    phone: call.phone,
    shortUrl,
    label: mapping.label,
    ownerId: call.user_id,
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
  // 加入連結簡訊依實際通道成本 × 方案倍率扣點（扣發起通話的帳號）
  await chargeUsage(call.user_id, costUsd, '[marketing] 電話按鍵加入連結簡訊')

  return NextResponse.json({ ok: true, dispatched: delivered })
}
