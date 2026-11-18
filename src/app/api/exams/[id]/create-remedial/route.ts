/**
 * POST /api/exams/[id]/create-remedial — 依指定考卷的員工歷史錯題弱點，自動建立並生成補強考卷
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { loadExam, questionRow } from '@/lib/exams/server'
import { analyzeExamWeaknesses } from '@/lib/exams/weakness'
import { generateExamQuestions, MAX_KNOWLEDGE_CHARS, type TypeCounts, type RemedialContext } from '@/lib/exams/generate'
import { QUESTION_TYPES } from '@/lib/exams/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const sourceExam = await loadExam(access, (await params).id)
  if (!sourceExam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, sourceExam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as {
    title?: { zh?: string; en?: string; vi?: string }
    counts?: Record<string, unknown>
    remedial_ratio?: number
    scope?: string
  } | null

  // 1. 分析歷史考卷錯題弱點
  const summary = await analyzeExamWeaknesses(access.admin, sourceExam.id)
  const sTitleZh = sourceExam.title.zh || sourceExam.title.vi || sourceExam.title.en || ''
  const sTitleVi = sourceExam.title.vi || sourceExam.title.zh || sourceExam.title.en || ''
  const sTitleEn = sourceExam.title.en || sourceExam.title.zh || sourceExam.title.vi || ''

  const newTitle = {
    zh: body?.title?.zh?.trim() || `[錯題補強] ${sTitleZh}`.trim(),
    vi: body?.title?.vi?.trim() || `[Ôn tập củng cố] ${sTitleVi}`.trim(),
    en: body?.title?.en?.trim() || `[Remedial] ${sTitleEn}`.trim(),
  }

  const newDesc = {
    zh: `針對前次測驗常見錯題與薄弱觀念進行深化理解的補強考卷，兼顧全新考點測驗。`,
    vi: `Bài thi củng cố chuyên sâu vào các điểm kiến thức còn yếu từ bài thi trước, kết hợp câu hỏi mới.`,
    en: `Remedial quiz reinforcing key concepts and frequent mistakes from the previous exam, mixed with fresh questions.`,
  }

  // 2. 建立新考卷草稿
  const { data: newExam, error: insExamErr } = await access.admin.from('exams').insert({
    company_id: access.companyId,
    department: sourceExam.department,
    title: newTitle,
    description: newDesc,
    status: 'draft',
    audience: sourceExam.audience,
    knowledge_doc_ids: sourceExam.knowledge_doc_ids,
    pass_score: sourceExam.pass_score,
    reveal_answers: sourceExam.reveal_answers,
    created_by: access.userId,
  }).select('id').single()

  if (insExamErr || !newExam) {
    return NextResponse.json({ error: insExamErr?.message || 'create_failed' }, { status: 500 })
  }

  // 3. 準備出題題數配置（預設單選 5 題、多選 2 題、填空 2 題、簡答 1 題）
  const counts: TypeCounts = {}
  let total = 0
  for (const t of QUESTION_TYPES) {
    const n = Math.max(0, Math.min(40, Math.round(Number(body?.counts?.[t]) || 0)))
    if (n) counts[t] = n
  }
  total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0)
  if (!total) {
    counts.single = 5
    counts.multi = 2
    counts.fill = 2
    counts.short = 1
  }

  // 4. 載入知識文件
  let docs: { id: string; title: string; content: string }[] = []
  if (sourceExam.knowledge_doc_ids.length) {
    const { data: docData } = await access.admin.from('knowledge_docs').select('id, title, content')
      .eq('company_id', access.companyId).in('id', sourceExam.knowledge_doc_ids)
    docs = (docData ?? []) as typeof docs
  }

  if (!docs.length) {
    // 即使沒有知識文件，考卷已建立成功，回傳考卷 ID 讓使用者進入自行編修
    return NextResponse.json({ id: newExam.id, questions_count: 0 })
  }

  const chars = docs.reduce((s, d) => s + d.content.length, 0)
  if (chars > MAX_KNOWLEDGE_CHARS) {
    return NextResponse.json({ id: newExam.id, questions_count: 0, warning: 'knowledge_too_long' })
  }

  // 5. 組織 RemedialContext
  const weaknesses = (summary?.weaknesses ?? []).map(w => ({
    questionText: w.question.zh || w.question.vi || w.question.en,
    type: w.type,
    correctAnswer: typeof w.answer === 'string' ? w.answer : JSON.stringify(w.answer),
    explanation: w.explanation.zh || w.explanation.vi || w.explanation.en,
    errorRate: w.errorRate,
    commonMistakes: w.commonWrongAnswers.length ? w.commonWrongAnswers.map(c => `${c.answerText} (${c.count}人)`).join('、') : undefined,
  }))

  const remedial: RemedialContext = {
    sourceExamId: sourceExam.id,
    sourceExamTitle: sTitleZh || sTitleVi || sTitleEn,
    weaknesses,
    remedialRatio: typeof body?.remedial_ratio === 'number' ? body.remedial_ratio : 0.5,
  }

  // 6. 生成混合考題（弱點深化 + 全新考點）
  try {
    const questions = await generateExamQuestions({
      knowledge: docs.map(d => ({ title: d.title, content: d.content })),
      counts,
      scope: typeof body?.scope === 'string' ? body.scope.slice(0, 500) : undefined,
      remedial,
      startPosition: 0,
    })

    if (questions.length) {
      await access.admin.from('exam_questions').insert(questions.map(q => questionRow(newExam.id, q)))
    }

    return NextResponse.json({ id: newExam.id, questions_count: questions.length })
  } catch (err) {
    console.error('[create-remedial-generate-failed]', err)
    // 考卷草稿已成功建立，仍回傳 ID 讓主管進入編輯頁
    return NextResponse.json({ id: newExam.id, questions_count: 0, warning: 'generate_partial_failed' })
  }
}