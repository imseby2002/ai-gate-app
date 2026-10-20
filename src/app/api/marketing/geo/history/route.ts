import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/company/activeCompany'
import { companyMemberIds } from '@/lib/connector/company-resources'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  // 如果帶有 projectId，回傳該專案完整內容供前端編輯器載入
  if (projectId) {
    const { data: project, error: projErr } = await supabase
      .from('geo_projects')
      .select('id, seed_topic, locale, exclusive_facts, author, target_domain, auto_track, created_at')
      .eq('id', projectId)
      .single()

    if (projErr || !project) {
      return NextResponse.json({ error: '找不到專案' }, { status: 404 })
    }

    // 載入題目
    const { data: questions } = await supabase
      .from('geo_questions')
      .select('id, question, intent, volume, volume_source, competition_score, intent_score, opportunity_score, cluster_id, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    // 載入聚叢
    const { data: clusters } = await supabase
      .from('geo_clusters')
      .select('id, title, pillar, question_ids, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    // 載入最新文章（可能有草稿或已發佈）
    const { data: articles } = await supabase
      .from('geo_articles')
      .select('id, cluster_id, title, body_md, json_ld, question_ids, published_url, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    // 載入追蹤數據
    const qIds = (questions ?? []).map(q => q.id)
    const tracking: Array<{ id: string; cited: boolean; rank: number | null; sources: string[] }> = []
    if (qIds.length > 0) {
      const { data: trackRows } = await supabase
        .from('geo_tracking')
        .select('id, question_id, engine, cited, rank, cited_sources, checked_at')
        .in('question_id', qIds)
        .order('checked_at', { ascending: false })

      // 每個 question_id 只取最新一筆
      const seen = new Set<string>()
      for (const t of trackRows ?? []) {
        if (!seen.has(t.question_id)) {
          seen.add(t.question_id)
          tracking.push({
            id: t.question_id,
            cited: t.cited,
            rank: t.rank,
            sources: t.cited_sources ?? [],
          })
        }
      }
    }

    return NextResponse.json({
      project,
      questions: questions ?? [],
      clusters: (clusters ?? []).map(c => ({
        id: c.id,
        title: c.title,
        pillar: c.pillar,
        questionIds: c.question_ids ?? [],
      })),
      articles: articles ?? [],
      tracking,
    })
  }

  // 沒有 projectId 則列出歷史專案：目前公司所有成員的專案（RLS 亦限制同公司）；無公司則只看自己
  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('company_id').eq('id', user.id).maybeSingle()
  const companyId = await resolveUserCompanyId(admin, user.id, (me?.company_id as string | null) ?? null)
  const ownerIds = companyId ? await companyMemberIds(companyId) : []
  if (!ownerIds.includes(user.id)) ownerIds.push(user.id)

  const { data: projects, error } = await supabase
    .from('geo_projects')
    .select(`
      id,
      user_id,
      seed_topic,
      target_domain,
      author,
      created_at,
      locale,
      auto_track,
      geo_articles (
        id,
        title,
        status,
        published_url,
        created_at
      ),
      geo_questions (
        id,
        status
      )
    `)
    .in('user_id', ownerIds)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[geo/history] fetch error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const creatorIds = [...new Set((projects ?? []).map(p => p.user_id as string))]
  const names = new Map<string, string>()
  if (creatorIds.length) {
    const { data: ps } = await admin.from('profiles').select('id, full_name, email').in('id', creatorIds)
    for (const pr of ps ?? []) names.set(pr.id, (pr.full_name as string) || (pr.email as string) || '')
  }

  const list = (projects ?? []).map(p => ({
    id: p.id,
    creator: names.get(p.user_id as string) ?? '',
    mine: p.user_id === user.id,
    seed_topic: p.seed_topic,
    target_domain: p.target_domain,
    author: p.author,
    created_at: p.created_at,
    locale: p.locale,
    auto_track: p.auto_track,
    articles: p.geo_articles ?? [],
    questionsCount: (p.geo_questions ?? []).length,
    writtenCount: ((p.geo_questions as Array<{ id: string; status: string }>) ?? []).filter(q => q.status === 'written').length,
  }))

  return NextResponse.json({ projects: list })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: '缺少 projectId' }, { status: 400 })

  // 刪除只限建立者
  const { data: deleted, error } = await supabase
    .from('geo_projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!deleted?.length) return NextResponse.json({ error: '只有建立者可以刪除' }, { status: 403 })

  return NextResponse.json({ success: true })
}
