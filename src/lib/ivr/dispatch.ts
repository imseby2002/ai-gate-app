/**
 * IVR 派送工具：產生短連結 token、組短連結網址、依通路派送加入連結
 * SMS 走可切換的 telephony provider（Bird / Stringee），ZALO 走 Zalo 官方 ZNS。
 */
import { randomBytes } from 'crypto'
import { getTelephonyProvider } from '@/lib/telephony'
import { sendSmsMessage, normalizePhoneForCountry, detectSmsCountry } from '@/lib/telephony/sms-service'
import { getZaloZnsConfig, type ZaloZnsConfig } from '@/lib/telephony/zalo-zns'
import { smsCost } from '@/lib/marketing/billing'

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
 * 回傳實際使用的 delivery_method，供寫入 ivr_join_events；costUsd 為送達時的通道成本，供依用量扣點。
 *
 * 註：Bird / Zalo ZNS 的實際 API 端點與簽章待後台確認後補上，
 * 目前以 env 驅動並在缺設定時回傳 method 但不中斷（後續可重送）。
 */
export async function dispatchJoinLink(params: {
  channel: DispatchChannel
  phone: string
  shortUrl: string
  label?: string | null
  /** 活動擁有者：ZNS 用他自己在平台設定填的 OA 權杖與範本 ID */
  ownerId?: string | null
}): Promise<{ deliveryMethod: string; delivered: boolean; costUsd: number }> {
  const { channel, phone, shortUrl, label, ownerId } = params
  const text = `${label ? label + '：' : ''}${shortUrl}`

  // ZALO：ZNS 已設定 → 走官方 ZNS 範本（CTA 導 OA）；
  // 尚未過審/未設定 → 自動退回 SMS 夾帶 zalo.me 短連結（一樣可加入）。
  // ZNS 只能發給越南門號
  if (channel === 'zalo' && detectSmsCountry(phone) === 'VN') {
    const zns = await getZaloZnsConfig(ownerId).catch((): ZaloZnsConfig => ({}))
    if (zns.accessToken && zns.templateId) {
      const ok = await sendZaloZns(zns, phone, shortUrl, label).catch(() => false)
      // ZNS 未取得公開報價，比照越南簡訊每段成本計
      return { deliveryMethod: 'zns', delivered: ok, costUsd: ok ? smsCost(phone, text) : 0 }
    }
  }

  // line / whatsapp / zalo(未設 ZNS) → 經智慧多國簡訊發送短連結
  const smsRes = await sendSmsMessage({ phone, text }).catch(() => ({ ok: false, provider: 'sms' as const }))
  return { deliveryMethod: smsRes.provider || 'sms', delivered: smsRes.ok, costUsd: smsRes.ok ? smsCost(phone, text) : 0 }
}

// ── Zalo ZNS ─────────────────────────────────────────────────────────────────
async function sendZaloZns(
  { accessToken, templateId }: ZaloZnsConfig,
  phone: string,
  shortUrl: string,
  label?: string | null,
): Promise<boolean> {
  if (!accessToken || !templateId) return false

  const res = await fetch('https://business.openapi.zalo.me/message/template', {
    method: 'POST',
    headers: {
      access_token: accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // ZNS 只收 84xxxxxxxxx 格式
      phone: normalizePhoneForCountry(phone, 'VN'),
      template_id: templateId,
      // 範本參數依送審範本而定；url/label 由 CTA 按鈕承載
      template_data: { url: shortUrl, label: label || '' },
    }),
  })
  // Zalo 以 HTTP 200 + body.error 回報錯誤，error === 0 才算成功
  const data = await res.json().catch(() => ({})) as { error?: number }
  return res.ok && data.error === 0
}
