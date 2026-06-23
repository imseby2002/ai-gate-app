/**
 * IVR 派送工具：產生短連結 token、組短連結網址、依通路派送加入連結
 * 主力通路走 Bird（SMS/WhatsApp/LINE），ZALO 走 Zalo 官方 ZNS。
 */
import { randomBytes } from 'crypto'

export function generateShortToken(): string {
  // 16 字元 base64url，足夠唯一且短
  return randomBytes(12).toString('base64url')
}

export function buildShortUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return `${base}/api/ivr/r/${token}`
}

export type DispatchChannel = 'line' | 'whatsapp' | 'zalo'

/**
 * 依通路把短連結派送給客戶。
 * 回傳實際使用的 delivery_method，供寫入 ivr_join_events。
 *
 * 註：Bird / Zalo ZNS 的實際 API 端點與簽章待後台確認後補上，
 * 目前以 env 驅動並在缺設定時回傳 method 但不中斷（後續可重送）。
 */
export async function dispatchJoinLink(params: {
  channel: DispatchChannel
  phone: string
  shortUrl: string
  label?: string | null
}): Promise<{ deliveryMethod: string; delivered: boolean }> {
  const { channel, phone, shortUrl, label } = params
  const text = `${label ? label + '：' : ''}${shortUrl}`

  // ZALO：ZNS 已設定 → 走官方 ZNS 範本（CTA 導 OA）；
  // 尚未過審/未設定 → 自動退回 SMS 夾帶 zalo.me 短連結（一樣可加入）。
  if (channel === 'zalo' && zaloZnsConfigured()) {
    const ok = await sendZaloZns(phone, shortUrl, label).catch(() => false)
    return { deliveryMethod: 'zns', delivered: ok }
  }

  // line / whatsapp / zalo(未設 ZNS) → Bird SMS 派送短連結（最穩共通底層）
  const ok = await sendBirdSms(phone, text).catch(() => false)
  return { deliveryMethod: 'sms', delivered: ok }
}

// ── Bird 外撥語音(IVR) ─────────────────────────────────────────────────────────
/**
 * 觸發 Bird 外撥並進入 IVR Flow（按鍵分支於 Bird Flow 設定）。
 * 回傳 provider_call_id 供寫入 ivr_calls；缺設定時回傳 null（待補）。
 * TODO: 確認 Bird Voice 外撥端點與 Flow 綁定參數。
 */
export async function startBirdCall(phone: string): Promise<string | null> {
  const apiKey = process.env.BIRD_API_KEY
  const workspaceId = process.env.BIRD_WORKSPACE_ID
  const voiceChannelId = process.env.BIRD_VOICE_CHANNEL_ID
  const flowId = process.env.BIRD_IVR_FLOW_ID
  if (!apiKey || !workspaceId || !voiceChannelId) return null

  const res = await fetch(
    `https://api.bird.com/workspaces/${workspaceId}/channels/${voiceChannelId}/calls`,
    {
      method: 'POST',
      headers: {
        Authorization: `AccessKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiver: { contacts: [{ identifierValue: phone }] },
        ...(flowId ? { flowId } : {}),
      }),
    }
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return data?.id || data?.callId || null
}

// ── Bird SMS ────────────────────────────────────────────────────────────────
async function sendBirdSms(phone: string, body: string): Promise<boolean> {
  const apiKey = process.env.BIRD_API_KEY
  const workspaceId = process.env.BIRD_WORKSPACE_ID
  const channelId = process.env.BIRD_SMS_CHANNEL_ID
  if (!apiKey || !workspaceId || !channelId) return false // 尚未設定，待補

  const res = await fetch(
    `https://api.bird.com/workspaces/${workspaceId}/channels/${channelId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `AccessKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiver: { contacts: [{ identifierValue: phone }] },
        body: { type: 'text', text: { text: body } },
      }),
    }
  )
  return res.ok
}

// ── Zalo ZNS ─────────────────────────────────────────────────────────────────
function zaloZnsConfigured(): boolean {
  return !!(process.env.ZALO_OA_ACCESS_TOKEN && process.env.ZALO_ZNS_TEMPLATE_ID)
}

async function sendZaloZns(phone: string, shortUrl: string, label?: string | null): Promise<boolean> {
  const accessToken = process.env.ZALO_OA_ACCESS_TOKEN
  const templateId = process.env.ZALO_ZNS_TEMPLATE_ID
  if (!accessToken || !templateId) return false // 尚未設定，待補

  const res = await fetch('https://business.openapi.zalo.me/message/template', {
    method: 'POST',
    headers: {
      access_token: accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone,
      template_id: templateId,
      // 範本參數依送審範本而定；url/label 由 CTA 按鈕承載
      template_data: { url: shortUrl, label: label || '' },
    }),
  })
  return res.ok
}
