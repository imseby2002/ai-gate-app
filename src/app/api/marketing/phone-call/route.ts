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
import { createClient, createAdminClient } from '@/lib/supabase/server'

type KeyMapping = { digit: string; channel: string; target_type?: string; join_url: string; label?: string }

/**
 * 確保此用戶有一個「電話行銷」按鍵活動，並以最新對應覆蓋按鍵設定。
 * 回傳 campaign_id 供 ivr_calls 關聯；webhook 收到 DTMF 時據此查對應。
 */
async function ensureIvrCampaign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mappings: KeyMapping[],
): Promise<string | null> {
  const valid = mappings.filter((m) => m?.digit && m?.join_url)
  if (valid.length === 0) return null

  let { data: campaign } = await supabase
    .from('ivr_campaigns')
    .select('id')
    .eq('user_id', userId)
    .eq('name', '電話行銷')
    .maybeSingle()

  if (!campaign) {
    const { data } = await supabase
      .from('ivr_campaigns')
      .insert({ user_id: userId, name: '電話行銷' })
      .select('id')
      .single()
    campaign = data
  }
  if (!campaign) return null

  // 以最新設定覆蓋按鍵對應
  await supabase.from('ivr_key_mappings').delete().eq('campaign_id', campaign.id)
  await supabase.from('ivr_key_mappings').insert(
    valid.map((m) => ({
      user_id: userId,
      campaign_id: campaign!.id,
      digit: m.digit,
      channel: m.channel,
      target_type: m.target_type ?? 'official',
      join_url: m.join_url,
      label: m.label ?? null,
    }))
  )
  return campaign.id
}

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
  collectDtmf = false,
): Promise<{ callId: string }> {
  const apiKey = process.env.BIRD_API_KEY
  const workspaceId = process.env.BIRD_WORKSPACE_ID
  if (!apiKey) throw new Error('BIRD_API_KEY 未設定')
  if (!workspaceId) throw new Error('BIRD_WORKSPACE_ID 未設定')
  if (!callerId) throw new Error('Bird 顯示號碼未填寫')

  // 有按鍵加入社群設定時，播完音檔改為收集 1 碼按鍵後掛斷；
  // 按鍵結果由 Bird call events 推送至 /api/ivr/webhook/voice。
  // TODO: 確認 Bird gatherDtmf 步驟確切 schema。
  const steps = collectDtmf
    ? [
        {
          id: 'play-audio',
          type: 'playAudio',
          properties: { url: audioUrl },
          onSuccess: 'gather',
        },
        {
          id: 'gather',
          type: 'gatherDtmf',
          properties: { maxDigits: 1, timeout: 8 },
          onSuccess: 'hangup',
          onError: 'hangup',
        },
        { id: 'hangup', type: 'hangup' },
      ]
    : [
        {
          id: 'play-audio',
          type: 'playAudio',
          properties: { url: audioUrl },
          onSuccess: 'hangup',
        },
        { id: 'hangup', type: 'hangup' },
      ]

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
        steps,
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
    keyMappings = [],
  } = body

  if (!script.trim()) return NextResponse.json({ error: '腳本不可為空' }, { status: 400 })

  const mappings: KeyMapping[] = Array.isArray(keyMappings) ? keyMappings : []
  const collectDtmf = mappings.some((m) => m?.digit && m?.join_url)

  try {
    // ── TTS only ─────────────────────────────────────────────────────────────
    if (action === 'tts') {
      const audioUrl = await elevenLabsTTS(script, voiceId, modelId, supabase, user.id)
      return NextResponse.json({ audioUrl, provider: 'ElevenLabs' })
    }

    // 有按鍵加入社群設定 → 建立/更新活動，撥打後記錄通話供 webhook 對應
    const campaignId = collectDtmf ? await ensureIvrCampaign(supabase, user.id, mappings) : null
    const admin = campaignId ? await createAdminClient() : null
    const recordCall = async (p: string, callId: string) => {
      if (!admin || !campaignId || !callId) return
      await admin.from('ivr_calls').insert({
        user_id: user.id, campaign_id: campaignId, phone: p,
        provider: 'bird', provider_call_id: callId, status: 'dialing',
      })
    }

    // ── Single call ───────────────────────────────────────────────────────────
    if (action === 'call') {
      if (!phone) return NextResponse.json({ error: '請提供電話號碼' }, { status: 400 })
      const audioUrl = await elevenLabsTTS(script, voiceId, modelId, supabase, user.id)
      const result = await birdCall(phone, audioUrl, birdCallerId, collectDtmf)
      await recordCall(phone, result.callId)
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
          const r = await birdCall(p, audioUrl, birdCallerId, collectDtmf)
          await recordCall(p, r.callId)
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
