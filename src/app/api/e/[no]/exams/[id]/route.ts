/**
 * 員工專區作答（不需系統帳號，以員工專區登入身分作答，成績記在員工名下）
 * GET  — 題目（不含答案）；僅已發布且開放員工作答的考卷
 * POST — 交卷 { lang, answers } → 評分、存檔、回傳成績（依設定附正確答案與說明）
 */
import { NextRequest, NextResponse } from 'next/server'
import { portalEmployee } from '../../_auth'
import { EXAM_COLUMNS, examWindow, loadQuestions, type ExamRow } from '@/lib/exams/server'
import { answerKey, gradeSubmission, publicQuestions, sanitizeAnswers } from '@/lib/exams/grade'
import { isExamLang } from '@/lib/exams/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function load(req: NextRequest, params: Promise<{ no: string; id: string }>) {
  const { no, id } = await params
  const ctx = await portalEmployee(req, decodeURIComponent(no))
  if (!ctx) return { ctx: null, exam: null }
  const { data, error } = await ctx.admin.from('exams').select(EXAM_COLUMNS)
    .eq('id', id).eq('company_id', ctx.company.companyId).maybeSingle()
  if (error) console.error('[portal-exam] exams 查詢失敗', error)
  const exam = data as ExamRow | null
  if (!exam || exam.status !== 'published' || !exam.audience.includes('employee')) return { ctx, exam: null }
  return { ctx, exam }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string; id: string }> }) {
  const { ctx, exam } = await load(req, params)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // 不在開放作答時間內
  const w = examWindow(exam)
  if (w !== 'open') return NextResponse.json({ error: w, opens_at: exam.opens_at, closes_at: exam.closes_at }, { status: 403 })
  const questions = await loadQuestions(ctx.admin, exam.id)
  return NextResponse.json({
    exam: { id: exam.id, title: exam.title, description: exam.description, pass_score: exam.pass_score, opens_at: exam.opens_at, closes_at: exam.closes_at },
    questions: publicQuestions(questions),
    taker: { name: ctx.emp.name },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ no: string; id: string }> }) {
  const { ctx, exam } = await load(req, params)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  // 截止後 5 分鐘內仍收卷（作答中剛好過截止時間）
  const w = examWindow(exam, Date.now() - 5 * 60 * 1000)
  if (w === 'ended') return NextResponse.json({ error: w, opens_at: exam.opens_at, closes_at: exam.closes_at }, { status: 403 })
  if (examWindow(exam) === 'not_yet') return NextResponse.json({ error: 'not_yet', opens_at: exam.opens_at, closes_at: exam.closes_at }, { status: 403 })

  const body = await req.json().catch(() => null) as { lang?: unknown; answers?: unknown } | null
  const lang = isExamLang(body?.lang) ? body!.lang : 'vi'
  const questions = await loadQuestions(ctx.admin, exam.id)
  const answers = sanitizeAnswers(questions, body?.answers)
  const graded = await gradeSubmission(questions, answers, lang)

  const { error } = await ctx.admin.from('exam_submissions').insert({
    exam_id: exam.id,
    company_id: exam.company_id,
    kind: 'portal',
    hr_employee_id: ctx.emp.id,
    taker_name: ctx.emp.name || '-',
    taker_contact: ctx.emp.attendance_no ? `#${ctx.emp.attendance_no}${ctx.emp.store ? ` · ${ctx.emp.store}` : ''}` : null,
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
