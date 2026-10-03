// Nano Banana Pro（Google Gemini 圖像模型，經 fal.ai）：文字生圖與參考圖重新設計共用
// FLUX 僅保留給修圖類節點（局部重繪、Kontext 修改、去背、放大等）

const SUPPORTED_ASPECTS = ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'] as const
type BananaAspect = (typeof SUPPORTED_ASPECTS)[number]

function toAspect(aspectRatio?: string): BananaAspect {
  return (SUPPORTED_ASPECTS as readonly string[]).includes(aspectRatio ?? '') ? (aspectRatio as BananaAspect) : '1:1'
}

export async function generateNanoBanana({
  prompt,
  aspectRatio,
  imageUrls,
}: {
  prompt: string
  aspectRatio?: string
  imageUrls?: string[]
}): Promise<string> {
  const apiKey = process.env.FAL_AI_API_KEY
  if (!apiKey) throw new Error('FAL_AI_API_KEY 未設定')

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
