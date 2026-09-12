/**
 * POST /api/ivr/webhook/twilio
 * Twilio Voice callback：接收通話狀態與 DTMF 按鍵。
 * - 更新 ivr_calls 狀態
 * - 客戶按鍵 → 依 campaign+digit 找對應通路，建立 ivr_join_event 並派送加入短連結
 * - 回傳 TwiML 掛斷或確認
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateShortToken, buildShortUrl, dispatchJoinLink, type DispatchChannel } from '@/lib/ivr/dispatch'

function normalizeTwilioStatus(s?: string): string | null {
  if (!s) return null
  const v = s.toLowerCase()
  if (['in-progress', 'in_progress', 'answered'].includes(v)) return 'answered'
  if (['completed'].includes(v)) return 'completed'
  if (['busy', 'no-answer', 'no_answer', 'canceled'].includes(v)) return 'no_answer'
  if (['failed'].includes(v)) return 'failed'
  return null
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()

  let callSid = ''
  let digits = ''
  let callStatus = ''

  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    callSid = String(formData.get('CallSid') || '')
    digits = String(formData.get('Digits') || '')
    callStatus = String(formData.get('CallStatus') || '')
  } else {
    try {
      const json = await req.json()
      callSid = json.CallSid || json.callSid || ''
      digits = json.Digits || json.digits || ''
      callStatus = json.CallStatus || json.callStatus || ''
    } catch {
      // ignore
    }
  }

  if (!callSid) {
    return new NextResponse('<Response><Hangup/></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // 依 provider_call_id 對應通話
  const { data: call } = await sb
    .from('ivr_calls')
    .select('id, user_id, campaign_id, phone, pressed_digit')
    .eq('provider_call_id', callSid)
    .single()

  if (!call) {
    return new NextResponse('<Response><Hangup/></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // 更新通話狀態
  const status = normalizeTwilioStatus(callStatus)
  const patch: Record<string, unknown> = {}
  if (status) {
    patch.status = status
    if (status === 'completed' || status === 'no_answer' || status === 'failed') {
      patch.ended_at = new Date().toISOString()
    }
  }
  if (digits && !call.pressed_digit) {
    patch.pressed_digit = digits
  }
  if (Object.keys(patch).length > 0) {
    await sb.from('ivr_calls').update(patch).eq('id', call.id)
  }

  // 若無按鍵或已處理過按鍵，直接掛斷
  if (!digits || call.pressed_digit) {
    return new NextResponse('<Response><Hangup/></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // 找按鍵對應
  if (call.campaign_id) {
    const { data: mapping } = await sb
      .from('ivr_key_mappings')
      .select('channel, target_type, join_url, label')
      .eq('campaign_id', call.campaign_id)
      .eq('digit', digits)
      .single()

    if (mapping) {
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
    }
  }

  return new NextResponse('<Response><Hangup/></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
