/**
 * POST /api/marketing/generate-video
 * GET  /api/marketing/generate-video?requestId=xxx&model=xxx
 *
 * Model → Provider mapping:
 *   kling-*       → fal.ai (5s / 10s)
 *   veo3*         → Google VEO3 (25s)
 *   sora*         → OpenAI SORA (60s)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fal } from '@fal-ai/client'

const FAL_ENDPOINTS: Record<string, string> = {
  'kling-standard':  'fal-ai/kling-video/v1.6/standard/text-to-video',
  'kling-pro':       'fal-ai/kling-video/v1.6/pro/text-to-video',
  'kling-img2video': 'fal-ai/kling-video/v1.6/standard/image-to-video',
}

const VEO3_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-001:predictLongRunning'
const OPENAI_VIDEO_ENDPOINT = 'https://api.openai.com/v1/videos/generations'

function getProvider(model: string): 'fal' | 'google' | 'openai' {
  if (model.startsWith('kling')) return 'fal'
  if (model.startsWith('veo3')) return 'google'
  if (model.startsWith('sora')) return 'openai'
  return 'fal'
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

  const provider = getProvider(model)

  try {
    // ── fal.ai (KLING) ────────────────────────────────────────────────────────
    if (provider === 'fal') {
      const apiKey = process.env.FAL_AI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })
      const endpoint = FAL_ENDPOINTS[model]
      if (!endpoint) return NextResponse.json({ error: '不支援的模型' }, { status: 400 })
      fal.config({ credentials: apiKey })
      const input: Record<string, unknown> = { prompt: prompt.trim(), duration, aspect_ratio: aspectRatio }
      if (model === 'kling-img2video' && imageUrl) input.image_url = imageUrl
      const { request_id } = await fal.queue.submit(endpoint, { input })
      return NextResponse.json({ requestId: request_id, model, scriptId, endpoint, submittedAt: new Date().toISOString() })
    }

    // ── Google VEO3 ───────────────────────────────────────────────────────────
    if (provider === 'google') {
      const apiKey = process.env.VEO_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'VEO_API_KEY 未設定' }, { status: 500 })
      const instance: Record<string, unknown> = { prompt: prompt.trim() }
      if (imageUrl && model === 'veo3-img2video') instance.image = { uri: imageUrl }
      const res = await fetch(VEO3_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [instance],
          parameters: { aspectRatio, durationSeconds: parseInt(duration) },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'VEO3 生成失敗')
      return NextResponse.json({ requestId: data.name, model, scriptId, submittedAt: new Date().toISOString() })
    }

    // ── OpenAI SORA ───────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY 未設定' }, { status: 500 })
      const body: Record<string, unknown> = {
        model: 'sora-1.0',
        prompt: prompt.trim(),
        duration: parseInt(duration),
        resolution: '1920x1080',
        n: 1,
      }
      if (imageUrl && model === 'sora-img2video') body.image = imageUrl
      const res = await fetch(OPENAI_VIDEO_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'SORA 生成失敗')
      return NextResponse.json({ requestId: data.id, model, scriptId, submittedAt: new Date().toISOString() })
    }

    return NextResponse.json({ error: '不支援的模型' }, { status: 400 })
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

  const provider = getProvider(model)

  try {
    // ── fal.ai (KLING) ────────────────────────────────────────────────────────
    if (provider === 'fal') {
      const apiKey = process.env.FAL_AI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })
      const endpoint = FAL_ENDPOINTS[model]
      if (!endpoint) return NextResponse.json({ status: 'error', error: `不支援的模型：${model}` }, { status: 400 })
      fal.config({ credentials: apiKey })
      const status = await fal.queue.status(endpoint, { requestId, logs: false })
      const falStatus = status.status as string
      if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') return NextResponse.json({ status: 'processing', falStatus })
      if (falStatus === 'FAILED') return NextResponse.json({ status: 'failed', error: '影片生成失敗' })
      const result = await fal.queue.result(endpoint, { requestId })
      const output = result.data as Record<string, unknown>
      const url: string =
        (output?.video as { url?: string })?.url ??
        (output?.videos as { url?: string }[])?.[0]?.url ?? ''
      if (!url) return NextResponse.json({ status: 'error', error: '未收到影片 URL' }, { status: 500 })
      return NextResponse.json({ status: 'completed', url, requestId, model, scriptId, generatedAt: new Date().toISOString() })
    }

    // ── Google VEO3 ───────────────────────────────────────────────────────────
    if (provider === 'google') {
      const apiKey = process.env.VEO_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'VEO_API_KEY 未設定' }, { status: 500 })
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${requestId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      const data = await res.json()
      if (!data.done) return NextResponse.json({ status: 'processing' })
      if (data.error) return NextResponse.json({ status: 'failed', error: data.error.message })
      const url: string =
        data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? ''
      if (!url) return NextResponse.json({ status: 'error', error: '未收到影片 URL' }, { status: 500 })
      return NextResponse.json({ status: 'completed', url, requestId, model, scriptId, generatedAt: new Date().toISOString() })
    }

    // ── OpenAI SORA ───────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY 未設定' }, { status: 500 })
      const res = await fetch(`${OPENAI_VIDEO_ENDPOINT}/${requestId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      const data = await res.json()
      if (data.status === 'running' || data.status === 'pending') return NextResponse.json({ status: 'processing' })
      if (data.status === 'failed') return NextResponse.json({ status: 'failed', error: data.error?.message ?? 'SORA 生成失敗' })
      const url: string = data.result?.url ?? data.data?.[0]?.url ?? ''
      if (!url) return NextResponse.json({ status: 'error', error: '未收到影片 URL' }, { status: 500 })
      return NextResponse.json({ status: 'completed', url, requestId, model, scriptId, generatedAt: new Date().toISOString() })
    }

    return NextResponse.json({ status: 'error', error: '不支援的模型' }, { status: 400 })
  } catch (err) {
    console.error('[generate-video GET]', err)
    return NextResponse.json({ status: 'error', error: String(err) }, { status: 500 })
  }
}
