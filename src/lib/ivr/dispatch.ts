/**
 * IVR 派送工具：產生短連結 token、組短連結網址、依通路派送加入連結
 * SMS 走可切換的 telephony provider（Bird / Stringee），ZALO 走 Zalo 官方 ZNS。
 */
import { randomBytes } from 'crypto'
import { getTelephonyProvider } from '@/lib/telephony'

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

  // line / whatsapp / zalo(未設 ZNS) → 經 telephony provider 發 SMS 夾短連結
  const ok = await getTelephonyProvider().sendSms({ phone, text }).catch(() => false)
  return { deliveryMethod: 'sms', delivered: ok }
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
