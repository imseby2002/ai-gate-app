/**
 * Telephony provider 工廠與智慧多國語音路由中心
 *
 * 語音通話智慧路由：
 * - 🇻🇳 越南門號 (+84 / 03,05,07,08,09xx) ── 優先走 Stringee (越南境內線路，約 NT$ 0.8~1.2/分，免國際警告)
 * - 🇹🇼 台灣門號 (+886 / 09xx) ───────── 走 Twilio Voice (支援驗證主叫號碼 Verified Caller ID，不需買號碼，支援手機/市話外顯)
 * - 🌐 其他國際門號 (+1, +81, +82 等) ───── 走 Twilio Voice (支援 Bird 作為備援)
 *
 * 亦支援透過環境變數強制指定：
 * - TELEPHONY_PROVIDER = 'twilio' | 'stringee' | 'bird'
 */
import type { TelephonyProvider } from './types'
import { birdProvider } from './bird'
import { stringeeProvider } from './stringee'
import { twilioProvider } from './twilio'

export type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'
export { birdProvider } from './bird'
export { stringeeProvider } from './stringee'
export { twilioProvider } from './twilio'

const PROVIDERS: Record<string, TelephonyProvider> = {
  twilio: twilioProvider,
  bird: birdProvider,
  stringee: stringeeProvider,
}

export type PhoneCountry = 'TW' | 'VN' | 'INTL'

/**
 * 判斷門號國別
 */
export function detectPhoneCountry(rawPhone: string): PhoneCountry {
  const cleaned = rawPhone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+886') || cleaned.startsWith('886')) return 'TW'
  if (cleaned.startsWith('09') && cleaned.length === 10) return 'TW'
  if (cleaned.startsWith('+84') || cleaned.startsWith('84')) return 'VN'
  if (/^0[35789]\d{8}$/.test(cleaned)) return 'VN'
  return 'INTL'
}

/**
 * 依受話電話號碼智慧選擇最適語音 Provider
 */
export function getTelephonyProviderForPhone(phone: string): TelephonyProvider {
  // 若有強制指定非 auto 的 provider
  const forced = process.env.TELEPHONY_PROVIDER?.toLowerCase()
  if (forced && forced !== 'auto' && PROVIDERS[forced]) {
    return PROVIDERS[forced]
  }

  const country = detectPhoneCountry(phone)

  // 🇻🇳 越南號碼：優先 Stringee，次選 Twilio，後備 Bird
  if (country === 'VN') {
    if (stringeeProvider.isConfigured()) return stringeeProvider
    if (twilioProvider.isConfigured()) return twilioProvider
    return birdProvider
  }

  // 🇹🇼 台灣與 🌐 國際號碼：優先 Twilio，次選 Bird，後備 Stringee
  if (twilioProvider.isConfigured()) return twilioProvider
  if (birdProvider.isConfigured()) return birdProvider
  if (stringeeProvider.isConfigured()) return stringeeProvider

  // 預設 Twilio
  return twilioProvider
}

/**
 * 取得通用 Telephony Provider（相容舊有調用）
 */
export function getTelephonyProvider(preferred?: string): TelephonyProvider {
  if (preferred && PROVIDERS[preferred.toLowerCase()]) {
    return PROVIDERS[preferred.toLowerCase()]
  }

  const key = (process.env.TELEPHONY_PROVIDER || '').toLowerCase()
  if (key && PROVIDERS[key]) {
    return PROVIDERS[key]
  }

  // 預設優先選擇已設定的 Provider：Twilio > Bird > Stringee
  if (twilioProvider.isConfigured()) return twilioProvider
  if (birdProvider.isConfigured()) return birdProvider
  if (stringeeProvider.isConfigured()) return stringeeProvider

  return twilioProvider
}
