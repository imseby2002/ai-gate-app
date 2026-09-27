import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getModuleEntitlements, planRequiredResponse } from '@/lib/module-plans/entitlements'
import { minPlanLabel } from '@/lib/module-plans/definitions'
import { getBalance, deductCredits } from '@/lib/skills/billing'
import { videoCost } from '@/lib/marketing/billing'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 影片生成依 AI 對話方案開放（lib/module-plans/definitions.ts）；付費客戶依 lib/marketing/billing.ts 的價格扣點
  // （專屬客製-企業版由 deductCredits 記錄用量並檢查成本警示）。內部帳號（admin／employee）不計費。
  const { data: profile } = await supabase.from('profiles').select('user_type, is_active').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.is_active === false) return NextResponse.json({ error: '帳號已停用' }, { status: 403 })
  const billable = profile.user_type === 'external'
  if (billable) {
    const ent = await getModuleEntitlements(user.id, 'chat')
    if (!ent.features.videoGen) {
      return planRequiredResponse(`影片生成需 AI 對話 ${minPlanLabel('chat', f => f.videoGen)}方案`, ent.plan)
    }
  }

  const { prompt, model, duration = 5 } = await req.json()

  const price = videoCost(model === 'kling-v2' ? 'kling-standard' : model, Number(duration) || 5)
  if (billable && (await getBalance(user.id)) < price) {
    return NextResponse.json({ error: '點數不足', required: price }, { status: 402 })
  }
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  try {
    let videoUrl: string | null = null
    let jobId: string | null = null

    if (model === 'veo3') {
      // Google VEO3 API (when available)
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VEO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { aspectRatio: '16:9', durationSeconds: duration },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'VEO3 generation failed')
      jobId = data.name

    } else if (model === 'kling-v2') {
      // Kling API
      const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.KLING_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: 'kling-v2-master',
          prompt,
          duration: String(duration),
          aspect_ratio: '16:9',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Kling generation failed')
      jobId = data.data?.task_id

    } else {
      return NextResponse.json({ error: 'Unknown model' }, { status: 400 })
    }

    const costPerSec = model === 'veo3' ? 0.15 : 0.10
    const estimatedCost = duration * costPerSec

    // Track usage start
    void supabase.from('messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: `[影片生成] ${prompt}`,
      model_id: model,
      cost_usd: estimatedCost,
    })
    if (billable) {
      const deduct = await deductCredits(user.id, price, `[chat] 影片生成:${model}`)
      if (!deduct.ok) console.error('[video/generate] 扣點失敗', { userId: user.id, model, reason: deduct.reason })
    }

    return NextResponse.json({
      jobId,
      videoUrl,
      status: videoUrl ? 'done' : 'pending',
      message: '影片正在生成中，通常需要 1-3 分鐘',
    })
  } catch (error) {
    console.error('Video generation error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
