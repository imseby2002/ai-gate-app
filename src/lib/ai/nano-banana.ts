// Nano Banana Pro（Gemini 3 Pro Image）：文字生圖與參考圖重新設計共用
// FLUX 僅保留給修圖類節點（局部重繪、Kontext 修改、去背、放大等）
//
// 成本：優先直連 Google Gemini API（GOOGLE_AI_API_KEY，1K/2K 每張約 $0.134），
// 未設定或失敗時改走 fal.ai（每張約 $0.15，參考圖每張另計約 $0.067）。
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { NANO_BANANA_PRO_GOOGLE_COST, NANO_BANANA_PRO_FAL_COST, NANO_BANANA_PRO_FAL_REF_IMAGE_COST } from '@/lib/marketing/billing'

const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const STORAGE_BUCKET = 'marketing-assets'

const SUPPORTED_ASPECTS = ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'] as const
type BananaAspect = (typeof SUPPORTED_ASPECTS)[number]

function toAspect(aspectRatio?: string): BananaAspect {
  return (SUPPORTED_ASPECTS as readonly string[]).includes(aspectRatio ?? '') ? (aspectRatio as BananaAspect) : '1:1'
}

type BananaInput = { prompt: string; aspectRatio?: string; imageUrls?: string[] }

// Google 直連：回傳的是圖片位元組，上傳至 Storage 取得公開 URL，呼叫端維持拿 URL 的介面
async function generateViaGoogle({ prompt, aspectRatio, imageUrls }: BananaInput, apiKey: string): Promise<string> {
  const google = createGoogleGenerativeAI({ apiKey })
  const { files } = await generateText({
    model: google(GEMINI_IMAGE_MODEL),
    abortSignal: AbortSignal.timeout(90000),
    messages: [{
      role: 'user',
      content: [
        ...(imageUrls ?? []).map(image => ({ type: 'image' as const, image })),
        { type: 'text' as const, text: prompt },
      ],
    }],
    providerOptions: {
      google: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: toAspect(aspectRatio), imageSize: '1K' },
      },
    },
  })

  const image = files.find(f => f.mediaType.startsWith('image/'))
  if (!image) throw new Error('Gemini 未回傳圖片')

  const ext = image.mediaType.includes('png') ? 'png' : 'jpg'
  const path = `nano-banana/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, Buffer.from(image.uint8Array), { contentType: image.mediaType, upsert: false })
  if (error) throw new Error(`圖片儲存失敗：${error.message}`)
  return admin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

async function generateViaFal({ prompt, aspectRatio, imageUrls }: BananaInput, apiKey: string): Promise<string> {
  const hasRefs = !!imageUrls?.length
  const res = await fetch(`https://fal.run/fal-ai/nano-banana-pro${hasRefs ? '/edit' : ''}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      ...(hasRefs ? { image_urls: imageUrls } : {}),
      aspect_ratio: toAspect(aspectRatio),
      num_images: 1,
      output_format: 'jpeg',
      resolution: '1K',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data?.detail
    const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ') : 'Nano Banana 生成失敗'
    throw new Error(msg)
  }
  const url = data?.images?.[0]?.url as string | undefined
  if (!url) throw new Error('Nano Banana 未回傳圖片')
  return url
}

/** 生成並回傳實際走的供應商成本（USD），供依實際成本扣點 */
export async function generateNanoBananaWithCost(input: BananaInput): Promise<{ url: string; costUsd: number }> {
  const googleKey = process.env.GOOGLE_AI_API_KEY
  const falKey = process.env.FAL_AI_API_KEY
  if (!googleKey && !falKey) throw new Error('GOOGLE_AI_API_KEY / FAL_AI_API_KEY 未設定')

  if (googleKey) {
    try {
      // 參考圖以 token 計，金額極小，未計入
      return { url: await generateViaGoogle(input, googleKey), costUsd: NANO_BANANA_PRO_GOOGLE_COST }
    } catch (e) {
      if (!falKey) throw e
      console.warn('[nano-banana] Google 直連失敗，改走 fal:', e)
    }
  }
  const refs = input.imageUrls?.length ?? 0
  return {
    url: await generateViaFal(input, falKey!),
    costUsd: NANO_BANANA_PRO_FAL_COST + refs * NANO_BANANA_PRO_FAL_REF_IMAGE_COST,
  }
}

export async function generateNanoBanana(input: BananaInput): Promise<string> {
  return (await generateNanoBananaWithCost(input)).url
}
