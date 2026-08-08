/**
 * POST /api/marketing/generate-image
 * 圖片產出單元 — 支援 DALL-E 3 / FLUX.1 Pro / Nano Banana
 *
 * Body: {
 *   prompt: string
 *   scriptId: number
 *   model?: 'dalle3' | 'flux' | 'nano'   (default: 'flux')
 *   size?: '1:1' | '9:16' | '16:9'
 *   quality?: 'standard' | 'hd'          (DALL-E 3 only)
 *   style?: 'vivid' | 'natural'          (DALL-E 3 only)
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IMAGE_COSTS, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

// Size mapping per provider
const DALLE_SIZES: Record<string, string> = {
  '1:1':  '1024x1024',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
}
const FAL_SIZES: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '9:16': { width: 768,  height: 1344 },
  '16:9': { width: 1344, height: 768  },
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    prompt,
    scriptId = 0,
    model = 'flux',
    size = '1:1',
    quality = 'standard',
    style = 'vivid',
  } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt 不可為空' }, { status: 400 })
  }

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.imageGen) {
    return NextResponse.json({ error: '目前方案未開放圖片產出，請升級至 PRO 以上', plan }, { status: 403 })
  }

  const cost = IMAGE_COSTS[model] ?? 0.05
  const billable = await isBillableUser(user.id)
  const check = await checkCredits(user.id, cost, billable)
  if (!check.ok) return NextResponse.json(check.payload, { status: 402 })

  let tempUrl = ''
  let revisedPrompt = prompt

  // ── DALL-E 3 ────────────────────────────────────────────────────────────────
  if (model === 'dalle3') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY 未設定' }, { status: 500 })

    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.trim(),
        n: 1,
        size: DALLE_SIZES[size] ?? '1024x1024',
        quality,
        style,
        response_format: 'url',
      }),
    })
    if (!dalleRes.ok) {
      const err = await dalleRes.json().catch(() => ({}))
      return NextResponse.json({ error: err?.error?.message ?? 'DALL-E 生成失敗' }, { status: 500 })
    }
    const dalleData = await dalleRes.json()
    tempUrl = dalleData?.data?.[0]?.url ?? ''
    revisedPrompt = dalleData?.data?.[0]?.revised_prompt ?? prompt

  // ── FLUX.1 Pro ──────────────────────────────────────────────────────────────
  } else if (model === 'flux') {
    const apiKey = process.env.FAL_AI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })

    const falRes = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.trim(),
        image_size: FAL_SIZES[size] ?? { width: 1024, height: 1024 },
        num_inference_steps: 28,
        num_images: 1,
      }),
    })
    if (!falRes.ok) {
      const err = await falRes.json().catch(() => ({}))
      const d = err?.detail
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: {msg?: string}) => e.msg ?? JSON.stringify(e)).join('; ') : 'FLUX 生成失敗'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const falData = await falRes.json()
    tempUrl = falData?.images?.[0]?.url ?? ''

  // ── Nano Banana (Fast SDXL) ─────────────────────────────────────────────────
  } else if (model === 'nano') {
    const apiKey = process.env.FAL_AI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })

    const falRes = await fetch('https://fal.run/fal-ai/fast-sdxl', {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt.trim(),
        image_size: FAL_SIZES[size] ?? { width: 1024, height: 1024 },
        num_images: 1,
      }),
    })
    if (!falRes.ok) {
      const err = await falRes.json().catch(() => ({}))
      const d = err?.detail
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: {msg?: string}) => e.msg ?? JSON.stringify(e)).join('; ') : 'Nano Banana 生成失敗'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const falData = await falRes.json()
    tempUrl = falData?.images?.[0]?.url ?? ''

  } else {
    return NextResponse.json({ error: '不支援的模型' }, { status: 400 })
  }

  if (!tempUrl) return NextResponse.json({ error: '未收到圖片 URL' }, { status: 500 })

  // ── 上傳至 Supabase Storage（永久 URL）──────────────────────────────────────
  const imgRes = await fetch(tempUrl)
  if (!imgRes.ok) return NextResponse.json({ error: '無法下載生成圖片' }, { status: 500 })

  const imgBuffer = await imgRes.arrayBuffer()
  const fileName = `${user.id}/img-${model}-${scriptId}-${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('marketing-assets')
    .upload(fileName, imgBuffer, { contentType: 'image/png', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Storage 上傳失敗：${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('marketing-assets').getPublicUrl(fileName)

  const deduct = await deductCredits(user.id, cost, `[marketing] 圖片生成 ${model}`, billable)

  return NextResponse.json({
    url: publicUrl,
    revisedPrompt,
    scriptId,
    model,
    size,
    quality,
    style,
    cost,
    balance: deduct.ok ? deduct.balance : undefined,
    generatedAt: new Date().toISOString(),
  })
}
