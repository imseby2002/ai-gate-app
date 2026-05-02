/**
 * POST /api/marketing/phone-call
 * 電話行銷單元
 *
 * TTS：ElevenLabs（全區）
 * 撥打：Bird (app.bird.com)
 * VBEE：功能保留，待日後啟用
 *
 * action: 'tts'   → 生成語音試聽（回傳音頻 URL）
 * action: 'call'  → 撥打單支電話
 * action: 'batch' → 批次撥打多支電話
 *
 * Body: {
 *   action: 'tts' | 'call' | 'batch'
 *   script: string
 *   phones?: string[]
 *   phone?: string
 *   voiceId?: string           // ElevenLabs voice ID
 *   modelId?: string           // ElevenLabs model ID
 *   birdCallerId?: string      // Bird 顯示號碼
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── ElevenLabs TTS → Supabase Storage ─────────────────────────────────────────
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

// ── Bird Outbound Call ──────────────────────────────────────────────────────────
// Docs: https://docs.bird.com/api/calls-api/outbound-calls
async function birdCall(
  phone: string,
  audioUrl: string,
  callerId: string,
): Promise<{ callId: string }> {
  const apiKey = process.env.BIRD_API_KEY
  const workspaceId = process.env.BIRD_WORKSPACE_ID
  if (!apiKey) throw new Error('BIRD_API_KEY 未設定')
  if (!workspaceId) throw new Error('BIRD_WORKSPACE_ID 未設定')
  if (!callerId) throw new Error('Bird 顯示號碼未填寫')

  const res = await fetch(`https://api.bird.com/workspaces/${workspaceId}/calls`, {
    method: 'POST',
    headers: {
      Authorization: `AccessKey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receiver: {
        contacts: [{ identifierValue: phone }],
      },
      sender: {
        identifierValue: callerId,
      },
      flow: {
        title: 'Marketing Call',
        steps: [
          {
            id: 'play-audio',
            type: 'playAudio',
            properties: { url: audioUrl },
            onSuccess: 'hangup',
          },
          {
            id: 'hangup',
            type: 'hangup',
          },
        ],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? err?.error ?? `Bird 撥打失敗 (${res.status})`)
  }

  const data = await res.json()
  return { callId: data?.id ?? data?.callId ?? '' }
}

// ── Main Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    action = 'tts',
    script = '',
    phones = [],
    phone = '',
    voiceId = 'EXAVITQu4vr4xnSDxMaL',
    modelId = 'eleven_multilingual_v2',
    birdCallerId = '',
  } = body

  if (!script.trim()) return NextResponse.json({ error: '腳本不可為空' }, { status: 400 })

  try {
    // ── TTS only ─────────────────────────────────────────────────────────────
    if (action === 'tts') {
      const audioUrl = await elevenLabsTTS(script, voiceId, modelId, supabase, user.id)
      return NextResponse.json({ audioUrl, provider: 'ElevenLabs' })
    }

    // ── Single call ───────────────────────────────────────────────────────────
    if (action === 'call') {
      if (!phone) return NextResponse.json({ error: '請提供電話號碼' }, { status: 400 })
      const audioUrl = await elevenLabsTTS(script, voiceId, modelId, supabase, user.id)
      const result = await birdCall(phone, audioUrl, birdCallerId)
      return NextResponse.json({ ok: true, phone, callId: result.callId, audioUrl, provider: 'Bird' })
    }

    // ── Batch calls ───────────────────────────────────────────────────────────
    if (action === 'batch') {
      const list: string[] = phones.filter((p: string) => p.trim())
      if (list.length === 0) return NextResponse.json({ error: '請提供電話號碼清單' }, { status: 400 })

      // Generate TTS once, reuse audio URL for all calls
      const audioUrl = await elevenLabsTTS(script, voiceId, modelId, supabase, user.id)

      const results: { phone: string; ok: boolean; id?: string; error?: string }[] = []
      for (const p of list) {
        try {
          const r = await birdCall(p, audioUrl, birdCallerId)
          results.push({ phone: p, ok: true, id: r.callId })
        } catch (e) {
          results.push({ phone: p, ok: false, error: String(e) })
        }
        await new Promise(r => setTimeout(r, 600))
      }

      return NextResponse.json({
        results,
        audioUrl,
        total: list.length,
        success: results.filter(r => r.ok).length,
        provider: 'Bird',
      })
    }

    return NextResponse.json({ error: '不支援的 action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
