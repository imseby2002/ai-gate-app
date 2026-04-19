/**
 * POST /api/marketing/generate-video
 * 提交影片生成任務至 FAL AI Queue
 *
 * Body: {
 *   prompt: string
 *   scriptId: number
 *   model: 'kling-standard' | 'kling-pro' | 'kling-img2video'
 *   duration: '5' | '10'
 *   aspectRatio: '16:9' | '9:16' | '1:1'
 *   imageUrl?: string        // image-to-video 時使用
 * }
 *
 * GET /api/marketing/generate-video?requestId=xxx&model=xxx
 * 查詢任務狀態，完成後上傳 Supabase Storage 回傳永久 URL
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'


const FAL_ENDPOINTS: Record<string, string> = {
  'kling-standard':  'fal-ai/kling-video/v1.6/standard/text-to-video',
  'kling-pro':       'fal-ai/kling-video/v1.6/pro/text-to-video',
  'kling-img2video': 'fal-ai/kling-video/v1.6/standard/image-to-video',
}

// ── POST: 提交任務 ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    prompt,
    scriptId = 0,
    model = 'kling-standard',
    duration = '5',
    aspectRatio = '16:9',
    imageUrl,
  } = body

  if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt 不可為空' }, { status: 400 })

  const apiKey = process.env.FAL_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })

  const endpoint = FAL_ENDPOINTS[model]
  if (!endpoint) return NextResponse.json({ error: '不支援的模型' }, { status: 400 })

  const payload: Record<string, unknown> = {
    prompt: prompt.trim(),
    duration,
    aspect_ratio: aspectRatio,
  }
  if (model === 'kling-img2video' && imageUrl) {
    payload.image_url = imageUrl
  }

  const res = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: err?.detail ?? '提交失敗' }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({
    requestId: data.request_id,
    model,
    scriptId,
    endpoint,
    submittedAt: new Date().toISOString(),
  })
}

// ── GET: 查詢狀態 ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const requestId = searchParams.get('requestId')
  const model = searchParams.get('model') ?? 'kling-standard'
  const scriptId = Number(searchParams.get('scriptId') ?? '0')

  if (!requestId) return NextResponse.json({ error: 'requestId 必填' }, { status: 400 })

  const apiKey = process.env.FAL_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })

  const endpoint = FAL_ENDPOINTS[model]

  // Check status
  const statusRes = await fetch(
    `https://queue.fal.run/${endpoint}/requests/${requestId}/status`,
    { headers: { Authorization: `Key ${apiKey}` } }
  )
  if (!statusRes.ok) {
    return NextResponse.json({ status: 'error', error: '狀態查詢失敗' }, { status: 500 })
  }

  const statusData = await statusRes.json()
  const falStatus: string = statusData.status ?? 'IN_QUEUE'

  // Still processing
  if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
    return NextResponse.json({ status: 'processing', falStatus })
  }

  if (falStatus === 'FAILED') {
    return NextResponse.json({ status: 'failed', error: statusData.error ?? '生成失敗' })
  }

  // Completed — fetch result
  const resultRes = await fetch(
    `https://queue.fal.run/${endpoint}/requests/${requestId}`,
    { headers: { Authorization: `Key ${apiKey}` } }
  )
  if (!resultRes.ok) {
    return NextResponse.json({ status: 'error', error: '無法取得結果' }, { status: 500 })
  }

  const result = await resultRes.json()
  const tempVideoUrl: string = result?.video?.url ?? result?.videos?.[0]?.url ?? ''

  if (!tempVideoUrl) {
    return NextResponse.json({ status: 'error', error: '未收到影片 URL' }, { status: 500 })
  }

  // Upload to Supabase Storage
  const vidRes = await fetch(tempVideoUrl)
  if (!vidRes.ok) return NextResponse.json({ status: 'error', error: '無法下載影片' }, { status: 500 })

  const vidBuffer = await vidRes.arrayBuffer()
  const fileName = `${user.id}/video-${model}-${scriptId}-${Date.now()}.mp4`

  const { error: uploadError } = await supabase.storage
    .from('marketing-assets')
    .upload(fileName, vidBuffer, { contentType: 'video/mp4', upsert: false })

  if (uploadError) {
    return NextResponse.json({ status: 'error', error: `Storage 上傳失敗：${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('marketing-assets').getPublicUrl(fileName)

  return NextResponse.json({
    status: 'completed',
    url: publicUrl,
    requestId,
    model,
    scriptId,
    generatedAt: new Date().toISOString(),
  })
}
