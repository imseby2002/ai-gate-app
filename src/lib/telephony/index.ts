/**
 * Telephony provider 工廠：依 TELEPHONY_PROVIDER 選擇撥打/發送供應商。
 * - 'bird'（預設）：國際 CPaaS，一家做語音+SMS
 * - 'stringee'：越南本地，量大時成本較低
 *
 * 之後若要「語音用 A、SMS 用 B」可再擴充為分通道選擇。
 */
import type { TelephonyProvider } from './types'
import { birdProvider } from './bird'
import { stringeeProvider } from './stringee'

export type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'

const PROVIDERS: Record<string, TelephonyProvider> = {
  bird: birdProvider,
  stringee: stringeeProvider,
}

export function getTelephonyProvider(): TelephonyProvider {
  const key = (process.env.TELEPHONY_PROVIDER || 'bird').toLowerCase()
  return PROVIDERS[key] ?? birdProvider
}
