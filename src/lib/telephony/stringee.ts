/**
 * Stringee (越南本地) provider：語音外撥 + SMS Brandname。
 * 越南境內費率遠低於國際 CPaaS，量大時切換用。
 *
 * 認證：Stringee 用 JWT（API key SID + secret 簽發）。
 * Docs: https://developer.stringee.com
 *
 * 需要環境變數：
 *   STRINGEE_API_KEY_SID
 *   STRINGEE_API_KEY_SECRET
 *   STRINGEE_FROM_NUMBER       (語音外顯)
 *   STRINGEE_SMS_BRANDNAME     (簡訊發送名稱)
 *   STRINGEE_ANSWER_URL        (語音 SCCO 腳本網址，若無則自動使用內聯 actions)
 */
import * as crypto from 'crypto'
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'

function configured() {
  return !!(process.env.STRINGEE_API_KEY_SID && process.env.STRINGEE_API_KEY_SECRET)
}

function stringeeJwt(): string | null {
  const sid = process.env.STRINGEE_API_KEY_SID
  const secret = process.env.STRINGEE_API_KEY_SECRET
  if (!sid || !secret) return null

  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256', cty: 'stringee-api;v=1' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    jti: `${sid}-${now}`,
    iss: sid,
    exp: now + 3600,
    rest_api: true,
  })).toString('base64url')

  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

/**
 * 格式化為 Stringee 越南格式：84xxxxxxxxx
 */
function normalizeVietnamPhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+84')) return cleaned.slice(1)
  if (cleaned.startsWith('84')) return cleaned
  if (cleaned.startsWith('0')) return '84' + cleaned.slice(1)
  return cleaned
}

export const stringeeProvider: TelephonyProvider = {
  name: 'stringee',

  isConfigured() {
    return configured()
  },

  async call({ phone, audioUrl, callerId, collectDtmf }: VoiceCallParams) {
    const token = stringeeJwt()
    if (!token) throw new Error('STRINGEE_API_KEY_SID / STRINGEE_API_KEY_SECRET 未設定')

    const fromNum = callerId || process.env.STRINGEE_FROM_NUMBER
    if (!fromNum) {
      throw new Error('Stringee 撥打需要設定外顯電話號碼 (STRINGEE_FROM_NUMBER 或 callerId)')
    }

    const toPhone = normalizeVietnamPhone(phone)
    const fromPhone = normalizeVietnamPhone(fromNum)

    const answerUrl = process.env.STRINGEE_ANSWER_URL
    const reqBody: Record<string, unknown> = {
      from: { type: 'external', number: fromPhone, alias: fromPhone },
      to: [{ type: 'external', number: toPhone, alias: toPhone }],
      custom: { audioUrl },
    }

    if (answerUrl) {
      reqBody.answer_url = answerUrl
    } else {
      // 內聯 actions (SCCO): 播放 ElevenLabs 音檔，可選收集 DTMF 按鍵
      const actions: Array<Record<string, unknown>> = [
        { action: 'play', fileName: audioUrl },
      ]
      if (collectDtmf) {
        actions.push({ action: 'input', maxDigits: 1, timeout: 8 })
      }
      reqBody.actions = actions
    }

    const res = await fetch('https://api.stringee.com/v1/call2/callout', {
      method: 'POST',
      headers: { 'X-STRINGEE-AUTH': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || (typeof data?.r === 'number' && data.r !== 0)) {
      const errMsg = data?.message || data?.error || `Stringee 撥打失敗 (${res.status})`
      throw new Error(errMsg)
    }

    return { callId: data?.call_id ?? data?.callId ?? null }
  },

  async sendSms({ phone, text }: SmsParams) {
    const token = stringeeJwt()
    if (!token) return false
    const toPhone = normalizeVietnamPhone(phone)

    const res = await fetch('https://api.stringee.com/v1/sms', {
      method: 'POST',
      headers: { 'X-STRINGEE-AUTH': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sms: [{
          from: process.env.STRINGEE_SMS_BRANDNAME || 'NOTICE',
          to: toPhone,
          text,
        }],
      }),
    }).catch(() => null)

    if (!res || !res.ok) return false
    const data = await res.json().catch(() => ({}))
    return data?.r === 0 || data?.status === 'success'
  },
}
