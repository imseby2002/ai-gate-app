import type { DeptAccess } from '@/lib/company/dept-access'
import { loadQuestions } from './server'
import type { L10n, QuestionType } from './types'

export interface QuestionWeakness {
  questionId: string
  position: number
  type: QuestionType
  question: L10n
  options: { key: string; text: L10n }[]
  answer: unknown
  explanation: L10n
  rubric?: L10n
  totalAttempts: number
  incorrectCount: number
  errorRate: number // 0 ~ 1
  avgScore: number
  maxPoints: number
  commonWrongAnswers: { answerText: string; count: number }[]
}

export interface ExamWeaknessSummary {
  examId: string
  examTitle: L10n
  department: string
  totalSubmissions: number
  weaknesses: QuestionWeakness[]
}

/**
 * 分析指定考卷所有作答紀錄，找出員工錯誤率最高、理解不足的弱點題目
 */
export async function analyzeExamWeaknesses(
  admin: DeptAccess['admin'],
  examId: string
): Promise<ExamWeaknessSummary | null> {
  const { data: examData } = await admin
    .from('exams')
    .select('id, title, department')
    .eq('id', examId)
    .maybeSingle()

  if (!examData) return null

  const [questions, { data: subsData }] = await Promise.all([
    loadQuestions(admin, examId),
    admin
      .from('exam_submissions')
      .select('id, answers, results')
      .eq('exam_id', examId),
  ])

  const subs = subsData ?? []
  const totalSubmissions = subs.length
  const weaknesses: QuestionWeakness[] = []

  for (const q of questions) {
    if (!q.id) continue
    let totalAttempts = 0
    let incorrectCount = 0
    let totalScore = 0
    const wrongAnswersMap: Record<string, number> = {}

    for (const sub of subs) {
      const answers = (sub.answers ?? {}) as Record<string, unknown>
      const results = (sub.results ?? {}) as Record<string, { score?: number; max?: number; correct?: boolean; feedback?: string }>
      const ans = answers[q.id]
      const res = results[q.id]

      if (ans !== undefined || res !== undefined) {
        totalAttempts++
      }

      const score = Number(res?.score ?? 0)
      totalScore += score
      const isCorrect = res?.correct === true || (res?.correct == null && score >= q.points)

      if (!isCorrect) {
        incorrectCount++
        if (ans !== undefined && ans !== null && ans !== '') {
          let ansStr = ''
          if (q.type === 'single' && typeof ans === 'string') {
            const opt = q.options.find(o => o.key === ans)
            const text = opt ? (opt.text.zh || opt.text.vi || opt.text.en) : ans
            ansStr = `${ans}. ${text}`
          } else if (q.type === 'multi' && Array.isArray(ans)) {
            ansStr = ans.map(k => {
              const opt = q.options.find(o => o.key === k)
              return opt ? `${k}. ${opt.text.zh || opt.text.vi || opt.text.en}` : k
            }).join('；')
          } else if (typeof ans === 'string') {
            ansStr = ans.slice(0, 100)
          } else {
            ansStr = JSON.stringify(ans).slice(0, 100)
          }
          wrongAnswersMap[ansStr] = (wrongAnswersMap[ansStr] ?? 0) + 1
        }
      }
    }

    const errorRate = totalAttempts > 0 ? incorrectCount / totalAttempts : 0
    const avgScore = totalAttempts > 0 ? totalScore / totalAttempts : 0

    const commonWrongAnswers = Object.entries(wrongAnswersMap)
      .map(([answerText, count]) => ({ answerText, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    if (incorrectCount > 0 || errorRate > 0) {
      weaknesses.push({
        questionId: q.id,
        position: q.position,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        rubric: q.rubric,
        totalAttempts,
        incorrectCount,
        errorRate,
        avgScore,
        maxPoints: q.points,
        commonWrongAnswers,
      })
    }
  }

  // 依錯誤率排序，錯誤率越高越排在前面
  weaknesses.sort((a, b) => b.errorRate - a.errorRate || b.incorrectCount - a.incorrectCount)

  return {
    examId: examData.id,
    examTitle: examData.title as L10n,
    department: examData.department,
    totalSubmissions,
    weaknesses,
  }
}