/**
 * POST /api/marketing/generate-video
 * GET  /api/marketing/generate-video?requestId=xxx&model=xxx
 *
 * Model → Provider mapping:
 *   kling-*       → fal.ai (5s / 10s)
 *   veo3*         → Google VEO3 (25s)
 *   sora*         → OpenAI Sora 2（4／8／12 秒，720p）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fal } from '@fal-ai/client'
import { videoCost, checkCredits, deductCredits, isBillableUser, getCostMultiplier } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

const FAL_ENDPOINTS: Record<string, string> = {
  'kling-standard':  'fal-ai/kling-video/v1.6/standard/text-to-video',
  'kling-pro':       'fal-ai/kling-video/v1.6/pro/text-to-video',
  'kling-img2video': 'fal-ai/kling-video/v1.6/standard/image-to-video',
}

const VEO3_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-001:predictLongRunning'
// OpenAI Video API（Sora 2）：POST /v1/videos（multipart）、GET /v1/videos/{id}、GET /v1/videos/{id}/content
const OPENAI_VIDEO_ENDPOINT = 'https://api.openai.com/v1/videos'
const SORA_SECONDS = [4, 8, 12] as const

/** Sora 2 只接受 4／8／12 秒：取不超過 12 的最接近值 */
function soraSeconds(duration: number): (typeof SORA_SECONDS)[number] {
  return SORA_SECONDS.reduce((best, s) => (Math.abs(s - duration) < Math.abs(best - duration) ? s : best), 12)
}

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

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.videoGen) {
    return NextResponse.json({ error: '目前方案未開放影片產出，請升級至 PRO 以上', plan }, { status: 403 })
  }

  // 影片生成成本高：提交前檢查點數，提交成功即扣點（供應商在提交後就會計費）
  // 實際成本（依秒數）× 方案倍率
  const seconds = provider === 'openai' ? soraSeconds(parseInt(duration) || 12) : parseInt(duration) || 5
  const cost = videoCost(model, seconds, await getCostMultiplier(user.id))
  const billable = await isBillableUser(user.id)
  const check = await checkCredits(user.id, cost, billable)
  if (!check.ok) return NextResponse.json(check.payload, { status: 402 })
  const charge = () => deductCredits(user.id, cost, `[marketing] 影片生成 ${model} ${seconds}s`, billable)

  try {
    // ── fal.ai (KLING) ────────────────────────────────────────────────────────
    if (provider === 'fal') {
      const apiKey = process.env.FAL_AI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })
      const endpoint = FAL_ENDPOINTS[model]
      if (!endpoint) return NextResponse.json({ error: '不支援的模型' }, { status: 400 })
      fal.config({ credentials: apiKey })
      const input: Record<string, unknown> = { prompt: prompt.trim(), duration, aspect_ratio: aspectRatio }
      if (model === 'kling-img2video') {
        if (!imageUrl) return NextResponse.json({ error: '圖生影片需要參考圖片' }, { status: 400 })
        // base64 參考圖先上傳至 fal storage 取得 URL
        if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
          const blob = await (await fetch(imageUrl)).blob()
          input.image_url = await fal.storage.upload(blob)
        } else {
          input.image_url = imageUrl
        }
      }
      const { request_id } = await fal.queue.submit(endpoint, { input })
      await charge()
      return NextResponse.json({ requestId: request_id, model, scriptId, endpoint, cost, submittedAt: new Date().toISOString() })
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
      await charge()
      return NextResponse.json({ requestId: data.name, model, scriptId, cost, submittedAt: new Date().toISOString() })
    }

    // ── OpenAI SORA ───────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY 未設定' }, { status: 500 })
      const form = new FormData()
      form.append('model', 'sora-2')
      form.append('prompt', prompt.trim())
      form.append('seconds', String(seconds))
      form.append('size', aspectRatio === '9:16' ? '720x1280' : '1280x720')
      // 參考圖成為第一格畫面（解析度需與 size 相符）
      if (imageUrl && model === 'sora-img2video') {
        const imgRes = await fetch(imageUrl)
        if (!imgRes.ok) return NextResponse.json({ error: '無法讀取參考圖' }, { status: 400 })
        const type = (imgRes.headers.get('content-type') ?? 'image/jpeg').split(';')[0]
        form.append('input_reference', new Blob([await imgRes.arrayBuffer()], { type }), `reference.${type.split('/')[1] || 'jpg'}`)
      }
      const res = await fetch(OPENAI_VIDEO_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'SORA 生成失敗')
      await charge()
      return NextResponse.json({ requestId: data.id, model, scriptId, cost, submittedAt: new Date().toISOString() })
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
      if (!res.ok) return NextResponse.json({ status: 'error', error: data.error?.message ?? `SORA 查詢失敗 (${res.status})` }, { status: 500 })
      if (data.status === 'queued' || data.status === 'in_progress') return NextResponse.json({ status: 'processing', progress: data.progress })
      if (data.status === 'failed') return NextResponse.json({ status: 'failed', error: data.error?.message ?? 'SORA 生成失敗' })

      // 完成：影片內容需帶金鑰下載，轉存 Storage 後回傳公開網址
      const fileName = `${user.id}/sora-${requestId}.mp4`
      const { data: existing } = await supabase.storage.from('marketing-assets').list(user.id, { search: `sora-${requestId}` })
      if (!existing?.length) {
        const contentRes = await fetch(`${OPENAI_VIDEO_ENDPOINT}/${requestId}/content`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        })
        if (!contentRes.ok) return NextResponse.json({ status: 'error', error: `SORA 影片下載失敗 (${contentRes.status})` }, { status: 500 })
        const { error: uploadErr } = await supabase.storage
          .from('marketing-assets')
          .upload(fileName, await contentRes.arrayBuffer(), { contentType: 'video/mp4', upsert: true })
        if (uploadErr) return NextResponse.json({ status: 'error', error: `影片儲存失敗：${uploadErr.message}` }, { status: 500 })
      }
      const url = supabase.storage.from('marketing-assets').getPublicUrl(fileName).data.publicUrl
      return NextResponse.json({ status: 'completed', url, requestId, model, scriptId, generatedAt: new Date().toISOString() })
    }

    return NextResponse.json({ status: 'error', error: '不支援的模型' }, { status: 400 })
  } catch (err) {
    console.error('[generate-video GET]', err)
    return NextResponse.json({ status: 'error', error: String(err) }, { status: 500 })
  }
}
