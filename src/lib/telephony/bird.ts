/**
 * Bird provider（新版平台 API，Bearer 驗證）：語音外撥 + SMS。
 *
 * 語音：POST {BIRD_API_URL}/v1/voice/calls
 *   body { from, to, sequence: { id, entry_node_id, trigger_data } }（取自 Bird 後台 Sequence「Create a call」範例，使用已發佈版本）
 * 通話流程在 Bird 後台的 Sequence（vsq_…）建立並發佈；進入點要求 trigger_data.audio_url。
 * 環境變數：BIRD_API_KEY、BIRD_VOICE_SEQUENCE_ID（vsq_…）、BIRD_VOICE_ENTRY_NODE_ID（預設 start）、
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
      (process.env.BIRD_VOICE_FROM || process.env.BIRD_SMS_FROM)
    )
  },

  async call({ phone, audioUrl }: VoiceCallParams) {
    const apiKey = process.env.BIRD_API_KEY
    const sequenceId = process.env.BIRD_VOICE_SEQUENCE_ID
    const entryNodeId = process.env.BIRD_VOICE_ENTRY_NODE_ID || 'start'
    const from = process.env.BIRD_VOICE_FROM || process.env.BIRD_SMS_FROM
    if (!apiKey || !sequenceId || !from) {
      throw new Error('Bird 語音未設定（需 BIRD_API_KEY / BIRD_VOICE_SEQUENCE_ID / BIRD_VOICE_FROM 或 BIRD_SMS_FROM）')
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
        // 已發佈 Sequence 的進入點要求 trigger_data.audio_url（ElevenLabs 語音檔網址）
        sequence: { id: sequenceId, entry_node_id: entryNodeId, trigger_data: { audio_url: audioUrl } },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Bird 撥打失敗 (HTTP ${res.status})：${birdErrorText(data)}`)
    return { callId: data?.id ?? data?.call_id ?? null }
  },

  // SMS：POST {BIRD_API_URL}/v1/sms/messages（Bearer）
  // 需 BIRD_API_KEY、BIRD_SMS_FROM（已驗證的美國號碼）；category 預設 marketing
  async sendSms({ phone, text }: SmsParams) {
    return (await sendBirdSms(phone, text)).ok
  },
}

/** Bird 錯誤回應（{ error: { type, code, message, doc_url } } 或扁平 { message }）轉成可讀文字，保留 code 方便查文件 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function birdErrorText(data: any): string {
  const e = data?.error && typeof data.error === 'object' ? data.error : data
  const parts = [e?.code, e?.type, e?.message ?? (typeof data?.error === 'string' ? data.error : null)].filter(Boolean)
  const text = parts.join(' / ') || '未知錯誤'
  // 驗證錯誤時附上欄位明細（結構未定，原樣輸出前 500 字）
  const extra = e?.details ?? e?.errors ?? e?.fields ?? e?.issues ?? data?.errors ?? data?.details
  // 找不到已知明細欄位時，驗證錯誤直接附原始回應，方便對照 Bird 實際格式
  const raw = !extra && e?.type === 'validation_error' ? data : null
  const detail = extra || raw ? ` ${JSON.stringify(extra ?? raw).slice(0, 800)}` : ''
  return (e?.doc_url ? `${text}（${e.doc_url}）` : text) + detail
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
