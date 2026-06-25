/**
 * POST /api/marketing/ai-studio
 * ComfyUI-inspired pipeline node executor
 *
 * Body: {
 *   type: 'edit' | 'style' | 'enhance' | 'bg-remove'
 *   imageUrl: string        (input image URL)
 *   prompt?: string         (for edit/style)
 *   strength?: number       (0.1–1.0, default 0.75)
 *   stylePreset?: string    (watercolor|anime|illustration|cinematic|realistic)
 * }
 *
 * Returns: { url: string, cost: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FAL_BASE = 'https://fal.run'

const STYLE_PROMPTS: Record<string, string> = {
  watercolor:    'watercolor painting style, soft washes, paper texture, artistic',
  anime:         'anime style, cel shaded, vibrant colors, clean lines, Japanese animation',
  illustration:  'digital illustration style, vector art, flat colors, modern design',
  cinematic:     'cinematic photography, movie still, dramatic lighting, film grain, 4K',
  realistic:     'photorealistic, ultra detailed, sharp focus, professional photography',
  oilpainting:   'oil painting style, impasto texture, rich colors, classical art',
  sketch:        'pencil sketch, hand drawn, fine lines, monochrome',
  cyberpunk:     'cyberpunk style, neon lights, futuristic, dark urban, retrofuturistic',
}

async function falPost(endpoint: string, body: Record<string, unknown>, apiKey: string) {
  const res = await fetch(`${FAL_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const d = err?.detail
    const msg = typeof d === 'string' ? d
      : Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ')
      : err?.message ?? `fal.ai 請求失敗 (${res.status})`
    throw new Error(msg)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.FAL_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })

  const body = await req.json()
  const { type, imageUrl, prompt = '', strength = 0.75, stylePreset } = body

  if (!imageUrl?.trim()) return NextResponse.json({ error: '缺少 imageUrl' }, { status: 400 })

  let tempUrl = ''
  let cost = 0.05

  try {
    if (type === 'edit') {
      // FLUX dev image-to-image
      const data = await falPost('fal-ai/flux/dev/image-to-image', {
        image_url: imageUrl,
        prompt: prompt.trim() || 'enhance and improve the image quality',
        strength,
        num_inference_steps: 28,
        num_images: 1,
      }, apiKey)
      tempUrl = data?.images?.[0]?.url ?? ''
      cost = 0.06

    } else if (type === 'style') {
      const stylePrompt = STYLE_PROMPTS[stylePreset ?? 'realistic'] ?? STYLE_PROMPTS.realistic
      const fullPrompt = prompt ? `${prompt}, ${stylePrompt}` : stylePrompt
      const data = await falPost('fal-ai/flux/dev/image-to-image', {
        image_url: imageUrl,
        prompt: fullPrompt,
        strength,
        num_inference_steps: 28,
        num_images: 1,
      }, apiKey)
      tempUrl = data?.images?.[0]?.url ?? ''
      cost = 0.06

    } else if (type === 'enhance') {
      // Aura SR upscaling
      const data = await falPost('fal-ai/aura-sr', {
        image_url: imageUrl,
        upscaling_factor: 2,
        overlapping_tiles: true,
      }, apiKey)
      tempUrl = data?.image?.url ?? data?.url ?? ''
      cost = 0.04

    } else if (type === 'bg-remove') {
      // BiRefNet background removal
      const data = await falPost('fal-ai/birefnet', {
        image_url: imageUrl,
        model: 'General Use (Light)',
        operating_resolution: '1024x1024',
        output_format: 'png',
      }, apiKey)
      tempUrl = data?.image?.url ?? data?.url ?? ''
      cost = 0.02

    } else {
      return NextResponse.json({ error: '不支援的操作類型' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  if (!tempUrl) return NextResponse.json({ error: '未收到圖片 URL' }, { status: 500 })

  // Upload to Supabase Storage
  const imgRes = await fetch(tempUrl)
  if (!imgRes.ok) return NextResponse.json({ error: '無法下載生成圖片' }, { status: 500 })

  const imgBuffer = await imgRes.arrayBuffer()
  const ext = type === 'bg-remove' ? 'png' : 'jpg'
  const fileName = `${user.id}/studio-${type}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('marketing-assets')
    .upload(fileName, imgBuffer, {
      contentType: type === 'bg-remove' ? 'image/png' : 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Storage 上傳失敗：${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('marketing-assets').getPublicUrl(fileName)

  return NextResponse.json({ url: publicUrl, cost, type, generatedAt: new Date().toISOString() })
}
