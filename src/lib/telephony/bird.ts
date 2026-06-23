/**
 * Bird (app.bird.com) provider：語音外撥 + SMS。
 * Docs: https://docs.bird.com
 */
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'

const BASE = 'https://api.bird.com'

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

  async sendSms({ phone, text }: SmsParams) {
    const workspaceId = process.env.BIRD_WORKSPACE_ID
    const channelId = process.env.BIRD_SMS_CHANNEL_ID
    if (!process.env.BIRD_API_KEY || !workspaceId || !channelId) return false
    const res = await fetch(`${BASE}/workspaces/${workspaceId}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        receiver: { contacts: [{ identifierValue: phone }] },
        body: { type: 'text', text: { text } },
      }),
    })
    return res.ok
  },
}
