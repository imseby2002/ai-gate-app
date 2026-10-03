import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements, planRequiredResponse } from '@/lib/module-plans/entitlements'
import { minPlanLabel } from '@/lib/module-plans/definitions'
import { getBalance, deductCredits } from '@/lib/skills/billing'
import { IMAGE_COSTS } from '@/lib/marketing/billing'
import { generateNanoBanana } from '@/lib/ai/nano-banana'
import { generateIdeogram } from '@/lib/ai/ideogram'

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

  try {
    let imageUrl: string

    if (model === 'flux-1-pro' || model === 'nano-banana') {
      // 文字生圖統一使用 Nano Banana Pro（FLUX 僅用於修圖）
      imageUrl = await generateNanoBanana({ prompt, aspectRatio })
    } else if (model === 'ideogram') {
      imageUrl = await generateIdeogram({ prompt, aspectRatio })
    } else {
      return NextResponse.json({ error: 'Unknown model' }, { status: 400 })
    }

    if (!imageUrl) throw new Error('No image URL returned')

    // Track usage
    void supabase.from('messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: `[圖片生成] ${prompt}`,
      model_id: model,
      cost_usd: price,
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
