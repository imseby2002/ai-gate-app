// Ideogram v3（經 fal.ai）：文字生圖，文字排版能力強，作為 Nano Banana Pro 的低成本替代實測
// 成本：BALANCED 每張約 $0.06（TURBO $0.03、QUALITY $0.09）
// 注意：image_urls 在 Ideogram 只作為「風格參考」，不會保留原圖主體，有參考圖時仍應走 Nano Banana Pro

const IMAGE_SIZES: Record<string, string> = {
  '1:1': 'square_hd',
  '3:4': 'portrait_4_3',
  '4:5': 'portrait_4_3',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '16:9': 'landscape_16_9',
}

export async function generateIdeogram({
  prompt,
  aspectRatio,
  negativePrompt,
}: {
  prompt: string
  aspectRatio?: string
  negativePrompt?: string
}): Promise<string> {
  const apiKey = process.env.FAL_AI_API_KEY
  if (!apiKey) throw new Error('FAL_AI_API_KEY 未設定')

  const res = await fetch('https://fal.run/fal-ai/ideogram/v3', {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: IMAGE_SIZES[aspectRatio ?? ''] ?? 'square_hd',
      rendering_speed: 'BALANCED',
      num_images: 1,
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data?.detail
    const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ') : 'Ideogram 生成失敗'
    throw new Error(msg)
  }
  const url = data?.images?.[0]?.url as string | undefined
  if (!url) throw new Error('Ideogram 未回傳圖片')
  return url
}
