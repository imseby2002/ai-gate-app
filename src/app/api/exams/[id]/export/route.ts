/** GET /api/exams/[id]/export — 成績匯出 Excel（僅可管理者） */
import { NextRequest, NextResponse } from 'next/server'
import { getDeptAccess, canManageDept } from '@/lib/company/dept-access'
import { buildXlsx, type XlsxCell } from '@/lib/hr/xlsx'
import { loadExam, loadQuestions } from '@/lib/exams/server'
import type { QuestionResult } from '@/lib/exams/grade'

export const dynamic = 'force-dynamic'

const KIND: Record<string, string> = { employee: '員工', public: '應徵者' }
const STATUS: Record<string, string> = { graded: '已評分', pending: '待人工評分', reviewed: '已人工覆核' }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getDeptAccess()
  if (!access.ok) return NextResponse.json({ error: 'Forbidden' }, { status: access.status })
  const exam = await loadExam(access, (await params).id)
  if (!exam) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canManageDept(access, exam.department)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [questions, { data }] = await Promise.all([
    loadQuestions(access.admin, exam.id),
    access.admin.from('exam_submissions')
      .select('kind, taker_name, taker_contact, lang, answers, results, score, max_score, grading_status, created_at')
      .eq('exam_id', exam.id).order('created_at', { ascending: false }),
  ])

  const rows: XlsxCell[][] = [[
    '交卷時間', '身分', '姓名', '聯絡方式', '語言', '分數', '總分', '得分率', '狀態',
    ...questions.map((_, i) => `第 ${i + 1} 題`),
  ]]
  for (const s of data ?? []) {
    const results = (s.results ?? {}) as Record<string, QuestionResult>
    const answers = (s.answers ?? {}) as Record<string, string | string[]>
    const max = Number(s.max_score) || 0
    rows.push([
      new Date(s.created_at as string).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }),
      KIND[s.kind as string] ?? s.kind,
      s.taker_name as string,
      (s.taker_contact as string | null) ?? '',
      (s.lang as string | null) ?? '',
      Number(s.score),
      max,
      max ? `${Math.round(Number(s.score) / max * 100)}%` : '',
      STATUS[s.grading_status as string] ?? s.grading_status,
      ...questions.map(q => {
        const a = answers[q.id!]
        const r = results[q.id!]
        const text = Array.isArray(a) ? a.join(',') : (a ?? '')
        return `${String(text).slice(0, 200)}（${r ? `${r.score}/${r.max}` : '-'}）`
      }),
    ])
  }

  const title = exam.title.zh || exam.title.en || exam.title.vi || 'exam'
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
  const buf = buildXlsx('成績', rows)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${title}成績_${date}.xlsx`)}`,
    },
  })
}
