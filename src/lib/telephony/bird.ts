/**
 * Bird provider（新版平台 API，Bearer 驗證）：語音外撥 + SMS。
 *
 * 語音：POST {BIRD_API_URL}/v1/voice/calls
 *   有腳本：sequence.definition（inline，voice.say 朗讀腳本，語言 BIRD_VOICE_LANGUAGE 或自動判斷 zh/en）
 *   無腳本：sequence.id（後台已發佈 Sequence，trigger_data.audio_url）
 * 環境變數：BIRD_API_KEY、BIRD_VOICE_SEQUENCE_ID（選填）、BIRD_VOICE_ENTRY_NODE_ID（預設 start）、BIRD_VOICE_LANGUAGE（選填）、
 *          BIRD_VOICE_FROM（未設定時沿用 BIRD_SMS_FROM）、BIRD_API_URL（預設 https://us1.platform.bird.com）
 */
import { randomUUID } from 'crypto'
import type { TelephonyProvider, VoiceCallParams, SmsParams } from './types'
import { formatToE164 } from './twilio'

const API_URL = () => (process.env.BIRD_API_URL || 'https://us1.platform.bird.com').replace(/\/$/, '')

export const birdProvider: TelephonyProvider = {
  name: 'bird',

  isConfigured() {
    return !!(process.env.BIRD_API_KEY && (process.env.BIRD_VOICE_FROM || process.env.BIRD_SMS_FROM))
  },

  async call({ phone, audioUrl, text, callerId }: VoiceCallParams) {
    const apiKey = process.env.BIRD_API_KEY
    const sequenceId = process.env.BIRD_VOICE_SEQUENCE_ID
    const from = callerId?.trim() || process.env.BIRD_VOICE_FROM || process.env.BIRD_SMS_FROM
    if (!apiKey || !from) {
      throw new Error('Bird 語音未設定（需 BIRD_API_KEY / BIRD_VOICE_FROM 或 BIRD_SMS_FROM）')
    }
    const script = text?.trim()
    if (!script && !sequenceId) throw new Error('Bird 撥打需要腳本文字或 BIRD_VOICE_SEQUENCE_ID')

    // 有腳本 → inline sequence 以 voice.say 朗讀（每通用最新腳本，不需後台上傳音檔）；
    // 無腳本 → 走後台已發佈的 Sequence（BIRD_VOICE_SEQUENCE_ID）
    const sequence = script
      ? { entry_node_id: 'start', trigger_data: {}, definition: inlineSayDefinition(script) }
      : {
          id: sequenceId,
          entry_node_id: process.env.BIRD_VOICE_ENTRY_NODE_ID || 'start',
          trigger_data: { audio_url: audioUrl },
        }

    const res = await fetch(`${API_URL()}/v1/voice/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // 每通一個新 key：網路重試時 Bird 不會重複撥打
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({ from, to: formatToE164(phone), sequence }),
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

/** 腳本語言：BIRD_VOICE_LANGUAGE 優先；含中日韓字元用 zh，否則 en */
function sayLanguage(text: string): string {
  if (process.env.BIRD_VOICE_LANGUAGE) return process.env.BIRD_VOICE_LANGUAGE
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(text) ? 'zh' : 'en'
}

/** inline sequence：接通後朗讀腳本 → 結束（格式依 Bird「Create a voice call」文件的 inline definition 範例） */
function inlineSayDefinition(text: string) {
  return {
    schema_version: 1,
    expression_environment: 'bird.cel.v1',
    nodes: [
      {
        id: 'start', type: 'trigger.start_call', type_version: 1, config: {}, input: {},
        connections: { event: { node_id: 'say', port: 'input' } },
      },
      {
        id: 'say', type: 'voice.say', type_version: 1, config: {},
        input: { text, language: sayLanguage(text) },
        connections: { next: { node_id: 'done', port: 'input' } },
      },
      {
        id: 'done', type: 'logic.exit', type_version: 1,
        config: { status: 'succeeded', reason: 'script_played' }, input: { output: {} },
      },
    ],
  }
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
