/**
 * GET /api/cron/geo-track
 * GEO Writer 步驟5 — 定時追蹤（cron）
 * 對所有「已撰寫」問句用 Perplexity 查被引用狀況，寫入 geo_tracking。
 * 為控管額度，每次最多處理 GEO_TRACK_BATCH（預設 40）題。
 */
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { trackQuestions, deriveTarget, type TrackInput } from '@/lib/geo/track'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!process.env.PERPLEXITY_API_KEY) {
    return NextResponse.json({ skipped: 'no PERPLEXITY_API_KEY' })
  }

  const admin = createAdminClient()
  const batch = Number(process.env.GEO_TRACK_BATCH ?? 40)

  // 取已撰寫問句（含所屬專案 locale 與文章 published_url）
  const { data: questions } = await admin
    .from('geo_questions')
    .select('id, question, project_id, geo_projects(locale, target_domain)')
    .eq('status', 'written')
    .order('created_at', { ascending: true })
    .limit(batch)

  if (!questions || questions.length === 0) {
    return NextResponse.json({ tracked: 0 })
  }

  const projectIds = [...new Set(questions.map(q => q.project_id))]
  const { data: articles } = await admin
    .from('geo_articles')
    .select('published_url, question_ids, project_id')
    .in('project_id', projectIds)

  // 依 locale 分組逐批追蹤
  let tracked = 0
  const byLocale = new Map<string, TrackInput[]>()
  for (const q of questions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = (q as any).geo_projects
    const locale = (proj?.locale as string) ?? 'zh-TW'
    const art = (articles ?? []).find(a => (a.question_ids ?? []).includes(q.id))
    const input: TrackInput = { id: q.id, question: q.question, target: deriveTarget(proj?.target_domain, art?.published_url) }
    const arr = byLocale.get(locale) ?? []
    arr.push(input)
    byLocale.set(locale, arr)
  }

  for (const [locale, inputs] of byLocale) {
    const res = await trackQuestions(admin, inputs, locale)
    tracked += res.length
  }

  return NextResponse.json({ tracked })
}
