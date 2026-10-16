// 考試系統共用型別（前後端共用）
export const EXAM_LANGS = ['zh', 'en', 'vi'] as const
export type ExamLang = (typeof EXAM_LANGS)[number]
export type L10n = Record<ExamLang, string>

export const QUESTION_TYPES = ['single', 'multi', 'fill', 'short', 'essay'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export interface ExamOption { key: string; text: L10n }

export interface ExamQuestion {
  id?: string
  position: number
  type: QuestionType
  question: L10n
  options: ExamOption[]                 // single / multi 用
  /** single: "A"；multi: ["A","C"]；fill: 各語言可接受答案；short/essay: 參考答案 */
  answer: string | string[] | Record<ExamLang, string[]> | L10n
  rubric: L10n                          // short / essay 評分重點
  explanation: L10n
  points: number
}

export function isExamLang(v: unknown): v is ExamLang {
  return typeof v === 'string' && (EXAM_LANGS as readonly string[]).includes(v)
}
export function isQuestionType(v: unknown): v is QuestionType {
  return typeof v === 'string' && (QUESTION_TYPES as readonly string[]).includes(v)
}

export const emptyL10n = (): L10n => ({ zh: '', en: '', vi: '' })

export function toL10n(v: unknown): L10n {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    zh: typeof o.zh === 'string' ? o.zh : '',
    en: typeof o.en === 'string' ? o.en : '',
    vi: typeof o.vi === 'string' ? o.vi : '',
  }
}

/** 把任意輸入整理成合法題目（AI 產出與編輯存檔共用） */
export function normalizeQuestion(raw: unknown, position: number): ExamQuestion | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (!isQuestionType(r.type)) return null
  const type = r.type
  const question = toL10n(r.question)
  if (!question.zh && !question.en && !question.vi) return null
  const points = Math.max(1, Math.min(100, Math.round(Number(r.points) || (type === 'essay' ? 10 : type === 'short' ? 5 : 1))))
  const base = { position, type, question, rubric: toL10n(r.rubric), explanation: toL10n(r.explanation), points, ...(typeof r.id === 'string' ? { id: r.id } : {}) }

  if (type === 'single' || type === 'multi') {
    const opts = Array.isArray(r.options) ? r.options : []
    const options: ExamOption[] = opts.slice(0, 8).map((o, i) => {
      const oo = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
      return { key: String.fromCharCode(65 + i), text: toL10n(oo.text) }
    })
    if (options.length < 2) return null
    const keys = options.map(o => o.key)
    if (type === 'single') {
      const a = typeof r.answer === 'string' ? r.answer.trim().toUpperCase() : ''
      if (!keys.includes(a)) return null
      return { ...base, options, answer: a }
    }
    const arr = (Array.isArray(r.answer) ? r.answer : []).map(x => String(x).trim().toUpperCase()).filter(x => keys.includes(x))
    const uniq = [...new Set(arr)].sort()
    if (!uniq.length) return null
    return { ...base, options, answer: uniq }
  }
  if (type === 'fill') {
    const a = (r.answer && typeof r.answer === 'object' && !Array.isArray(r.answer) ? r.answer : {}) as Record<string, unknown>
    const list = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).map(x => String(x).trim()).filter(Boolean).slice(0, 10)
    const answer = { zh: list(a.zh), en: list(a.en), vi: list(a.vi) }
    if (!answer.zh.length && !answer.en.length && !answer.vi.length) return null
    return { ...base, options: [], answer }
  }
  return { ...base, options: [], answer: toL10n(r.answer) }
}
