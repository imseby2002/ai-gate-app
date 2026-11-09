'use client'

// 作答者查看已公布的批改結果：每題得分、主管評語、自己的作答；正確答案依考卷「交卷後顯示答案」設定。
// 員工（登入）與員工專區共用；介面文字依作答語言（中／英／越）。
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ExamLang, ExamOption, L10n, QuestionType } from '@/lib/exams/types'

interface PubQuestion { id: string; type: QuestionType; question: L10n; options: ExamOption[]; points: number }
interface Result { score: number; max: number; correct?: boolean; feedback?: string; pending?: boolean }
interface KeyItem { type: QuestionType; answer: unknown; explanation: L10n }
interface Data {
  exam: { id: string; title: L10n; pass_score: number | null }
  submission: { lang: string | null; answers: Record<string, string | string[]>; results: Record<string, Result>; score: number; max_score: number; created_at: string }
  questions: PubQuestion[]
  key: Record<string, KeyItem> | null
}

const T = {
  zh: { title: '批改結果', score: (s: number, t: number) => `成績：${s} / ${t} 分`, pass: '及格', fail: '未及格', yourAnswer: '你的作答', correct: '正確答案', reference: '參考答案', explanation: '說明', feedback: '主管評語', none: '（未作答）', notReleased: '批改結果尚未公布。', submittedAt: '作答時間', yourChoice: '你的選擇' },
  en: { title: 'Graded result', score: (s: number, t: number) => `Score: ${s} / ${t}`, pass: 'Pass', fail: 'Not passed', yourAnswer: 'Your answer', correct: 'Correct answer', reference: 'Reference answer', explanation: 'Explanation', feedback: 'Reviewer feedback', none: '(no answer)', notReleased: 'The graded result has not been released yet.', submittedAt: 'Submitted', yourChoice: 'Your choice' },
  vi: { title: 'Kết quả chấm', score: (s: number, t: number) => `Điểm: ${s} / ${t}`, pass: 'Đạt', fail: 'Chưa đạt', yourAnswer: 'Bạn trả lời', correct: 'Đáp án đúng', reference: 'Đáp án tham khảo', explanation: 'Giải thích', feedback: 'Nhận xét của quản lý', none: '(chưa trả lời)', notReleased: 'Kết quả chấm chưa được công bố.', submittedAt: 'Thời gian nộp', yourChoice: 'Bạn chọn' },
}
const LANGS: { code: ExamLang; label: string }[] = [{ code: 'zh', label: '中文' }, { code: 'en', label: 'English' }, { code: 'vi', label: 'Tiếng Việt' }]
const pick = (l: L10n | undefined, lang: ExamLang) => (l ? l[lang] || l.zh || l.en || l.vi || '' : '')

export function ExamReview({ url }: { url: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState(false)
  const [lang, setLang] = useState<ExamLang>('zh')

  useEffect(() => {
    let alive = true
    fetch(url).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Data) => {
        if (!alive) return
        setData(d)
        const l = d.submission.lang
        if (l === 'zh' || l === 'en' || l === 'vi') setLang(l)
      })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [url])

  const t = T[lang]
  if (err) return <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-slate-500">{t.notReleased}</div>
  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>

  const { submission: s, questions, key } = data
  const pct = s.max_score ? (s.score / s.max_score) * 100 : 0
  const passed = data.exam.pass_score != null ? pct >= data.exam.pass_score : null

  const keyText = (q: PubQuestion): string => {
    const k = key?.[q.id]
    if (!k) return ''
    if (q.type === 'fill') return Object.values((k.answer ?? {}) as Record<string, string[]>).flat().join(' / ')
    if (q.type === 'short' || q.type === 'essay') return pick(k.answer as L10n, lang)
    return ''
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold flex-1">{pick(data.exam.title, lang)} · {t.title}</h1>
        <div className="flex gap-1">
          {LANGS.map(l => (
            <button key={l.code} type="button" onClick={() => setLang(l.code)}
              className={`px-2.5 py-1 rounded-full text-xs border ${lang === l.code ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600'}`}>{l.label}</button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="text-lg font-bold">{t.score(s.score, s.max_score)}</div>
        {passed != null && <span className={`text-xs px-2 py-0.5 rounded-full ${passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{passed ? t.pass : t.fail}</span>}
        <span className="text-xs text-slate-500 ml-auto">{t.submittedAt}：{new Date(s.created_at).toLocaleString(undefined, { hour12: false })}</span>
      </div>

      {questions.map((q, i) => {
        const r = s.results[q.id]
        const a = s.answers[q.id]
        const k = key?.[q.id]
        const correctKeys = k && (q.type === 'single' || q.type === 'multi') ? (Array.isArray(k.answer) ? k.answer as string[] : [String(k.answer)]) : []
        const chosen = Array.isArray(a) ? a : a ? [a] : []
        const border = !r ? 'border-slate-200' : r.correct ? 'border-emerald-200' : r.score > 0 ? 'border-amber-200' : 'border-rose-200'
        return (
          <div key={q.id} className={`rounded-xl border bg-white p-4 space-y-3 ${border}`}>
            <div className="flex items-start gap-2">
              <div className="font-medium flex-1 whitespace-pre-line">{i + 1}. {pick(q.question, lang)}</div>
              {r && <span className="text-sm font-semibold tabular-nums shrink-0">{r.score} / {r.max}</span>}
            </div>
            {(q.type === 'single' || q.type === 'multi') ? (
              <div className="space-y-1.5">
                {q.options.map(o => {
                  const isChosen = chosen.includes(o.key)
                  const isCorrect = correctKeys.includes(o.key)
                  return (
                    <div key={o.key} className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${isCorrect ? 'border-emerald-300 bg-emerald-50' : isChosen ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}>
                      <span className="flex-1">{o.key}. {pick(o.text, lang)}</span>
                      {isChosen && <span className="text-[11px] text-indigo-700">{t.yourChoice}</span>}
                      {isCorrect && <span className="text-[11px] text-emerald-700">✓ {t.correct}</span>}
                    </div>
                  )
                })}
                {!chosen.length && <div className="text-xs text-slate-500">{t.none}</div>}
              </div>
            ) : (
              <div className="text-sm"><span className="text-slate-500">{t.yourAnswer}：</span><span className="whitespace-pre-line">{Array.isArray(a) ? a.join(', ') : a?.trim() ? a : t.none}</span></div>
            )}
            {keyText(q) && <div className="text-sm"><span className="text-emerald-700 font-medium">{q.type === 'fill' ? t.correct : t.reference}：</span><span className="whitespace-pre-line">{keyText(q)}</span></div>}
            {k && pick(k.explanation, lang) && <div className="text-sm text-slate-600"><span className="font-medium">{t.explanation}：</span><span className="whitespace-pre-line">{pick(k.explanation, lang)}</span></div>}
            {r?.feedback && <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-sm"><span className="font-medium text-amber-800">{t.feedback}：</span><span className="whitespace-pre-line">{r.feedback}</span></div>}
          </div>
        )
      })}
    </div>
  )
}
