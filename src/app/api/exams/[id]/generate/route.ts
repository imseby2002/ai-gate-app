/**
 * POST /api/exams/[id]/generate — 新增到考卷草稿最後
 *   AI 出題：body { counts: { single, multi, fill, short, essay }, topic?, knowledge_doc_ids? }
 *   人工出題、AI 修飾：body { manual: '出題者手寫的題目', knowledge_doc_ids? }（知識選填，只當參考）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { loadExam, questionRow } from '@/lib/exams/server'
import { generateExamQuestions, polishManualQuestions, MAX_KNOWLEDGE_CHARS, MAX_MANUAL_CHARS, MAX_QUESTIONS_PER_RUN, type TypeCounts } from '@/lib/exams/generate'
import { QUESTION_TYPES } from '@/lib/exams/types'

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

  const body = await req.json().catch(() => null) as { counts?: Record<string, unknown>; topic?: unknown; knowledge_doc_ids?: unknown; manual?: unknown } | null
  const manual = typeof body?.manual === 'string' ? body.manual.trim() : ''
  if (manual.length > MAX_MANUAL_CHARS) return NextResponse.json({ error: 'manual_too_long', max: MAX_MANUAL_CHARS }, { status: 400 })

  const counts: TypeCounts = {}
  let total = 0
  if (!manual) {
    for (const t of QUESTION_TYPES) {
      const n = Math.max(0, Math.min(MAX_QUESTIONS_PER_RUN, Math.round(Number(body?.counts?.[t]) || 0)))
      if (n) counts[t] = n
    }
    total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0)
    if (!total) return NextResponse.json({ error: 'no_counts' }, { status: 400 })
    if (total > MAX_QUESTIONS_PER_RUN) return NextResponse.json({ error: 'too_many', max: MAX_QUESTIONS_PER_RUN }, { status: 400 })
  }

  const docIds = Array.isArray(body?.knowledge_doc_ids)
    ? body!.knowledge_doc_ids.filter((x): x is string => typeof x === 'string')
    : exam.knowledge_doc_ids
  // AI 出題一定要有知識；人工出題的知識只是參考，可不選
  if (!docIds.length && !manual) return NextResponse.json({ error: 'no_knowledge' }, { status: 400 })

  let docs: { id: string; title: string; content: string }[] = []
  if (docIds.length) {
    const { data, error: docErr } = await access.admin.from('knowledge_docs').select('id, title, content')
      .eq('company_id', access.companyId).in('id', docIds)
    if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
    docs = (data ?? []) as typeof docs
  }
  if (!docs.length && !manual) return NextResponse.json({ error: 'no_knowledge' }, { status: 400 })
  const chars = docs.reduce((s, d) => s + d.content.length, 0)
  if (chars > MAX_KNOWLEDGE_CHARS) return NextResponse.json({ error: 'knowledge_too_long', chars, max: MAX_KNOWLEDGE_CHARS }, { status: 400 })

  const { count: existing } = await access.admin.from('exam_questions').select('id', { count: 'exact', head: true }).eq('exam_id', exam.id)
  const knowledge = docs.map(d => ({ title: d.title, content: d.content }))

  let questions
  try {
    questions = manual
      ? await polishManualQuestions({ manual, knowledge, startPosition: existing ?? 0 })
      : await generateExamQuestions({
        knowledge,
        counts,
        topic: typeof body?.topic === 'string' ? body.topic.slice(0, 500) : undefined,
        startPosition: existing ?? 0,
      })
  } catch (e) {
    console.error('[exam-generate]', e)
    return NextResponse.json({ error: 'generate_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
  if (!questions.length) return NextResponse.json({ error: 'generate_failed' }, { status: 502 })

  const { error } = await access.admin.from('exam_questions').insert(questions.map(q => questionRow(exam.id, q)))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await access.admin.from('exams').update({
    knowledge_doc_ids: [...new Set([...exam.knowledge_doc_ids, ...docs.map(d => d.id)])],
    updated_at: new Date().toISOString(),
  }).eq('id', exam.id)

  return NextResponse.json({ added: questions.length })
}
