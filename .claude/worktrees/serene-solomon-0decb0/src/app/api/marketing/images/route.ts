import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { copy, companyName, model = 'flux-1-pro', count = 3 } = await req.json()
  if (!copy) return NextResponse.json({ error: 'copy required' }, { status: 400 })

  // ── 1. GPT-4o-mini（via OpenRouter）產生圖片提示詞 ────────────────
  const openrouter = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://ai-gate-app-gamma.vercel.app',
      'X-Title': 'AI GATE',
    },
  })

  const { text: promptsText } = await generateText({
    model: openrouter.chat('openai/gpt-4o-mini'),
    messages: [
      {
        role: 'system',
        content: 'You are an expert at writing image generation prompts for marketing visuals. Output only the prompts, nothing else.',
      },
      {
        role: 'user',
        content: `Generate ${count} distinct image generation prompts for marketing visuals based on this marketing copy:

Company: ${companyName ?? 'Brand'}
Marketing copy: ${copy}

Requirements:
- Each prompt must describe a DIFFERENT visual style/scene:
  1. Product/service showcase (professional studio setting)
  2. Lifestyle scene (real people, emotional connection)
  3. Abstract/conceptual (bold colors, graphic design feel)
- Each prompt must be in English
- Include: lighting description, color palette, composition, mood
- End each with: "professional marketing photo, commercial photography, high resolution, 8k"
- Format: one prompt per line, starting with "PROMPT:"
- Keep each prompt under 100 words`,
      },
    ],
    maxOutputTokens: 800,
  })

  // Parse prompts
  const rawPrompts = promptsText
    .split('\n')
    .filter(l => l.trim().startsWith('PROMPT:'))
    .map(l => l.replace(/^PROMPT:\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, count)

  // Fallback
  if (rawPrompts.length === 0) {
    rawPrompts.push(
      `Professional product showcase for ${companyName ?? 'brand'}, clean white studio background, soft lighting, commercial photography, high resolution, 8k`,
      `Lifestyle marketing photo for ${companyName ?? 'brand'}, happy professionals in modern office, natural light, warm tones, professional marketing photo, 8k`,
      `Abstract brand concept for ${companyName ?? 'brand'}, bold gradient colors, geometric shapes, minimalist design, professional marketing photo, 8k`
    )
  }

  // ── 2. FAL AI 並行生成圖片 ────────────────────────────────────────
  const falEndpoint = model === 'nano-banana' ? 'fal-ai/fast-sdxl' : 'fal-ai/flux/dev'

  const results = await Promise.allSettled(
    rawPrompts.map(async (prompt) => {
      const res = await fetch(`https://fal.run/${falEndpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.FAL_AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_size: '1344x768',
          num_inference_steps: 28,
          num_images: 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Generation failed')
      return { url: data.images?.[0]?.url as string, prompt }
    })
  )

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<{ url: string; prompt: string }> =>
      r.status === 'fulfilled' && !!r.value.url
    )
    .map(r => r.value)

  if (succeeded.length === 0) {
    return NextResponse.json({ error: 'All image generations failed' }, { status: 500 })
  }

  const imageUrls = succeeded.map(s => s.url)
  const prompts = succeeded.map(s => s.prompt)

  const costPerImage = model === 'flux-1-pro' ? 0.05 : 0.02
  void supabase.from('messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: `[行銷圖片生成] ${imageUrls.length} 張`,
    model_id: model,
    cost_usd: imageUrls.length * costPerImage,
    image_urls: imageUrls,
  })

  return NextResponse.json({ imageUrls, prompts })
}
