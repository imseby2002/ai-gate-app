/**
 * 多分鏡配音影片合成任務
 * POST /api/marketing/video-render   建立任務（queued），由獨立 worker 領取產圖、配音、合成
 *   Body: { title?, scenes: [{ narration, visualPrompt, imageUrl? }], voiceId, template?, aspect?, bgm? }
 * GET  /api/marketing/video-render?id=xxx   查單一任務；不帶 id 回最近 10 筆（含 enabled，未開放時面板隱藏）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { precheckUsage } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import {
  STORY_ASPECTS, STORY_DISABLED_MSG, STORY_MAX_NARRATION, STORY_MAX_SCENES, STORY_TEMPLATES, estimateStoryCost, storyVideoEnabled,
  type StoryAspect, type StoryScene, type StoryTemplate,
} from '@/lib/marketing/story-video'

const COLUMNS = 'id, status, title, template, aspect, scenes, output_url, duration_sec, cost_usd, error, created_at, updated_at'

export async function POST(req: NextRequest) {
  if (!storyVideoEnabled()) return NextResponse.json({ error: STORY_DISABLED_MSG }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { features, plan } = await getMarketingEntitlements(supabase, user.id)
  if (!features.videoGen) {
    return NextResponse.json({ error: '目前方案未開放影片產出，請升級至 PRO 以上', plan }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const rawScenes = Array.isArray(body.scenes) ? body.scenes : []
  const scenes: StoryScene[] = rawScenes
    .map((s: { narration?: unknown; visualPrompt?: unknown; imageUrl?: unknown }) => ({
      narration: String(s?.narration ?? '').trim().slice(0, STORY_MAX_NARRATION),
      visual_prompt: String(s?.visualPrompt ?? '').trim().slice(0, 1500),
      image_url: /^https:\/\//.test(String(s?.imageUrl ?? '')) ? String(s.imageUrl) : null,
      audio_url: null,
    }))
    .filter((s: StoryScene) => s.narration && (s.visual_prompt || s.image_url))
  if (!scenes.length) return NextResponse.json({ error: '請至少提供一段分鏡（旁白＋畫面）' }, { status: 400 })
  if (scenes.length > STORY_MAX_SCENES) return NextResponse.json({ error: `分鏡最多 ${STORY_MAX_SCENES} 段` }, { status: 400 })

  const voiceId = String(body.voiceId ?? '').trim()
  if (!voiceId) return NextResponse.json({ error: '請選擇配音聲音' }, { status: 400 })
  const template: StoryTemplate = (STORY_TEMPLATES as readonly string[]).includes(body.template) ? body.template : 'classic'
  const aspect: StoryAspect = (STORY_ASPECTS as readonly string[]).includes(body.aspect) ? body.aspect : '9:16'

  // 實際於 worker 逐段產圖、配音時依實際成本扣點；此處只確認餘額足夠
  const blocked = await precheckUsage(user.id, estimateStoryCost(scenes))
  if (blocked) return NextResponse.json(blocked, { status: 402 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketing_video_renders')
    .insert({
      user_id: user.id,
      title: String(body.title ?? '').trim().slice(0, 80) || null,
      template,
      aspect,
      voice_id: voiceId,
      bgm: body.bgm === true,
      scenes,
    })
    .select(COLUMNS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ job: data })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!storyVideoEnabled()) return NextResponse.json({ enabled: false, jobs: [] })

  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const { data } = await supabase.from('marketing_video_renders').select(COLUMNS).eq('id', id).maybeSingle()
    if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ job: data })
  }
  const { data } = await supabase
    .from('marketing_video_renders')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(10)
  return NextResponse.json({ enabled: true, jobs: data ?? [] })
}
