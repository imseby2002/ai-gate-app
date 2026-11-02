/**
 * 公開作答（應徵者，免登入；middleware 已將 /api/quiz/ 設為公開）
 * GET  /api/quiz/exam/[token] — 題目（不含答案）
 * POST /api/quiz/exam/[token] — 交卷 { name, contact, lang, answers }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXAM_COLUMNS, examWindow, loadQuestions, type ExamRow } from '@/lib/exams/server'
import { answerKey, gradeSubmission, publicQuestions, sanitizeAnswers } from '@/lib/exams/grade'
import { isExamLang } from '@/lib/exams/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function loadPublic(token: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('exams').select(EXAM_COLUMNS).eq('public_token', token).maybeSingle()
  const exam = data as ExamRow | null
  if (!exam || exam.status !== 'published' || !exam.audience.includes('public')) return { admin, exam: null }
  return { admin, exam }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { admin, exam } = await loadPublic((await params).token)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // 不在開放作答時間內
  const w = examWindow(exam)
  if (w !== 'open') return NextResponse.json({ error: w, opens_at: exam.opens_at, closes_at: exam.closes_at }, { status: 403 })
  const questions = await loadQuestions(admin, exam.id)
  return NextResponse.json({
    exam: { id: exam.id, title: exam.title, description: exam.description, pass_score: exam.pass_score, opens_at: exam.opens_at, closes_at: exam.closes_at },
    questions: publicQuestions(questions),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { admin, exam } = await loadPublic((await params).token)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // 截止後 5 分鐘內仍收卷（作答中剛好過截止時間）
  const w = examWindow(exam, Date.now() - 5 * 60 * 1000)
  if (w === 'ended') return NextResponse.json({ error: w, opens_at: exam.opens_at, closes_at: exam.closes_at }, { status: 403 })
  if (examWindow(exam) === 'not_yet') return NextResponse.json({ error: 'not_yet', opens_at: exam.opens_at, closes_at: exam.closes_at }, { status: 403 })

  const body = await req.json().catch(() => null) as { name?: unknown; contact?: unknown; lang?: unknown; answers?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const contact = typeof body?.contact === 'string' ? body.contact.trim().slice(0, 120) : ''
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  const lang = isExamLang(body?.lang) ? body!.lang : 'vi'

  const questions = await loadQuestions(admin, exam.id)
  const answers = sanitizeAnswers(questions, body?.answers)
  const graded = await gradeSubmission(questions, answers, lang)

  const { error } = await admin.from('exam_submissions').insert({
    exam_id: exam.id,
    company_id: exam.company_id,
    kind: 'public',
    taker_name: name,
    taker_contact: contact || null,
    lang,
    answers,
    ...graded,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 未開放「交卷後顯示答案」時，只回總分，不回各題對錯、評語與答案（答案只給檢查人在成績頁看）
  if (!exam.reveal_answers) {
    return NextResponse.json({ score: graded.score, max_score: graded.max_score, grading_status: graded.grading_status, results: {}, key: null })
  }
  return NextResponse.json({
    ...graded,
    key: answerKey(questions),
  })
}
