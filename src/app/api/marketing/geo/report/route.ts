/**
 * GET /api/marketing/geo/report?projectId=&format=json|html
 * 月度引用追蹤報告：被引用率趨勢 + 競爭對手 SoV + 掉榜清單。
 * format=html 回傳可列印報告（瀏覽器另存 PDF）；預設 json 供前端摘要顯示。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aggregateReport, buildReportHtml, type TrackingRow } from '@/lib/geo/report'
import { deriveTarget } from '@/lib/geo/track'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  const format = req.nextUrl.searchParams.get('format') ?? 'json'
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  const { data: project } = await supabase
    .from('geo_projects')
    .select('id, seed_topic, target_domain')
    .eq('id', projectId)
    .single()
  if (!project) return NextResponse.json({ error: '找不到專案' }, { status: 404 })

  // 取該專案問句的追蹤紀錄（RLS 已限擁有者）
  const { data: rows } = await supabase
    .from('geo_tracking')
    .select('question_id, checked_at, cited, rank, cited_sources, geo_questions!inner(question, project_id)')
    .eq('geo_questions.project_id', projectId)
    .order('checked_at', { ascending: true })

  const tracking: TrackingRow[] = (rows ?? []).map(r => ({
    question_id: r.question_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    question: (r as any).geo_questions?.question ?? '',
    checked_at: r.checked_at,
    cited: r.cited,
    rank: r.rank,
    cited_sources: r.cited_sources ?? [],
  }))

  const target = deriveTarget(project.target_domain)
  const data = aggregateReport(tracking, target)

  if (format === 'html') {
    const html = buildReportHtml(project.seed_topic, data)
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return NextResponse.json(data)
}
