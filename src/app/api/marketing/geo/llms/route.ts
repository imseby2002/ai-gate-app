/**
 * GET /api/marketing/geo/llms?projectId=
 * 依專案與其文章產生 llms.txt（放網站根目錄 /llms.txt）。回傳純文字。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildLlmsTxt } from '@/lib/geo/llms'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  const { data: project } = await supabase
    .from('geo_projects')
    .select('seed_topic, target_domain')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: '找不到專案' }, { status: 404 })

  const { data: articles } = await supabase
    .from('geo_articles')
    .select('title, published_url')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const txt = buildLlmsTxt({
    siteName: project.seed_topic,
    summary: `關於「${project.seed_topic}」的專業在地內容。`,
    domain: project.target_domain,
    articles: (articles ?? []).map(a => ({ title: a.title, url: a.published_url })),
  })

  return new NextResponse(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
