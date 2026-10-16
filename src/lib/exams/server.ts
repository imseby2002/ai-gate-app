// 考試 API 共用（伺服器端）
import { randomBytes } from 'crypto'
import type { DeptAccess } from '@/lib/company/dept-access'
import { normalizeQuestion, toL10n, type ExamQuestion } from './types'

export interface ExamRow {
  id: string
  company_id: string
  department: string
  title: Record<string, string>
  description: Record<string, string>
  status: 'draft' | 'published' | 'closed'
  audience: string[]
  public_token: string | null
  knowledge_doc_ids: string[]
  pass_score: number | null
  reveal_answers: boolean
  created_at: string
  updated_at: string
}

export const EXAM_COLUMNS = 'id, company_id, department, title, description, status, audience, public_token, knowledge_doc_ids, pass_score, reveal_answers, created_at, updated_at'
export const QUESTION_COLUMNS = 'id, position, type, question, options, answer, rubric, explanation, points'

export function newPublicToken() {
  return randomBytes(12).toString('base64url')
}

export async function loadExam(access: DeptAccess, id: string): Promise<ExamRow | null> {
  const { data } = await access.admin.from('exams').select(EXAM_COLUMNS)
    .eq('id', id).eq('company_id', access.companyId).maybeSingle()
  return (data as ExamRow | null) ?? null
}

export async function loadQuestions(admin: DeptAccess['admin'], examId: string): Promise<ExamQuestion[]> {
  const { data } = await admin.from('exam_questions').select(QUESTION_COLUMNS).eq('exam_id', examId).order('position')
  return (data ?? []).map((q, i) => normalizeQuestion(q, i)).filter((q): q is ExamQuestion => !!q)
}

export function questionRow(examId: string, q: ExamQuestion) {
  return {
    exam_id: examId,
    position: q.position,
    type: q.type,
    question: q.question,
    options: q.options,
    answer: q.answer,
    rubric: q.rubric,
    explanation: q.explanation,
    points: q.points,
  }
}

export function parseExamMeta(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  if ('title' in body) out.title = toL10n(body.title)
  if ('description' in body) out.description = toL10n(body.description)
  if ('audience' in body && Array.isArray(body.audience)) {
    const a = body.audience.filter(x => x === 'employee' || x === 'public')
    out.audience = a.length ? [...new Set(a)] : ['employee']
  }
  if ('knowledge_doc_ids' in body && Array.isArray(body.knowledge_doc_ids)) {
    out.knowledge_doc_ids = body.knowledge_doc_ids.filter((x): x is string => typeof x === 'string').slice(0, 50)
  }
  if ('reveal_answers' in body) out.reveal_answers = !!body.reveal_answers
  if ('pass_score' in body) {
    const n = Number(body.pass_score)
    out.pass_score = body.pass_score === null || body.pass_score === '' || !Number.isFinite(n) ? null : Math.max(0, Math.min(100, Math.round(n)))
  }
  return out
}
