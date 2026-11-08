/**
 * 多分鏡配音影片 — 供獨立 worker（worker/tasks/video-render.mjs）呼叫，標頭 x-worker-secret = WORKER_SECRET
 * POST /api/worker/video-render/claim        領取最舊的 queued 任務（卡在 rendering 超過 30 分鐘的視為失聯，可重領）
 * POST /api/worker/video-render/scene        { jobId, index } 產該段圖片與配音（已有則略過），依實際成本扣點
 * POST /api/worker/video-render/upload-url   { jobId } 取得成品 mp4 的一次性上傳網址
 * POST /api/worker/video-render/complete     { jobId, ok, error?, durationSec? } 回報結果
 * 產圖、配音金鑰與扣點都留在主 app，worker 只負責版型截圖與 ffmpeg 合成。
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeUsage, ttsCost } from '@/lib/marketing/billing'
import { generateNanoBananaWithCost } from '@/lib/ai/nano-banana'
import {
  STORY_TTS_MODEL, sceneImagePrompt, synthesizeNarration, type StoryAspect, type StoryScene,
} from '@/lib/marketing/story-video'

export const maxDuration = 120

const STALE_MS = 30 * 60 * 1000
const COLUMNS = 'id, user_id, status, title, template, aspect, voice_id, bgm, scenes, cost_usd'

function authorized(req: NextRequest): boolean {
  const expected = process.env.WORKER_SECRET
  const provided = req.headers.get('x-worker-secret') ?? ''
  if (!expected) return false
  const a = Buffer.from(provided), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const outputPath = (job: { id: string; user_id: string }) => `${job.user_id}/story-${job.id}.mp4`

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (!process.env.WORKER_SECRET) return NextResponse.json({ error: 'worker endpoint 未啟用（缺 WORKER_SECRET）' }, { status: 503 })
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await params
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  if (action === 'claim') {
    const staleBefore = new Date(Date.now() - STALE_MS).toISOString()
    const { data: candidates } = await admin
      .from('marketing_video_renders')
      .select('id, status, claimed_at')
      .or(`status.eq.queued,and(status.eq.rendering,claimed_at.lt.${staleBefore})`)
      .order('created_at', { ascending: true })
      .limit(3)
    for (const c of candidates ?? []) {
      // 以原狀態＋原 claimed_at 為條件更新，兩台 worker 同時領取時只有一台成功
      let q = admin
        .from('marketing_video_renders')
        .update({ status: 'rendering', claimed_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null })
        .eq('id', c.id)
        .eq('status', c.status)
      q = c.claimed_at ? q.eq('claimed_at', c.claimed_at) : q.is('claimed_at', null)
      const { data: claimed } = await q.select(COLUMNS)
      if (claimed?.length) return NextResponse.json({ job: claimed[0] })
    }
    return NextResponse.json({ job: null })
  }

  const jobId = String(body.jobId ?? '')
  const { data: job } = await admin.from('marketing_video_renders').select(COLUMNS).eq('id', jobId).maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })

  if (action === 'scene') {
    const scenes = (job.scenes ?? []) as StoryScene[]
    const index = Number(body.index)
    const scene = scenes[index]
    if (!scene) return NextResponse.json({ error: 'scene not found' }, { status: 404 })

    let cost = 0
    let failure: string | null = null
    try {
      if (!scene.image_url) {
        const { url, costUsd } = await generateNanoBananaWithCost({
          prompt: sceneImagePrompt(scene.visual_prompt, job.aspect as StoryAspect),
          aspectRatio: job.aspect,
        })
        scene.image_url = url
        cost += costUsd
        await chargeUsage(job.user_id, costUsd, `[marketing] 多分鏡影片 第 ${index + 1} 段畫面`)
      }
      if (!scene.audio_url) {
        scene.audio_url = await synthesizeNarration(admin, job.user_id, scene.narration, job.voice_id, `${job.id}-${index}`)
        const tts = ttsCost(scene.narration, STORY_TTS_MODEL)
        cost += tts
        await chargeUsage(job.user_id, tts, `[marketing] 多分鏡影片 第 ${index + 1} 段配音`)
      }
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e)
    } finally {
      // 已產出的部分即使後續失敗也寫回，重試時不重複產生、不重複扣點
      if (cost > 0 || scene.image_url || scene.audio_url) {
        scenes[index] = scene
        await admin
          .from('marketing_video_renders')
          .update({ scenes, cost_usd: Number(job.cost_usd ?? 0) + cost, updated_at: new Date().toISOString() })
          .eq('id', job.id)
      }
    }
    if (failure) return NextResponse.json({ error: failure, scene }, { status: 502 })
    return NextResponse.json({ scene })
  }

  if (action === 'upload-url') {
    const { data, error } = await admin.storage.from('marketing-assets').createSignedUploadUrl(outputPath(job), { upsert: true })
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'signed url failed' }, { status: 500 })
    return NextResponse.json({ signedUrl: data.signedUrl, path: data.path })
  }

  if (action === 'complete') {
    const ok = body.ok === true
    const patch = ok
      ? {
          status: 'done',
          output_url: admin.storage.from('marketing-assets').getPublicUrl(outputPath(job)).data.publicUrl,
          duration_sec: Number(body.durationSec) || null,
          error: null,
        }
      : { status: 'failed', error: String(body.error ?? 'render failed').slice(0, 1000) }
    await admin.from('marketing_video_renders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', job.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 404 })
}
