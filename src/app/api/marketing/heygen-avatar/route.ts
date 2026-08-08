/**
 * GET  /api/marketing/heygen-avatar          → 列出可用 avatars & voices
 * POST /api/marketing/heygen-avatar          → 提交影片生成任務
 * GET  /api/marketing/heygen-avatar?videoId= → 查詢任務狀態
 *
 * HeyGen API v2: https://docs.heygen.com/reference/video-generation
 *
 * Env: HEYGEN_API_KEY
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { HEYGEN_VIDEO_COST, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

const HEYGEN_BASE = 'https://api.heygen.com'

// ── helpers ────────────────────────────────────────────────────────────────────
function heygenHeaders() {
  const key = process.env.HEYGEN_API_KEY
  if (!key) throw new Error('HEYGEN_API_KEY 未設定')
  return { 'X-Api-Key': key, 'Content-Type': 'application/json' }
}

// ── GET: list avatars / voices OR poll video status ─────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('videoId')
  const type    = searchParams.get('type') // 'avatars' | 'voices'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const headers = heygenHeaders()

    // ── Poll video status ─────────────────────────────────────────────────────
    if (videoId) {
      const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, { headers })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ error: err?.message ?? `HeyGen 查詢失敗 (${res.status})` }, { status: res.status })
      }
      const data = await res.json()
      const video = data?.data ?? data
      const status: string = video?.status ?? 'processing'
      const videoUrl: string = video?.video_url ?? ''

      // If completed, download and store in Supabase
      if (status === 'completed' && videoUrl) {
        const ext = videoUrl.split('?')[0].endsWith('.mp4') ? 'mp4' : 'mp4'
        const fileName = `${user.id}/avatar-${videoId}.${ext}`

        // Check if already uploaded
        const { data: existing } = await supabase.storage.from('marketing-assets').list(user.id, {
          search: `avatar-${videoId}`,
        })
        let publicUrl = videoUrl
        if (!existing || existing.length === 0) {
          try {
            const videoRes = await fetch(videoUrl)
            const buffer = await videoRes.arrayBuffer()
            const { error: uploadErr } = await supabase.storage
              .from('marketing-assets')
              .upload(fileName, buffer, { contentType: 'video/mp4', upsert: true })
            if (!uploadErr) {
              const { data: { publicUrl: pu } } = supabase.storage.from('marketing-assets').getPublicUrl(fileName)
              publicUrl = pu
            }
          } catch (_) {
            // keep original URL on upload failure
          }
        } else {
          const { data: { publicUrl: pu } } = supabase.storage.from('marketing-assets').getPublicUrl(fileName)
          publicUrl = pu
        }
        return NextResponse.json({ status: 'completed', videoUrl: publicUrl })
      }

      return NextResponse.json({ status, videoUrl })
    }

    // ── List avatars ──────────────────────────────────────────────────────────
    if (type === 'avatars') {
      const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, { headers })
      if (!res.ok) return NextResponse.json({ error: `HeyGen avatars 失敗 (${res.status})` }, { status: res.status })
      const data = await res.json()
      const avatars = (data?.data?.avatars ?? []).map((a: Record<string, unknown>) => ({
        id: a.avatar_id,
        name: a.avatar_name,
        preview: a.preview_image_url ?? a.thumbnail_image_url ?? '',
        gender: a.gender ?? '',
      }))
      return NextResponse.json({ avatars })
    }

    // ── List voices ───────────────────────────────────────────────────────────
    if (type === 'voices') {
      const res = await fetch(`${HEYGEN_BASE}/v2/voices`, { headers })
      if (!res.ok) return NextResponse.json({ error: `HeyGen voices 失敗 (${res.status})` }, { status: res.status })
      const data = await res.json()
      const voices = (data?.data?.voices ?? [])
        .filter((v: Record<string, unknown>) => ['zh', 'en', 'vi', 'ja', 'ko'].includes((v.language as string)?.slice(0, 2)))
        .map((v: Record<string, unknown>) => ({
          id: v.voice_id,
          name: v.display_name ?? v.name,
          language: v.language,
          gender: v.gender,
          preview: v.preview_audio ?? '',
        }))
      return NextResponse.json({ voices })
    }

    return NextResponse.json({ error: '請指定 type=avatars 或 type=voices 或 videoId=...' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── POST: submit video generation ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    avatarId,
    voiceId,
    script,
    ratio = '16:9',     // '16:9' | '9:16' | '1:1'
    background = '#FFFFFF',
  } = body

  if (!avatarId) return NextResponse.json({ error: '請選擇主播 Avatar' }, { status: 400 })
  if (!voiceId)  return NextResponse.json({ error: '請選擇聲音' }, { status: 400 })
  if (!script?.trim()) return NextResponse.json({ error: '腳本不可為空' }, { status: 400 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.avatarMarketing) {
    return NextResponse.json({ error: '目前方案未開放主播行銷，請升級至企業方案', plan }, { status: 403 })
  }

  const billable = await isBillableUser(user.id)
  const check = await checkCredits(user.id, HEYGEN_VIDEO_COST, billable)
  if (!check.ok) return NextResponse.json(check.payload, { status: 402 })

  const dimensionMap: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720,  height: 1280 },
    '1:1':  { width: 720,  height: 720 },
  }
  const dimension = dimensionMap[ratio] ?? dimensionMap['16:9']

  try {
    const headers = heygenHeaders()

    const payload = {
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          voice_id: voiceId,
          input_text: script,
        },
        background: {
          type: 'color',
          value: background,
        },
      }],
      dimension,
      test: false,
    }

    const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err?.message ?? err?.error ?? `HeyGen 提交失敗 (${res.status})` },
        { status: res.status },
      )
    }

    const data = await res.json()
    const videoId: string = data?.data?.video_id ?? data?.video_id ?? ''
    if (!videoId) return NextResponse.json({ error: 'HeyGen 未回傳 video_id' }, { status: 500 })

    await deductCredits(user.id, HEYGEN_VIDEO_COST, '[marketing] 主播行銷影片 HeyGen', billable)
    return NextResponse.json({ videoId, status: 'processing', cost: HEYGEN_VIDEO_COST })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
