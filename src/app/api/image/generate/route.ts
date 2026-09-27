import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements, planRequiredResponse } from '@/lib/module-plans/entitlements'
import { minPlanLabel } from '@/lib/module-plans/definitions'
import { getBalance, deductCredits } from '@/lib/skills/billing'
import { IMAGE_COSTS } from '@/lib/marketing/billing'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 畫圖依 AI 對話方案開放（lib/module-plans/definitions.ts）；付費客戶依 lib/marketing/billing.ts 的價格扣點
  // （專屬客製-企業版由 deductCredits 記錄用量並檢查成本警示）。內部帳號（admin／employee）不計費。
  const { data: profile } = await supabase.from('profiles').select('user_type, is_active').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.is_active === false) return NextResponse.json({ error: '帳號已停用' }, { status: 403 })
  const billable = profile.user_type === 'external'
  if (billable) {
    const ent = await getModuleEntitlements(user.id, 'chat')
    if (!ent.features.imageGen) {
      return planRequiredResponse(`畫圖需 AI 對話 ${minPlanLabel('chat', f => f.imageGen)}方案`, ent.plan)
    }
  }

  const { prompt, model, aspectRatio = '1:1' } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  const price = IMAGE_COSTS[model] ?? 0.05
  if (billable && (await getBalance(user.id)) < price) {
    return NextResponse.json({ error: '點數不足', required: price }, { status: 402 })
  }

  const imageSizes: Record<string, { width: number; height: number }> = {
    '1:1':  { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768  },
    '9:16': { width: 768,  height: 1344 },
    '4:3':  { width: 1152, height: 864  },
    '3:4':  { width: 864,  height: 1152 },
  }

  try {
    let imageUrl: string

    if (model === 'flux-1-pro') {
      // FAL AI - FLUX.1 Pro
      const res = await fetch('https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.FAL_AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_size: imageSizes[aspectRatio] ?? { width: 1024, height: 1024 },
          num_inference_steps: 28,
          num_images: 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const d = data.detail
        throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: {msg?: string}) => e.msg ?? JSON.stringify(e)).join('; ') : JSON.stringify(data))
      }
      imageUrl = data.images?.[0]?.url

    } else if (model === 'nano-banana') {
      // FAL AI - Fast SDXL (Nano Banana equivalent)
      const res = await fetch('https://fal.run/fal-ai/fast-sdxl', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.FAL_AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_size: imageSizes[aspectRatio] ?? { width: 1024, height: 1024 },
          num_images: 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const d = data.detail
        throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: {msg?: string}) => e.msg ?? JSON.stringify(e)).join('; ') : JSON.stringify(data))
      }
      imageUrl = data.images?.[0]?.url

    } else {
      return NextResponse.json({ error: 'Unknown model' }, { status: 400 })
    }

    if (!imageUrl) throw new Error('No image URL returned')

    // Track usage
    const costPerImage = model === 'flux-1-pro' ? 0.05 : 0.02
    void supabase.from('messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: `[圖片生成] ${prompt}`,
      model_id: model,
      cost_usd: costPerImage,
      image_urls: [imageUrl],
    })
    if (billable) {
      const deduct = await deductCredits(user.id, price, `[chat] 圖片生成:${model}`)
      if (!deduct.ok) console.error('[image/generate] 扣點失敗', { userId: user.id, model, reason: deduct.reason })
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
