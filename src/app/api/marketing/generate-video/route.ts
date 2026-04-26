/**
 * POST /api/marketing/generate-video
 * GET  /api/marketing/generate-video?requestId=xxx&model=xxx
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fal } from '@fal-ai/client'

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

  fal.config({ credentials: apiKey })

  const input: Record<string, unknown> = {
    prompt: prompt.trim(),
    duration,
    aspect_ratio: aspectRatio,
  }
  if (model === 'kling-img2video' && imageUrl) {
    input.image_url = imageUrl
  }

  try {
    const { request_id } = await fal.queue.submit(endpoint, { input })
    return NextResponse.json({
      requestId: request_id,
      model,
      scriptId,
      endpoint,
      submittedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[generate-video POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
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

  if (!requestId || requestId === 'undefined') {
    return NextResponse.json({ status: 'error', error: 'requestId 無效，請重新提交任務' }, { status: 400 })
  }

  const apiKey = process.env.FAL_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })

  const endpoint = FAL_ENDPOINTS[model]
  if (!endpoint) return NextResponse.json({ status: 'error', error: `不支援的模型：${model}` }, { status: 400 })

  fal.config({ credentials: apiKey })

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false })

    const falStatus = status.status as string
    if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
      return NextResponse.json({ status: 'processing', falStatus })
    }

    if (falStatus === 'FAILED') {
      return NextResponse.json({ status: 'failed', error: '影片生成失敗' })
    }

    // COMPLETED — fetch result
    const result = await fal.queue.result(endpoint, { requestId })
    const output = result.data as Record<string, unknown>
    const tempVideoUrl: string =
      (output?.video as { url?: string })?.url ??
      (output?.videos as { url?: string }[])?.[0]?.url ?? ''

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
  } catch (err) {
    console.error('[generate-video GET]', err)
    return NextResponse.json({ status: 'error', error: String(err) }, { status: 500 })
  }
}
