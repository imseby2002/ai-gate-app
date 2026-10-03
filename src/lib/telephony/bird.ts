/**
 * Bird provider：語音外撥 + SMS。
 * 語音仍為舊版 api.bird.com 流程（新版平台語音 API 待確認，目前路由不會優先選 Bird 撥打）；
 * SMS 已改用新版平台 API。
 */
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'

const BASE = 'https://api.bird.com'
const SMS_BASE = 'https://us1.platform.bird.com/v1'

function auth() {
  return {
    Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export const birdProvider: TelephonyProvider = {
  name: 'bird',

  isConfigured() {
    return !!(process.env.BIRD_API_KEY && process.env.BIRD_WORKSPACE_ID)
  },

  async call({ phone, audioUrl, callerId, collectDtmf }: VoiceCallParams) {
    const workspaceId = process.env.BIRD_WORKSPACE_ID
    if (!process.env.BIRD_API_KEY || !workspaceId) throw new Error('BIRD_API_KEY / BIRD_WORKSPACE_ID 未設定')
    if (!callerId) throw new Error('Bird 顯示號碼未填寫')

    // 播完音檔；有按鍵加入社群設定時改為收 1 碼後掛斷，
    // 按鍵結果由 Bird call events 推送至 /api/ivr/webhook/voice。
    const steps = collectDtmf
      ? [
          { id: 'play-audio', type: 'playAudio', properties: { url: audioUrl }, onSuccess: 'gather' },
          { id: 'gather', type: 'gatherDtmf', properties: { maxDigits: 1, timeout: 8 }, onSuccess: 'hangup', onError: 'hangup' },
          { id: 'hangup', type: 'hangup' },
        ]
      : [
          { id: 'play-audio', type: 'playAudio', properties: { url: audioUrl }, onSuccess: 'hangup' },
          { id: 'hangup', type: 'hangup' },
        ]

    const res = await fetch(`${BASE}/workspaces/${workspaceId}/calls`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        receiver: { contacts: [{ identifierValue: phone }] },
        sender: { identifierValue: callerId },
        flow: { title: 'Marketing Call', steps },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.message ?? err?.error ?? `Bird 撥打失敗 (${res.status})`)
    }
    const data = await res.json().catch(() => null)
    return { callId: data?.id ?? data?.callId ?? null }
  },

  // 新版 Bird 平台 SMS API：POST https://us1.platform.bird.com/v1/sms/messages（Bearer）
  // 需 BIRD_API_KEY、BIRD_SMS_FROM（已驗證的美國號碼）；category 預設 marketing
  async sendSms({ phone, text }: SmsParams) {
    return (await sendBirdSms(phone, text)).ok
  },
}

export function isBirdSmsConfigured(): boolean {
  return !!(process.env.BIRD_API_KEY && process.env.BIRD_SMS_FROM)
}

export async function sendBirdSms(
  phone: string,
  text: string,
  category: 'marketing' | 'transactional' = 'marketing',
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BIRD_API_KEY
  const from = process.env.BIRD_SMS_FROM
  if (!apiKey || !from) return { ok: false, error: 'Bird SMS 未設定（需 BIRD_API_KEY / BIRD_SMS_FROM）' }
  try {
    const res = await fetch(`${SMS_BASE}/sms/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, text, from, category }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.message ?? data?.error ?? `Bird SMS 錯誤 (${res.status})` }
    return { ok: true, messageId: data?.id ?? 'bird-sent' }
  } catch (e) {
    return { ok: false, error: `Bird SMS 連線失敗：${String(e)}` }
  }
}
