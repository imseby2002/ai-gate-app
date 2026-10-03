/**
 * POST /api/ivr/webhook/twilio
 * Twilio Voice callback：接收通話狀態與 DTMF 按鍵。
 * - 更新 ivr_calls 狀態
 * - 通話結束 → 向 Twilio API 查詢實際秒數（不採信 callback 內容），依分鐘數 × 國別費率 × 方案倍率扣點
 * - 客戶按鍵 → 依 campaign+digit 找對應通路，建立 ivr_join_event 並派送加入短連結
 * - 回傳 TwiML 掛斷或確認
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateShortToken, buildShortUrl, dispatchJoinLink, type DispatchChannel } from '@/lib/ivr/dispatch'
import { getTwilioAuth } from '@/lib/telephony/twilio'
import { callCost, chargeUsage } from '@/lib/marketing/billing'

const FINAL_STATUSES = ['completed', 'busy', 'no-answer', 'canceled', 'failed']

/** 通話結束後扣點：billed_at 原子鎖防止 Twilio 重送造成重複扣款 */
async function billTwilioCall(
  sb: ReturnType<typeof createAdminClient>,
  call: { id: string; user_id: string; phone: string },
  callSid: string,
) {
  const creds = getTwilioAuth()
  if (!creds) return
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Calls/${encodeURIComponent(callSid)}.json`, {
    headers: { Authorization: creds.authHeader },
  }).catch(() => null)
  const data = res?.ok ? await res.json().catch(() => null) : null
  if (!data || !FINAL_STATUSES.includes(String(data.status))) return

  const durationSec = Number(data.duration) || 0
  const { data: claimed } = await sb
    .from('ivr_calls')
    .update({ billed_at: new Date().toISOString(), duration_sec: durationSec })
    .eq('id', call.id)
    .is('billed_at', null)
    .select('id')
  if (!claimed?.length) return

  const minutes = Math.ceil(durationSec / 60)
  const credits = await chargeUsage(call.user_id, callCost(call.phone, 'twilio', durationSec), `[marketing] 電話行銷通話 ${minutes} 分鐘`)
  await sb.from('ivr_calls').update({ billed_credits: credits }).eq('id', call.id)
}

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
    .select('id, user_id, campaign_id, phone, pressed_digit, billed_at')
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

  if (FINAL_STATUSES.includes(callStatus.toLowerCase()) && !call.billed_at) {
    await billTwilioCall(sb, call, callSid)
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
      const { deliveryMethod, delivered, costUsd } = await dispatchJoinLink({
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
      // 加入連結簡訊依實際通道成本 × 方案倍率扣點（扣發起通話的帳號）
      await chargeUsage(call.user_id, costUsd, '[marketing] 電話按鍵加入連結簡訊')
    }
  }

  return new NextResponse('<Response><Hangup/></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
