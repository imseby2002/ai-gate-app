/**
 * PATCH /api/exams/[id]/submissions/[sid] — 人工覆核：調整各題分數與回饋
 * body: { results: { [questionId]: { score, feedback? } } }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { loadExam } from '@/lib/exams/server'
import { summarize, type QuestionResult } from '@/lib/exams/grade'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const { id, sid } = await params
  const exam = await loadExam(access, id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sub } = await access.admin.from('exam_submissions').select('id, results')
    .eq('id', sid).eq('exam_id', exam.id).maybeSingle()
  if (!sub) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await req.json().catch(() => null) as { results?: Record<string, { score?: unknown; feedback?: unknown }> } | null
  const results = { ...(sub.results as Record<string, QuestionResult>) }
  for (const [qid, v] of Object.entries(body?.results ?? {})) {
    const cur = results[qid]
    if (!cur) continue
    const score = Math.max(0, Math.min(cur.max, Number(v.score) || 0))
    results[qid] = {
      ...cur,
      score,
      correct: score === cur.max,
      pending: false,
      ...(typeof v.feedback === 'string' ? { feedback: v.feedback.slice(0, 2000) } : {}),
    }
  }
  const s = summarize(results)
  const { error } = await access.admin.from('exam_submissions').update({
    results: s.results,
    score: s.score,
    max_score: s.max_score,
    grading_status: s.grading_status === 'pending' ? 'pending' : 'reviewed',
  }).eq('id', sid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, score: s.score, max_score: s.max_score })
}
