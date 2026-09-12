/**
 * Twilio (twilio.com) provider：語音外撥 + SMS。
 * Docs: https://www.twilio.com/docs/voice/api/call-resource
 */
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'

const BASE = 'https://api.twilio.com/2010-04-01'

function getTwilioAuth() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null
  return {
    accountSid,
    authHeader: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
  }
}

/**
 * 格式化電話號碼為 E.164 (例如 +886912345678, +84901234567)
 */
export function formatToE164(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('09') && cleaned.length === 10) return '+886' + cleaned.slice(1)
  if (cleaned.startsWith('886')) return '+' + cleaned
  if (cleaned.startsWith('0') && /^0[35789]\d{8}$/.test(cleaned)) return '+84' + cleaned.slice(1)
  if (cleaned.startsWith('84')) return '+' + cleaned
  return '+' + cleaned
}

export const twilioProvider: TelephonyProvider = {
  name: 'twilio',

  isConfigured() {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  },

  async call({ phone, audioUrl, callerId, collectDtmf }: VoiceCallParams) {
    const creds = getTwilioAuth()
    if (!creds) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN 未設定')

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

    const res = await fetch(`${BASE}/Accounts/${creds.accountSid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: creds.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = data?.message || data?.error_message || `Twilio 撥打失敗 (${res.status})`
      throw new Error(errMsg)
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
