/**
 * Bird provider（新版平台 API，Bearer 驗證）：語音外撥 + SMS。
 *
 * 語音：POST {BIRD_API_URL}/v1/voice/calls，body { from, to, sequence: { id, entry_node_id, trigger_data } }
 * 通話流程在 Bird 後台的 Sequence 建立；trigger_data 帶入 audio_url（ElevenLabs 語音檔）供 Sequence 播放。
 * 環境變數：BIRD_API_KEY、BIRD_VOICE_SEQUENCE_ID、BIRD_VOICE_ENTRY_NODE_ID、
 *          BIRD_VOICE_FROM（未設定時沿用 BIRD_SMS_FROM）、BIRD_API_URL（預設 https://us1.platform.bird.com）
 */
import { randomUUID } from 'crypto'
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'
import { formatToE164 } from './twilio'

const API_URL = () => (process.env.BIRD_API_URL || 'https://us1.platform.bird.com').replace(/\/$/, '')

export const birdProvider: TelephonyProvider = {
  name: 'bird',

  isConfigured() {
    return !!(
      process.env.BIRD_API_KEY &&
      process.env.BIRD_VOICE_SEQUENCE_ID &&
      process.env.BIRD_VOICE_ENTRY_NODE_ID &&
      (process.env.BIRD_VOICE_FROM || process.env.BIRD_SMS_FROM)
    )
  },

  async call({ phone, audioUrl }: VoiceCallParams) {
    const apiKey = process.env.BIRD_API_KEY
    const sequenceId = process.env.BIRD_VOICE_SEQUENCE_ID
    const entryNodeId = process.env.BIRD_VOICE_ENTRY_NODE_ID
    const from = process.env.BIRD_VOICE_FROM || process.env.BIRD_SMS_FROM
    if (!apiKey || !sequenceId || !entryNodeId || !from) {
      throw new Error('Bird 語音未設定（需 BIRD_API_KEY / BIRD_VOICE_SEQUENCE_ID / BIRD_VOICE_ENTRY_NODE_ID / BIRD_VOICE_FROM）')
    }

    const res = await fetch(`${API_URL()}/v1/voice/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // 每通一個新 key：網路重試時 Bird 不會重複撥打
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        from,
        to: formatToE164(phone),
        sequence: { id: sequenceId, entry_node_id: entryNodeId, trigger_data: { audio_url: audioUrl } },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message ?? data?.error ?? `Bird 撥打失敗 (${res.status})`)
    return { callId: data?.id ?? data?.call_id ?? null }
  },

  // SMS：POST {BIRD_API_URL}/v1/sms/messages（Bearer）
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
    const res = await fetch(`${API_URL()}/v1/sms/messages`, {
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
