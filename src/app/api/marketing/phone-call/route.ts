/**
 * POST /api/marketing/phone-call
 * 電話行銷單元
 *
 * action: 'tts'   → 生成語音試聽（回傳音頻 URL）
 * action: 'call'  → 撥打單支電話
 * action: 'batch' → 批次撥打多支電話
 *
 * 越南：VBEE TTS + VBEE CALL
 * 其他：ElevenLabs TTS + Plivo 撥打
 *
 * Body: {
 *   action: 'tts' | 'call' | 'batch'
 *   region: 'vn' | 'other'
 *   script: string               // 電話腳本文字
 *   phones?: string[]            // 電話號碼清單（call/batch 用）
 *   phone?: string               // 單支電話（call 用）
 *   // VBEE TTS settings
 *   vbeeVoice?: string           // 預設 'hn-quynhanh'
 *   vbeeSpeed?: number           // 0.5-2.0，預設 1.0
 *   // ElevenLabs settings
 *   elevenLabsVoiceId?: string
 *   elevenLabsModelId?: string
 *   // Plivo settings
 *   plivoCallerId?: string       // 顯示號碼
 *   // interval for batch (seconds between calls)
 *   intervalSec?: number
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

// ── VBEE TTS ───────────────────────────────────────────────────────────────────
async function vbeeTTS(script: string, voice: string, speed: number): Promise<string> {
  const apiKey = process.env.VBEE_API_KEY
  if (!apiKey) throw new Error('VBEE_API_KEY 未設定')

  const res = await fetch('https://vbee.vn/api/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_text: script,
      voice_code: voice,
      audio_type: 'mp3',
      speed_rate: speed,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? `VBEE TTS 失敗 (${res.status})`)
  }
  const data = await res.json()
  const audioUrl: string = data?.audio_url ?? data?.url ?? ''
  if (!audioUrl) throw new Error('VBEE TTS 未回傳音頻 URL')
  return audioUrl
}

// ── VBEE CALL ──────────────────────────────────────────────────────────────────
async function vbeeCall(phone: string, audioUrl: string, callerId: string): Promise<{ callId: string }> {
  const apiKey = process.env.VBEE_API_KEY
  if (!apiKey) throw new Error('VBEE_API_KEY 未設定')

  const res = await fetch('https://vbee.vn/api/v1/call/outbound', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: phone,
      audio_url: audioUrl,
      caller_id: callerId || undefined,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? `VBEE CALL 失敗 (${res.status})`)
  }
  const data = await res.json()
  return { callId: data?.call_id ?? data?.id ?? '' }
}

// ── ElevenLabs TTS ─────────────────────────────────────────────────────────────
async function elevenLabsTTS(
  script: string,
  voiceId: string,
  modelId: string,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY 未設定')

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: script,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.detail?.message ?? `ElevenLabs TTS 失敗 (${res.status})`)
  }

  const buffer = await res.arrayBuffer()
  const fileName = `${userId}/phone-tts-${Date.now()}.mp3`

  const { error: uploadErr } = await supabase.storage
    .from('marketing-assets')
    .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: false })
  if (uploadErr) throw new Error(`Storage 上傳失敗：${uploadErr.message}`)

  const { data: { publicUrl } } = supabase.storage.from('marketing-assets').getPublicUrl(fileName)
  return publicUrl
}

// ── Plivo Call ─────────────────────────────────────────────────────────────────
async function plivoCall(phone: string, audioUrl: string, callerId: string): Promise<{ callUuid: string }> {
  const authId = process.env.PLIVO_AUTH_ID
  const authToken = process.env.PLIVO_AUTH_TOKEN
  if (!authId || !authToken) throw new Error('PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN 未設定')
  if (!callerId) throw new Error('PLIVO_CALLER_ID 未設定（請在設定頁面填入顯示號碼）')

  // Plivo answer XML: play audio then hangup
  const answerXml = `<Response><Play>${audioUrl}</Play><Hangup/></Response>`
  const answerUrl = `data:text/xml;base64,${Buffer.from(answerXml).toString('base64')}`

  const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: callerId,
      to: phone,
      answer_url: answerUrl,
      answer_method: 'GET',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `Plivo 撥打失敗 (${res.status})`)
  }
  const data = await res.json()
  return { callUuid: data?.request_uuid ?? data?.uuid ?? '' }
}

// ── Main Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    action = 'tts',
    region = 'vn',
    script = '',
    phones = [],
    phone = '',
    vbeeVoice = 'hn-quynhanh',
    vbeeSpeed = 1.0,
    elevenLabsVoiceId = 'EXAVITQu4vr4xnSDxMaL', // Sarah (multilingual)
    elevenLabsModelId = 'eleven_multilingual_v2',
    plivoCallerId = '',
    vbeeCallerId = '',
  } = body

  if (!script.trim()) return NextResponse.json({ error: '腳本不可為空' }, { status: 400 })

  const isVN = region === 'vn'

  try {
    // ── TTS only ─────────────────────────────────────────────────────────────
    if (action === 'tts') {
      let audioUrl: string
      if (isVN) {
        audioUrl = await vbeeTTS(script, vbeeVoice, vbeeSpeed)
      } else {
        audioUrl = await elevenLabsTTS(script, elevenLabsVoiceId, elevenLabsModelId, supabase, user.id)
      }
      return NextResponse.json({ audioUrl, region, provider: isVN ? 'VBEE' : 'ElevenLabs' })
    }

    // ── Single call ───────────────────────────────────────────────────────────
    if (action === 'call') {
      if (!phone) return NextResponse.json({ error: '請提供電話號碼' }, { status: 400 })

      let audioUrl: string
      if (isVN) {
        audioUrl = await vbeeTTS(script, vbeeVoice, vbeeSpeed)
        const result = await vbeeCall(phone, audioUrl, vbeeCallerId)
        return NextResponse.json({ ok: true, phone, callId: result.callId, audioUrl, provider: 'VBEE' })
      } else {
        audioUrl = await elevenLabsTTS(script, elevenLabsVoiceId, elevenLabsModelId, supabase, user.id)
        const result = await plivoCall(phone, audioUrl, plivoCallerId)
        return NextResponse.json({ ok: true, phone, callUuid: result.callUuid, audioUrl, provider: 'Plivo' })
      }
    }

    // ── Batch calls ───────────────────────────────────────────────────────────
    if (action === 'batch') {
      const list: string[] = phones.filter((p: string) => p.trim())
      if (list.length === 0) return NextResponse.json({ error: '請提供電話號碼清單' }, { status: 400 })

      // Generate TTS once, reuse for all calls
      let audioUrl: string
      if (isVN) {
        audioUrl = await vbeeTTS(script, vbeeVoice, vbeeSpeed)
      } else {
        audioUrl = await elevenLabsTTS(script, elevenLabsVoiceId, elevenLabsModelId, supabase, user.id)
      }

      // Call each number (sequential to avoid rate limits)
      const results: { phone: string; ok: boolean; id?: string; error?: string }[] = []
      for (const p of list) {
        try {
          if (isVN) {
            const r = await vbeeCall(p, audioUrl, vbeeCallerId)
            results.push({ phone: p, ok: true, id: r.callId })
          } else {
            const r = await plivoCall(p, audioUrl, plivoCallerId)
            results.push({ phone: p, ok: true, id: r.callUuid })
          }
        } catch (e) {
          results.push({ phone: p, ok: false, error: String(e) })
        }
        // Small delay between calls
        await new Promise(r => setTimeout(r, 500))
      }

      return NextResponse.json({
        results,
        audioUrl,
        total: list.length,
        success: results.filter(r => r.ok).length,
        provider: isVN ? 'VBEE' : 'Plivo',
      })
    }

    return NextResponse.json({ error: '不支援的 action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
