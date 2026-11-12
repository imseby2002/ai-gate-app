/**
 * POST /api/exams/[id]/regenerate — 單題重新出題（替換特定題目）
 *   body: {
 *     question_id?: string,
 *     position: number,
 *     type: QuestionType,
 *     points?: number,
 *     current_question?: L10n,
 *     feedback?: string,
 *     topic?: string,
 *     scope?: string,
 *     knowledge_doc_ids?: string[]
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { loadExam, questionRow } from '@/lib/exams/server'
import { regenerateSingleQuestion, MAX_KNOWLEDGE_CHARS } from '@/lib/exams/generate'
import { QUESTION_TYPES, type QuestionType, type L10n } from '@/lib/exams/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { count: subCount } = await access.admin.from('exam_submissions').select('id', { count: 'exact', head: true }).eq('exam_id', exam.id)
  if ((subCount ?? 0) > 0) return NextResponse.json({ error: 'has_submissions' }, { status: 409 })

  const body = await req.json().catch(() => null) as {
    question_id?: string
    position?: number
    type?: string
    points?: number
    current_question?: L10n
    feedback?: string
    topic?: string
    scope?: string
    knowledge_doc_ids?: string[]
  } | null

  const qType = (body?.type && QUESTION_TYPES.includes(body.type as QuestionType)) ? (body.type as QuestionType) : 'single'
  const position = Math.max(0, Number(body?.position) || 0)
  const points = Math.max(1, Number(body?.points) || (qType === 'essay' ? 10 : qType === 'short' ? 5 : 1))
  const feedback = typeof body?.feedback === 'string' ? body.feedback.slice(0, 1000) : undefined
  const topic = typeof body?.topic === 'string' ? body.topic.slice(0, 500) : undefined
  const scope = typeof body?.scope === 'string' ? body.scope.slice(0, 500) : undefined

  const docIds = Array.isArray(body?.knowledge_doc_ids) && body.knowledge_doc_ids.length
    ? body.knowledge_doc_ids.filter((x): x is string => typeof x === 'string')
    : exam.knowledge_doc_ids

  let docs: { id: string; title: string; content: string }[] = []
  if (docIds.length) {
    const { data, error: docErr } = await access.admin.from('knowledge_docs').select('id, title, content')
      .eq('company_id', access.companyId).in('id', docIds)
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
    docs = (data ?? []) as typeof docs
  }
  if (!docs.length) return NextResponse.json({ error: 'no_knowledge' }, { status: 400 })

  const chars = docs.reduce((s, d) => s + d.content.length, 0)
  if (chars > MAX_KNOWLEDGE_CHARS) return NextResponse.json({ error: 'knowledge_too_long', chars, max: MAX_KNOWLEDGE_CHARS }, { status: 400 })

  const knowledge = docs.map(d => ({ title: d.title, content: d.content }))

  try {
    const question = await regenerateSingleQuestion({
      knowledge,
      questionType: qType,
      points,
      currentQuestion: body?.current_question,
      feedback,
      topic,
      scope,
      position,
    })

    if (body?.question_id) {
      question.id = body.question_id
      const { error: upErr } = await access.admin.from('exam_questions')
        .update(questionRow(exam.id, question))
        .eq('id', body.question_id)
        .eq('exam_id', exam.id)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ question })
  } catch (e) {
    console.error('[exam-regenerate-question]', e)
    return NextResponse.json({ error: 'generate_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}