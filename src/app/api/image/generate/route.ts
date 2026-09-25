import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyBillingContext } from '@/lib/company/entitlements'
import { checkEnterpriseCostAlert } from '@/lib/company/enterprise'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // CHAT 不提供生圖／影片給一般付費客戶（成本高且不扣點）；內部帳號（admin／employee）與
  // 專屬客製-企業版可用，企業版用量計入成本警示
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  const companyCtx = profile?.user_type === 'external' ? await getCompanyBillingContext(user.id) : null
  if (!profile || (profile.user_type === 'external' && !companyCtx?.enterprise)) {
    return NextResponse.json({ error: '此功能未開放，請改用行銷中心的圖片／影片產出' }, { status: 403 })
  }

  const { prompt, model, aspectRatio = '1:1' } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

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
    if (companyCtx?.enterprise) void checkEnterpriseCostAlert(companyCtx.companyId)

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
