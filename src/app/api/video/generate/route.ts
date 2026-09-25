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

  const { prompt, model, duration = 5 } = await req.json()
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
    if (companyCtx?.enterprise) void checkEnterpriseCostAlert(companyCtx.companyId)

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
