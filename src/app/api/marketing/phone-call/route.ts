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
import { getTelephonyProvider } from '@/lib/telephony'
import { TTS_COST, CALL_COST, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

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

  // 電話撥打：行銷自動化（aiCallEmail）或潛在客戶行銷全開（prospectMarketing full）擇一即可
  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.aiCallEmail && features.prospectMarketing !== 'full') {
    return NextResponse.json({ error: '目前方案未開放電話撥打，請升級至 TEAM 以上', plan }, { status: 403 })
  }

  // 執行前餘額檢查：TTS 一次 + 依撥打通數估算；實際依成功數扣點
  const billable = await isBillableUser(user.id)
  const phoneCount = action === 'batch' ? (phones as string[]).filter((p) => p?.trim()).length
    : action === 'call' ? 1 : 0
  const estimate = TTS_COST + CALL_COST * phoneCount
  const check = await checkCredits(user.id, estimate, billable)
  if (!check.ok) return NextResponse.json(check.payload, { status: 402 })

  const mappings: KeyMapping[] = Array.isArray(keyMappings) ? keyMappings : []
  const collectDtmf = mappings.some((m) => m?.digit && m?.join_url)

  const provider = getTelephonyProvider()  // Bird / Stringee（依 TELEPHONY_PROVIDER）

  try {
    // ── TTS only ─────────────────────────────────────────────────────────────
    if (action === 'tts') {
      const audioUrl = await elevenLabsTTS(script, voiceId, modelId, supabase, user.id)
      await deductCredits(user.id, TTS_COST, '[marketing] 電話行銷 TTS 試聽', billable)
      return NextResponse.json({ audioUrl, provider: 'ElevenLabs' })
    }

    // 有按鍵加入社群設定 → 建立/更新活動，撥打後記錄通話供 webhook 對應
    const campaignId = collectDtmf ? await ensureIvrCampaign(supabase, user.id, mappings) : null
    const admin = campaignId ? await createAdminClient() : null
    const recordCall = async (p: string, callId: string | null) => {
      if (!admin || !campaignId || !callId) return
      await admin.from('ivr_calls').insert({
        user_id: user.id, campaign_id: campaignId, phone: p,
        provider: provider.name, provider_call_id: callId, status: 'dialing',
      })
    }

    // ── Single call ───────────────────────────────────────────────────────────
    if (action === 'call') {
      if (!phone) return NextResponse.json({ error: '請提供電話號碼' }, { status: 400 })
      const audioUrl = await elevenLabsTTS(script, voiceId, modelId, supabase, user.id)
      const result = await provider.call({ phone, audioUrl, callerId: birdCallerId, collectDtmf })
      await recordCall(phone, result.callId)
      await deductCredits(user.id, TTS_COST + CALL_COST, '[marketing] 電話行銷撥打 1 通', billable)
      return NextResponse.json({ ok: true, phone, callId: result.callId, audioUrl, provider: provider.name })
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
          const r = await provider.call({ phone: p, audioUrl, callerId: birdCallerId, collectDtmf })
          await recordCall(p, r.callId)
          results.push({ phone: p, ok: true, id: r.callId ?? undefined })
        } catch (e) {
          results.push({ phone: p, ok: false, error: String(e) })
        }
        await new Promise(r => setTimeout(r, 600))
      }

      const successCount = results.filter(r => r.ok).length
      await deductCredits(
        user.id,
        TTS_COST + CALL_COST * successCount,
        `[marketing] 電話行銷批次撥打 ${successCount} 通`,
        billable,
      )

      return NextResponse.json({
        results,
        audioUrl,
        total: list.length,
        success: successCount,
        provider: provider.name,
      })
    }

    return NextResponse.json({ error: '不支援的 action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
