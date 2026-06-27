/**
 * POST /api/marketing/ai-studio
 * ComfyUI-inspired pipeline node executor
 *
 * Body: {
 *   type: 'edit' | 'style' | 'enhance' | 'bg-remove' | 'inpaint'
 *   imageUrl: string
 *   prompt?: string
 *   strength?: number
 *   stylePreset?: string
 *   maskDataUrl?: string           (inpaint: base64 PNG mask)
 *   referenceImageBase64?: string  (inpaint: reference image base64)
 *   referenceImageMimeType?: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import zlib from 'node:zlib'

const FAL_BASE = 'https://fal.run'

/**
 * Decode a canvas-produced PNG (8-bit RGBA, filter method 0) and report how many
 * pixels are "white" (the inpaint region). Used to catch all-black / empty masks
 * before wasting a generation, and to log dimension info for debugging.
 */
function inspectMaskPng(buf: Buffer): { w: number; h: number; white: number; total: number } | null {
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) return null
  let w = 0, h = 0, bitDepth = 0, colorType = 0
  const idat: Buffer[] = []
  let p = 8
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    p += 12 + len
  }
  if (!w || !h || bitDepth !== 8) return null
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0
  if (!channels) return null
  let raw: Buffer
  try { raw = zlib.inflateSync(Buffer.concat(idat)) } catch { return null }
  const stride = w * channels
  const out = Buffer.alloc(stride * h)
  const paeth = (a: number, b: number, c: number) => {
    const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  let sp = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[sp++]
    for (let x = 0; x < stride; x++) {
      const rawV = raw[sp++]
      const a = x >= channels ? out[y * stride + x - channels] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
      let v = rawV
      if (filter === 1) v = rawV + a
      else if (filter === 2) v = rawV + b
      else if (filter === 3) v = rawV + ((a + b) >> 1)
      else if (filter === 4) v = rawV + paeth(a, b, c)
      out[y * stride + x] = v & 0xff
    }
  }
  let white = 0
  const total = w * h
  for (let i = 0; i < total; i++) {
    if (out[i * channels] > 200) white++
  }
  return { w, h, white, total }
}

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

/**
 * FLUX models (Kontext / Fill) understand English far better than other languages.
 * Use Claude to turn the user's instruction (often Chinese) into a precise English
 * editing instruction, explicitly preserving whatever the user said to keep unchanged.
 * Falls back to the raw text if anything fails.
 */
async function toEnglishEditInstruction(
  userText: string,
  kind: 'kontext' | 'inpaint',
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return userText
  // Skip if it's already plain English (no non-Latin / accented characters beyond basic ASCII)
  const hasNonEnglish = [...userText].some(ch => ch.charCodeAt(0) > 0x00bf)
  if (!hasNonEnglish) return userText

  const guide = kind === 'kontext'
    ? 'Rewrite the user\'s request as ONE concise English instruction for an instruction-based image editor (FLUX Kontext). Describe exactly what to change AND explicitly state what must stay identical (e.g. "keep the logo, text and layout exactly unchanged"). Output only the instruction, no quotes, no preamble.'
    : 'The user is inpainting a masked region of an image (e.g. a storefront signboard panel). Rewrite their request as a CONCRETE, visually specific English phrase describing what the masked region should become — always include a concrete material, color, finish and texture so an image model has something definite to render. If the user is vague (e.g. "a different material", "change the panel"), COMMIT to one specific realistic material that suits the context and describe it concretely, e.g. "a brushed dark-grey metal panel with subtle horizontal grain" or "polished black marble with white veining". Never output vague words like "different material". Do not mention anything outside the region. Output only the phrase, no quotes, no preamble.'

  try {
    const anthropic = createAnthropic({ apiKey: anthropicKey })
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      messages: [{ role: 'user', content: `${guide}\n\nUser request: ${userText}` }],
      maxOutputTokens: 200,
    })
    return text.trim() || userText
  } catch {
    return userText
  }
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
  const {
    type, imageUrl, prompt = '', strength = 0.75, stylePreset,
    maskDataUrl, referenceImageBase64, referenceImageMimeType,
    sourceBCropBase64, sourceBMimeType,
  } = body

  if (!imageUrl?.trim()) return NextResponse.json({ error: '缺少 imageUrl' }, { status: 400 })

  // ── AI 建議：使用者沒方向時，讓 Claude 看圖提一個具體可套用的修改建議 ──
  if (type === 'suggest') {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
    try {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) return NextResponse.json({ error: '無法讀取圖片' }, { status: 400 })
      const mt = (imgRes.headers.get('content-type') ?? 'image/jpeg').split(';')[0]
      const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mt) ? mt : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')

      const isInpaint = body.mode === 'inpaint'
      const ask = isInpaint
        ? '使用者會用遮罩塗抹這張圖的某個區域（通常是招牌背板之類）做局部替換，但沒有想法。請看圖後，提出一個「具體、有品味、適合這個場景」的材質或外觀建議，只描述那塊區域可以換成什麼（含材質、顏色、質感），例如「深胡桃木色實木直紋，霧面質感」。'
        : '使用者想用 AI 修改這張圖但沒有方向。請看圖後，提出一個「具體、有品味、能提升整體質感」的修改建議，明確說要改什麼、並保留招牌 LOGO 與文字，例如「把招牌背板換成深灰色拉絲金屬，保留 LOGO 與店名文字」。'

      const { text } = await generateText({
        model: createAnthropic({ apiKey: anthropicKey })('claude-sonnet-4-6'),
        messages: [{
          role: 'user',
          content: [
            { type: 'image', image: b64, mediaType },
            { type: 'text', text: `${ask}\n\n用繁體中文輸出一句建議即可，不要前言、不要選項、不要引號。` },
          ],
        }],
        maxOutputTokens: 150,
      })
      const suggestion = text.trim()
      if (!suggestion) return NextResponse.json({ error: 'AI 無法產生建議，請再試一次' }, { status: 502 })
      return NextResponse.json({ suggestion })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  let tempUrl = ''
  let cost = 0.05

  try {
    if (type === 'inpaint') {
      if (!maskDataUrl) return NextResponse.json({ error: '缺少遮罩圖' }, { status: 400 })

      // Resolve the final prompt: text, reference image via Claude Vision, or both
      let finalPrompt = prompt?.trim() ?? ''

      if (referenceImageBase64) {
        const anthropicKey = process.env.ANTHROPIC_API_KEY
        if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })

        const anthropic = createAnthropic({ apiKey: anthropicKey })
        const mimeType = (referenceImageMimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

        const { text: refDescription } = await generateText({
          model: anthropic('claude-sonnet-4-6'),
          messages: [{
            role: 'user',
            content: [
              { type: 'image', image: referenceImageBase64, mediaType: mimeType },
              {
                type: 'text',
                text: 'Describe this reference image in detail as a prompt for AI image inpainting. Focus on: visual style, colors, textures, lighting, key elements, composition. Be specific. Output only the visual description, no preamble.',
              },
            ],
          }],
          maxOutputTokens: 200,
        })

        // Combine reference description with any additional text from user
        finalPrompt = finalPrompt
          ? `${refDescription.trim()}, ${finalPrompt}`
          : refDescription.trim()
        cost += 0.01 // small Claude cost
      }

      if (!finalPrompt) return NextResponse.json({ error: '請提供文字描述或參考圖片' }, { status: 400 })

      // FLUX Fill understands English best — translate the masked-region description
      finalPrompt = await toEnglishEditInstruction(finalPrompt, 'inpaint')

      // Upload mask to Supabase to get a permanent URL
      const maskBase64 = maskDataUrl.replace(/^data:image\/[^;]+;base64,/, '')
      const maskBuffer = Buffer.from(maskBase64, 'base64')

      // Guard: an all-black (empty) mask makes FLUX Fill return the image unchanged.
      const maskInfo = inspectMaskPng(maskBuffer)
      console.log('[ai-studio inpaint] mask', maskInfo, 'finalPrompt:', finalPrompt)
      if (maskInfo && maskInfo.white === 0) {
        return NextResponse.json({ error: '未偵測到塗抹區域（遮罩是空白的），請在圖片上塗抹要修改的範圍後再試。' }, { status: 422 })
      }

      const maskFileName = `${user.id}/mask-${Date.now()}.png`

      const { error: maskUploadError } = await supabase.storage
        .from('marketing-assets')
        .upload(maskFileName, maskBuffer, { contentType: 'image/png', upsert: false })

      if (maskUploadError) {
        return NextResponse.json({ error: `Mask 上傳失敗：${maskUploadError.message}` }, { status: 500 })
      }
      const { data: { publicUrl: maskUrl } } = supabase.storage.from('marketing-assets').getPublicUrl(maskFileName)

      // FLUX Pro Fill (inpainting)
      const data = await falPost('fal-ai/flux-pro/v1/fill', {
        image_url: imageUrl,
        mask_url: maskUrl,
        prompt: finalPrompt,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
      }, apiKey)
      tempUrl = data?.images?.[0]?.url ?? ''
      cost += 0.08

    } else if (type === 'composite') {
      if (!maskDataUrl) return NextResponse.json({ error: '缺少主圖遮罩' }, { status: 400 })
      if (!sourceBCropBase64) return NextResponse.json({ error: '缺少來源圖裁切' }, { status: 400 })

      // Use Claude Vision to describe the B crop
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })

      const anthropic = createAnthropic({ apiKey: anthropicKey })
      const bMimeType = (sourceBMimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

      const { text: bDescription } = await generateText({
        model: anthropic('claude-sonnet-4-6'),
        messages: [{
          role: 'user',
          content: [
            { type: 'image', image: sourceBCropBase64, mediaType: bMimeType },
            {
              type: 'text',
              text: 'Describe this image region in detail for AI inpainting: visual style, colors, textures, lighting, shapes, composition. Be specific and visual. Output only the description, no preamble.',
            },
          ],
        }],
        maxOutputTokens: 200,
      })

      const finalPrompt = prompt?.trim()
        ? `${bDescription.trim()}, ${prompt.trim()}`
        : bDescription.trim()

      cost += 0.01

      // Upload A's mask to Supabase
      const maskBase64 = maskDataUrl.replace(/^data:image\/[^;]+;base64,/, '')
      const maskBuffer = Buffer.from(maskBase64, 'base64')
      const maskFileName = `${user.id}/mask-composite-${Date.now()}.png`

      const { error: maskUploadError } = await supabase.storage
        .from('marketing-assets')
        .upload(maskFileName, maskBuffer, { contentType: 'image/png', upsert: false })

      if (maskUploadError) {
        return NextResponse.json({ error: `Mask 上傳失敗：${maskUploadError.message}` }, { status: 500 })
      }
      const { data: { publicUrl: maskUrl } } = supabase.storage.from('marketing-assets').getPublicUrl(maskFileName)

      // FLUX Pro Fill: paste B's content into A's masked area
      const data = await falPost('fal-ai/flux-pro/v1/fill', {
        image_url: imageUrl,
        mask_url: maskUrl,
        prompt: finalPrompt,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
      }, apiKey)
      tempUrl = data?.images?.[0]?.url ?? ''
      cost += 0.08

    } else if (type === 'edit') {
      // FLUX.1 Kontext — instruction-based editing (keeps the rest of the image,
      // only changes what the prompt asks for; e.g. "change the signboard backing, keep the logo")
      if (!prompt.trim()) return NextResponse.json({ error: '請描述要修改的內容' }, { status: 400 })
      const editInstruction = await toEnglishEditInstruction(prompt.trim(), 'kontext')
      const data = await falPost('fal-ai/flux-pro/kontext', {
        image_url: imageUrl,
        prompt: editInstruction,
        guidance_scale: 3.5,
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '2',
      }, apiKey)
      tempUrl = data?.images?.[0]?.url ?? ''
      cost = 0.08

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
