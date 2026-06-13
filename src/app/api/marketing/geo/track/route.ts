/**
 * POST /api/marketing/geo/track
 * GEO Writer 步驟5 — 追蹤被引用狀況（使用者手動觸發單一專案）
 * 對專案內「已撰寫」問句，用 Perplexity 查目前 AI 會引用哪些來源、是否含目標網域。
 * 寫入 geo_tracking，回傳本次結果與各問句最新狀態。
 *
 * Body: { projectId: string }
 * Resp: { results: TrackResult[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trackQuestions, deriveTarget, type TrackInput } from '@/lib/geo/track'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.PERPLEXITY_API_KEY) {
    return NextResponse.json({ error: 'PERPLEXITY_API_KEY 未設定，無法追蹤' }, { status: 400 })
  }

  const { projectId } = await req.json()
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  const { data: project } = await supabase
    .from('geo_projects')
    .select('id, locale, target_domain')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: '找不到專案' }, { status: 404 })

  const { data: articles } = await supabase
    .from('geo_articles')
    .select('published_url, question_ids')
    .eq('project_id', projectId)

  const { data: questions } = await supabase
    .from('geo_questions')
    .select('id, question')
    .eq('project_id', projectId)
    .eq('status', 'written')
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: '尚無已撰寫的問句可追蹤' }, { status: 404 })
  }

  // 每個問句找出所屬文章的 published_url 推得目標網域
  const inputs: TrackInput[] = questions.map(q => {
    const art = (articles ?? []).find(a => (a.question_ids ?? []).includes(q.id))
    return { id: q.id, question: q.question, target: deriveTarget(project.target_domain, art?.published_url) }
  })

  const results = await trackQuestions(supabase, inputs, project.locale ?? 'zh-TW')
  return NextResponse.json({ results })
}
