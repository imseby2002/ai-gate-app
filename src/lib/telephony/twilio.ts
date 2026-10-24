/**
 * Twilio (twilio.com) provider：語音外撥 + SMS。
 * Docs: https://www.twilio.com/docs/voice/api/call-resource
 */
import { createHmac, timingSafeEqual } from 'crypto'
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'

const BASE = 'https://api.twilio.com/2010-04-01'

/**
 * 驗證 Twilio webhook 的 X-Twilio-Signature。
 * Twilio 一律以帳號 Auth Token 簽章：base64(HMAC-SHA1(authToken, url + 依 key 排序後的 key+value 串接))。
 * 未設定 TWILIO_AUTH_TOKEN 或簽章不符一律回 false（fail-closed）。
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!authToken || !signature) return false
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url)
  const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * 取得 Twilio 認證。優先使用 API Key（TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET），
 * 未設定時退回 Auth Token（TWILIO_AUTH_TOKEN）。
 * 注意：兩種方式的 API 路徑都仍需 Account SID（AC 開頭），故 TWILIO_ACCOUNT_SID 為必填。
 */
export function getTwilioAuth() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  if (!accountSid) return null

  // 優先使用主金鑰 Auth Token（直接綁定 Account SID，完全避開 IAM assertion 範圍錯誤）
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (authToken) {
    return {
      accountSid,
      authHeader: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      authType: 'auth_token' as const,
    }
  }

  // 次選 API Key (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET)
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
  if (apiKeySid && apiKeySecret) {
    return {
      accountSid,
      authHeader: `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64')}`,
      authType: 'api_key' as const,
    }
  }

  return null
}

/**
 * 格式化電話號碼為 E.164 (例如 +886912345678, +84901234567)
 */
export function formatToE164(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('886')) return '+' + cleaned
  if (cleaned.startsWith('84')) return '+' + cleaned
  // 台灣手機 09xx (10 碼)
  if (cleaned.startsWith('09') && cleaned.length === 10) return '+886' + cleaned.slice(1)
  // 台灣市話 02~08 (9~10 碼，如 02-xxxx-xxxx, 04-xxxx-xxxx)
  if (/^0[2-8]\d{7,8}$/.test(cleaned)) return '+886' + cleaned.slice(1)
  // 越南手機 (03,05,07,08,09) 10 碼
  if (/^0[35789]\d{8}$/.test(cleaned)) return '+84' + cleaned.slice(1)
  // 北美 1xxxxxxxxxx (11 碼)
  if (cleaned.startsWith('1') && cleaned.length === 11) return '+' + cleaned
  return '+' + cleaned
}

export const twilioProvider: TelephonyProvider = {
  name: 'twilio',

  isConfigured() {
    return !!getTwilioAuth()
  },

  async call({ phone, audioUrl, callerId, collectDtmf }: VoiceCallParams) {
    const creds = getTwilioAuth()
    if (!creds) throw new Error('Twilio 未設定（需 TWILIO_ACCOUNT_SID + API Key 或 Auth Token）')

    const fromNumber = callerId || process.env.TWILIO_FROM_NUMBER
    if (!fromNumber) {
      throw new Error('Twilio 撥打需要設定外顯電話號碼 (From / Verified Caller ID)')
    }

    const toPhone = formatToE164(phone)
    const fromPhone = formatToE164(fromNumber)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const webhookUrl = appUrl ? `${appUrl}/api/ivr/webhook/twilio` : undefined

    // 使用 Twilio Inline TwiML 播放音檔與收集按鍵
    // collectDtmf: 若有設定按鍵加入社群，收集 1 碼並由 webhook 接收派送加入連結
    const twiml = collectDtmf
      ? `<Response><Gather numDigits="1" timeout="8"${webhookUrl ? ` action="${webhookUrl}" method="POST"` : ''}><Play>${audioUrl}</Play></Gather><Hangup/></Response>`
      : `<Response><Play>${audioUrl}</Play><Hangup/></Response>`

    const params = new URLSearchParams()
    params.set('To', toPhone)
    params.set('From', fromPhone)
    params.set('Twiml', twiml)

    if (webhookUrl) {
      params.set('StatusCallback', webhookUrl)
      params.set('StatusCallbackEvent', 'completed')
      params.set('StatusCallbackMethod', 'POST')
    }

    let res = await fetch(`${BASE}/Accounts/${creds.accountSid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: creds.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    let data = await res.json().catch(() => ({}))
    let activeAuthType: string = creds.authType

    // 若認證失敗 (401)，自動以另一種憑證重試一次
    if (!res.ok && res.status === 401) {
      const isApiKey = creds.authType === 'api_key'
      const otherHeader = isApiKey && process.env.TWILIO_AUTH_TOKEN?.trim()
        ? `Basic ${Buffer.from(`${creds.accountSid}:${process.env.TWILIO_AUTH_TOKEN.trim()}`).toString('base64')}`
        : !isApiKey && process.env.TWILIO_API_KEY_SID?.trim() && process.env.TWILIO_API_KEY_SECRET?.trim()
          ? `Basic ${Buffer.from(`${process.env.TWILIO_API_KEY_SID.trim()}:${process.env.TWILIO_API_KEY_SECRET.trim()}`).toString('base64')}`
          : null

      if (otherHeader) {
        const retryRes = await fetch(`${BASE}/Accounts/${creds.accountSid}/Calls.json`, {
          method: 'POST',
          headers: {
            Authorization: otherHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })
        const retryData = await retryRes.json().catch(() => ({}))
        if (retryRes.ok) {
          res = retryRes
          data = retryData
          activeAuthType = isApiKey ? 'auth_token' : 'api_key'
        } else {
          res = retryRes
          data = retryData
          activeAuthType = isApiKey ? 'auth_token (備援重試)' : 'api_key (備援重試)'
        }
      }
    }

    if (!res.ok) {
      const detail = [data?.code, data?.message || data?.error_message].filter(Boolean).join(' / ') || '未知錯誤'
      const authInfo = activeAuthType === 'api_key' ? 'API Key (TWILIO_API_KEY_SID)'
        : activeAuthType === 'auth_token' ? 'Auth Token (TWILIO_AUTH_TOKEN)'
        : activeAuthType
      throw new Error(`Twilio 撥打失敗 (HTTP ${res.status})：${detail} [認證方式: ${authInfo}]${data?.more_info ? `（${data.more_info}）` : ''}`)
    }

    return { callId: data?.sid ?? null }
  },

  async sendSms({ phone, text }: SmsParams) {
    const creds = getTwilioAuth()
    const fromNumber = process.env.TWILIO_FROM_NUMBER
    if (!creds || !fromNumber) return false

    const toPhone = formatToE164(phone)
    const fromPhone = formatToE164(fromNumber)

    const params = new URLSearchParams({
      To: toPhone,
      From: fromPhone,
      Body: text,
    })

    const res = await fetch(`${BASE}/Accounts/${creds.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: creds.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }).catch(() => null)

    return !!res && res.ok
  },
}
