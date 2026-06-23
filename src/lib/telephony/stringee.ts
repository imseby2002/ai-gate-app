/**
 * Stringee (越南本地) provider：語音外撥 + SMS Brandname。
 * 越南境內費率遠低於國際 CPaaS，量大時切換用。
 *
 * 認證：Stringee 用 JWT（API key SID + secret 簽發）。
 * Docs: https://developer.stringee.com
 * TODO: 確認 voice answer_url(SCCO)、SMS brandname 端點與 JWT 簽發細節後補完。
 *
 * 需要環境變數：
 *   STRINGEE_API_KEY_SID
 *   STRINGEE_API_KEY_SECRET
 *   STRINGEE_FROM_NUMBER       (語音外顯)
 *   STRINGEE_SMS_BRANDNAME     (簡訊發送名稱)
 *   STRINGEE_ANSWER_URL        (語音 SCCO 腳本網址，含 playAudio/收按鍵)
 */
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'

function configured() {
  return !!(process.env.STRINGEE_API_KEY_SID && process.env.STRINGEE_API_KEY_SECRET)
}

// TODO: 以 STRINGEE_API_KEY_SID/SECRET 簽發 Stringee REST JWT（HS256）。
async function stringeeJwt(): Promise<string | null> {
  // 佔位：待補 JWT 簽發（payload: { jti, iss=sid, exp, rest_api:true }）
  return null
}

export const stringeeProvider: TelephonyProvider = {
  name: 'stringee',

  isConfigured() {
    return configured()
  },

  async call({ phone, audioUrl, callerId }: VoiceCallParams) {
    const token = await stringeeJwt()
    if (!token) return { callId: null } // 尚未設定/簽發，待補
    // Stringee 以 answer_url 回傳 SCCO 控制語音（播音檔、收 DTMF）。
    // 此處傳遞 from/to，腳本由 STRINGEE_ANSWER_URL 提供。
    const res = await fetch('https://api.stringee.com/v1/call2/callout', {
      method: 'POST',
      headers: { 'X-STRINGEE-AUTH': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { type: 'external', number: callerId || process.env.STRINGEE_FROM_NUMBER, alias: callerId },
        to: [{ type: 'external', number: phone, alias: phone }],
        answer_url: process.env.STRINGEE_ANSWER_URL,
        // audioUrl 由 answer_url 腳本使用（playAudio）
        custom: { audioUrl },
      }),
    }).catch(() => null)
    if (!res || !res.ok) return { callId: null }
    const data = await res.json().catch(() => null)
    return { callId: data?.call_id ?? data?.callId ?? null }
  },

  async sendSms({ phone, text }: SmsParams) {
    const token = await stringeeJwt()
    if (!token) return false
    const res = await fetch('https://api.stringee.com/v1/sms', {
      method: 'POST',
      headers: { 'X-STRINGEE-AUTH': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sms: [{
          from: process.env.STRINGEE_SMS_BRANDNAME,
          to: phone,
          text,
        }],
      }),
    }).catch(() => null)
    return !!res && res.ok
  },
}
