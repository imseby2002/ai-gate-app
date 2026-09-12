/**
 * 智慧多國簡訊發送路由中心 (Multi-Country Smart SMS Service)
 *
 * 依電話門號國碼自動分流：
 * 1. 🇹🇼 台灣門號 (+886 / 09xx) ─── 走 sms-get.com (簡訊特惠網，成本約 NT$ 0.72 ~ 0.86 / 則)
 * 2. 🇻🇳 越南門號 (+84 / 03,05,07,08,09xx) ─ 優先走 Zalo ZNS，若無則走 Stringee (SMS Brandname，成本約 NT$ 0.55 ~ 0.8 / 則)
 * 3. 🌐 其他國際門號 (+1, +81, +82, +65 等) ─ 走 Twilio (全區通用，支援 Bird 作為備援)
 */
import * as crypto from 'crypto'
import { birdProvider } from './bird'

export type SmsCountry = 'TW' | 'VN' | 'INTL'

export interface SmsSendOptions {
  phone: string
  text: string
  name?: string
  zaloTemplateId?: string
  zaloTemplateData?: Record<string, unknown>
}

export interface SmsSendResult {
  phone: string
  normalizedPhone: string
  country: SmsCountry
  provider: 'sms-get' | 'stringee' | 'zalo-zns' | 'twilio' | 'bird'
  ok: boolean
  messageId?: string
  error?: string
}

// ── 判斷手機國別 ─────────────────────────────────────────────────────────────
export function detectSmsCountry(rawPhone: string): SmsCountry {
  const cleaned = rawPhone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+886') || cleaned.startsWith('886')) return 'TW'
  if (cleaned.startsWith('09') && cleaned.length === 10) return 'TW'
  if (cleaned.startsWith('+84') || cleaned.startsWith('84')) return 'VN'
  // 越南境內 10 碼：03, 05, 07, 08, 09 開頭
  if (/^0[35789]\d{8}$/.test(cleaned)) return 'VN'
  return 'INTL'
}

// ── 格式化電話號碼 ───────────────────────────────────────────────────────────
export function normalizePhoneForCountry(rawPhone: string, country: SmsCountry): string {
  const cleaned = rawPhone.replace(/[^\d+]/g, '')
  if (country === 'TW') {
    // 台灣本地格式：09xxxxxxxx
    if (cleaned.startsWith('+886')) return '0' + cleaned.slice(4)
    if (cleaned.startsWith('886')) return '0' + cleaned.slice(3)
    return cleaned
  }
  if (country === 'VN') {
    // 越南國際格式：84xxxxxxxxx
    if (cleaned.startsWith('+84')) return cleaned.slice(1)
    if (cleaned.startsWith('84')) return cleaned
    if (cleaned.startsWith('0')) return '84' + cleaned.slice(1)
    return cleaned
  }
  // 國際格式：E.164 (+開頭)
  if (!cleaned.startsWith('+')) return '+' + cleaned
  return cleaned
}

// ── 1. 台灣通道：sms-get.com ──────────────────────────────────────────────────
async function sendViaSmsGet(phone: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const username = process.env.SMSGET_USERNAME
  const password = process.env.SMSGET_PASSWORD
  if (!username || !password) {
    return { ok: false, error: 'SMS-GET 帳號未設定（請設定 SMSGET_USERNAME / SMSGET_PASSWORD）' }
  }

  try {
    const url = new URL('http://sms-get.com/api_send.php')
    url.searchParams.set('username', username)
    url.searchParams.set('password', password)
    url.searchParams.set('method', '1') // 1: 即時發送
    url.searchParams.set('phone', phone)
    url.searchParams.set('sms_msg', text)

    const res = await fetch(url.toString(), { method: 'GET' })
    const data = await res.json().catch(async () => {
      const txt = await res.text()
      try { return JSON.parse(txt) } catch { return { raw: txt } }
    })

    if (data.stats === true || data.status === 'success' || data.code === '000') {
      return { ok: true, messageId: data.msgid || data.id || 'ok' }
    }
    const errMsg = data.error_msg || data.msg || data.error || (typeof data === 'string' ? data : JSON.stringify(data))
    return { ok: false, error: `SMS-GET 發送失敗：${errMsg}` }
  } catch (e) {
    return { ok: false, error: `SMS-GET 連線異常：${String(e)}` }
  }
}

// ── 2. 越南通道：Stringee / Zalo ZNS ─────────────────────────────────────────
function createStringeeJwt(sid: string, secret: string): string {
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

async function sendViaStringee(phone: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const sid = process.env.STRINGEE_API_KEY_SID
  const secret = process.env.STRINGEE_API_KEY_SECRET
  const brandname = process.env.STRINGEE_SMS_BRANDNAME || 'NOTICE'
  if (!sid || !secret) {
    return { ok: false, error: 'Stringee 未設定（請設定 STRINGEE_API_KEY_SID / STRINGEE_API_KEY_SECRET）' }
  }

  try {
    const token = createStringeeJwt(sid, secret)
    const res = await fetch('https://api.stringee.com/v1/sms', {
      method: 'POST',
      headers: {
        'X-STRINGEE-AUTH': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sms: [{
          from: brandname,
          to: phone,
          text,
        }],
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok && (data.r === 0 || data.status === 'success' || data.messages?.[0]?.status === 'queued')) {
      return { ok: true, messageId: data.messages?.[0]?.id || 'stringee-ok' }
    }
    return { ok: false, error: data.message || data.error || `Stringee 錯誤 (${res.status})` }
  } catch (e) {
    return { ok: false, error: `Stringee 連線異常：${String(e)}` }
  }
}

async function sendViaZaloZns(
  phone: string,
  templateId?: string,
  templateData?: Record<string, unknown>,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = process.env.ZALO_ZNS_ACCESS_TOKEN || process.env.ZALO_OA_ACCESS_TOKEN
  if (!token || !templateId) {
    return { ok: false, error: 'Zalo ZNS 權杖或範本 ID 未設定' }
  }

  try {
    const res = await fetch('https://business.openapi.zalo.me/message/template', {
      method: 'POST',
      headers: {
        access_token: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        template_id: templateId,
        template_data: templateData || {},
      }),
    })

    const data = await res.json()
    if (data.error === 0) {
      return { ok: true, messageId: data.data?.msg_id || 'zns-ok' }
    }
    return { ok: false, error: `ZNS 錯誤 (${data.error}): ${data.message}` }
  } catch (e) {
    return { ok: false, error: `Zalo ZNS 連線失敗：${String(e)}` }
  }
}

// ── 3. 國際通道：Twilio (備援 Bird) ──────────────────────────────────────────
async function sendViaTwilio(phone: string, text: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    // 備援：若未設定 Twilio，嘗試以系統內建的 Bird 發送
    if (birdProvider.isConfigured()) {
      const ok = await birdProvider.sendSms({ phone, text })
      return ok ? { ok: true, messageId: 'bird-sent' } : { ok: false, error: 'Bird 國際 SMS 發送失敗' }
    }
    return { ok: false, error: 'Twilio 未設定（請設定 TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER）' }
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const bodyParams = new URLSearchParams({
      From: fromNumber,
      To: phone,
      Body: text,
    })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok && data.sid) {
      return { ok: true, messageId: data.sid }
    }
    return { ok: false, error: data.message || `Twilio 錯誤 (${res.status})` }
  } catch (e) {
    return { ok: false, error: `Twilio 連線失敗：${String(e)}` }
  }
}

// ── 核心發送單則簡訊（智慧分流） ──────────────────────────────────────────────
export async function sendSmsMessage(options: SmsSendOptions): Promise<SmsSendResult> {
  const { phone: rawPhone, text, zaloTemplateId, zaloTemplateData } = options
  const country = detectSmsCountry(rawPhone)
  const normalizedPhone = normalizePhoneForCountry(rawPhone, country)

  // 🇹🇼 台灣號碼 ── 走 sms-get.com
  if (country === 'TW') {
    const res = await sendViaSmsGet(normalizedPhone, text)
    return {
      phone: rawPhone,
      normalizedPhone,
      country,
      provider: 'sms-get',
      ok: res.ok,
      messageId: res.messageId,
      error: res.error,
    }
  }

  // 🇻🇳 越南號碼 ── 優先嘗試 Zalo ZNS，若無則走 Stringee
  if (country === 'VN') {
    if (zaloTemplateId && (process.env.ZALO_ZNS_ACCESS_TOKEN || process.env.ZALO_OA_ACCESS_TOKEN)) {
      const znsRes = await sendViaZaloZns(normalizedPhone, zaloTemplateId, zaloTemplateData)
      if (znsRes.ok) {
        return {
          phone: rawPhone,
          normalizedPhone,
          country,
          provider: 'zalo-zns',
          ok: true,
          messageId: znsRes.messageId,
        }
      }
      // ZNS 失敗時繼續 fallback 到 Stringee 一般 SMS
    }

    const stringeeRes = await sendViaStringee(normalizedPhone, text)
    return {
      phone: rawPhone,
      normalizedPhone,
      country,
      provider: 'stringee',
      ok: stringeeRes.ok,
      messageId: stringeeRes.messageId,
      error: stringeeRes.error,
    }
  }

  // 🌐 其他國際號碼 ── 走 Twilio (備援 Bird)
  const twilioRes = await sendViaTwilio(normalizedPhone, text)
  return {
    phone: rawPhone,
    normalizedPhone,
    country,
    provider: process.env.TWILIO_ACCOUNT_SID ? 'twilio' : 'bird',
    ok: twilioRes.ok,
    messageId: twilioRes.messageId,
    error: twilioRes.error,
  }
}

// ── 批次發送簡訊 ─────────────────────────────────────────────────────────────
export async function sendBatchSms(
  recipients: Array<{ phone: string; name?: string; group?: string }>,
  defaultText: string,
  groupTexts?: Record<string, string>,
  zaloTemplateId?: string,
): Promise<{
  total: number
  success: number
  results: SmsSendResult[]
}> {
  const results: SmsSendResult[] = []

  for (const item of recipients) {
    const rawPhone = item.phone?.trim()
    if (!rawPhone || rawPhone.length < 8) continue

    const baseText = (item.group && groupTexts?.[item.group]) || defaultText || ''
    // 變數替換：{name}、{phone}
    const personalizedText = baseText
      .replace(/\{name\}/g, item.name || '客戶')
      .replace(/\{phone\}/g, rawPhone)

    const res = await sendSmsMessage({
      phone: rawPhone,
      text: personalizedText,
      name: item.name,
      zaloTemplateId,
    })

    results.push(res)
    // 微小間隔避免短時間爆發 rate limit
    await new Promise(r => setTimeout(r, 120))
  }

  const success = results.filter(r => r.ok).length
  return {
    total: results.length,
    success,
    results,
  }
}
