/**
 * GET    /api/exams/[id] — 考卷完整內容（含答案；僅可管理者）
 * PATCH  /api/exams/[id] — 修改考卷資訊、狀態（draft / published / closed）、整份題目（questions）
 * DELETE /api/exams/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { loadExam, loadQuestions, newPublicToken, parseExamMeta, questionRow } from '@/lib/exams/server'
import { normalizeQuestion, type ExamQuestion } from '@/lib/exams/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const [questions, { count }] = await Promise.all([
    loadQuestions(access.admin, exam.id),
    access.admin.from('exam_submissions').select('id', { count: 'exact', head: true }).eq('exam_id', exam.id),
  ])
  return NextResponse.json({ exam, questions, submission_count: count ?? 0 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const patch: Record<string, unknown> = { ...parseExamMeta(body), updated_at: new Date().toISOString() }

  if (typeof body.department === 'string' && body.department !== exam.department) {
    if (!canManageDept(access, body.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    patch.department = body.department
  }

  if (Array.isArray(body.questions)) {
    // 已有人作答後不能改題目（成績依題目計算）
    const { count } = await access.admin.from('exam_submissions').select('id', { count: 'exact', head: true }).eq('exam_id', exam.id)
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'has_submissions' }, { status: 409 })
    const questions = body.questions.map((q, i) => normalizeQuestion(q, i)).filter((q): q is ExamQuestion => !!q)
    const { error: delErr } = await access.admin.from('exam_questions').delete().eq('exam_id', exam.id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    if (questions.length) {
      const { error: insErr } = await access.admin.from('exam_questions').insert(questions.map(q => questionRow(exam.id, q)))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  if (typeof body.status === 'string' && ['draft', 'published', 'closed'].includes(body.status)) {
    if (body.status === 'published') {
      const { count } = await access.admin.from('exam_questions').select('id', { count: 'exact', head: true }).eq('exam_id', exam.id)
      if (!count) return NextResponse.json({ error: 'no_questions' }, { status: 400 })
    }
    patch.status = body.status
  }

  const audience = (patch.audience as string[] | undefined) ?? exam.audience
  if (audience.includes('public') && !exam.public_token) patch.public_token = newPublicToken()

  const { error } = await access.admin.from('exams').update(patch).eq('id', exam.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { error } = await access.admin.from('exams').delete().eq('id', exam.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
