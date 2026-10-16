'use client'

// 作答元件：員工（登入）與應徵者（公開連結）共用。
// 介面文字跟著作答者選的語言（中／英／越），不跟網站語系。
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ExamLang, ExamOption, L10n, QuestionType } from '@/lib/exams/types'

interface PubQuestion { id: string; type: QuestionType; question: L10n; options: ExamOption[]; points: number }
interface Result { score: number; max: number; correct?: boolean; feedback?: string; pending?: boolean }
interface KeyItem { type: QuestionType; answer: unknown; explanation: L10n }

const LANGS: { code: ExamLang; label: string }[] = [
  { code: 'zh', label: '中文' }, { code: 'en', label: 'English' }, { code: 'vi', label: 'Tiếng Việt' },
]

const T = {
  zh: {
    name: '姓名', contact: '聯絡電話或 Email（選填）', submit: '交卷', submitting: '評分中...', submitted: '已交卷',
    needName: '請先輸入姓名', needAll: '還有題目沒作答，確定要交卷嗎？', failed: '交卷失敗，請再試一次', loadFailed: '找不到這份考試，或考試已關閉。',
    q: (i: number, n: number) => `第 ${i} 題／共 ${n} 題`, pts: (p: number) => `${p} 分`,
    types: { single: '單選', multi: '多選（可複選）', fill: '填空', short: '簡答', essay: '申論' } as Record<QuestionType, string>,
    fillPh: '請輸入答案', textPh: '請輸入你的回答',
    result: (s: number, t: number) => `你的成績：${s} / ${t} 分`, pending: '部分簡答／申論題將由主管評分，最終分數以評分後為準。',
    pass: '及格', fail: '未及格', review: '正確答案與說明', right: '✓ 正確', wrong: '✗ 錯誤', partial: '部分得分',
    yourAnswer: '你的作答', correct: '正確答案', reference: '參考答案', feedback: '評語', none: '（未作答）',
    thanks: '已收到你的作答，謝謝！',
  },
  en: {
    name: 'Full name', contact: 'Phone or email (optional)', submit: 'Submit', submitting: 'Grading...', submitted: 'Submitted',
    needName: 'Please enter your name first', needAll: 'Some questions are unanswered. Submit anyway?', failed: 'Submission failed, please try again', loadFailed: 'This exam was not found or is closed.',
    q: (i: number, n: number) => `Question ${i} / ${n}`, pts: (p: number) => `${p} pt${p > 1 ? 's' : ''}`,
    types: { single: 'Single choice', multi: 'Multiple choice (select all that apply)', fill: 'Fill in the blank', short: 'Short answer', essay: 'Essay' } as Record<QuestionType, string>,
    fillPh: 'Type your answer', textPh: 'Write your answer',
    result: (s: number, t: number) => `Your score: ${s} / ${t}`, pending: 'Some short-answer / essay questions will be graded by a manager; the final score may change.',
    pass: 'Pass', fail: 'Not passed', review: 'Answers & Explanations', right: '✓ Correct', wrong: '✗ Wrong', partial: 'Partial credit',
    yourAnswer: 'Your answer', correct: 'Correct answer', reference: 'Reference answer', feedback: 'Feedback', none: '(no answer)',
    thanks: 'Your answers have been received. Thank you!',
  },
  vi: {
    name: 'Họ và tên', contact: 'Số điện thoại hoặc email (không bắt buộc)', submit: 'Nộp bài', submitting: 'Đang chấm...', submitted: 'Đã nộp bài',
    needName: 'Vui lòng nhập họ và tên trước', needAll: 'Còn câu hỏi chưa trả lời. Vẫn nộp bài?', failed: 'Nộp bài thất bại, vui lòng thử lại', loadFailed: 'Không tìm thấy bài kiểm tra hoặc bài đã đóng.',
    q: (i: number, n: number) => `Câu ${i} / ${n}`, pts: (p: number) => `${p} điểm`,
    types: { single: 'Một lựa chọn', multi: 'Nhiều lựa chọn (chọn tất cả đáp án đúng)', fill: 'Điền vào chỗ trống', short: 'Trả lời ngắn', essay: 'Tự luận' } as Record<QuestionType, string>,
    fillPh: 'Nhập câu trả lời', textPh: 'Viết câu trả lời của bạn',
    result: (s: number, t: number) => `Kết quả của bạn: ${s} / ${t} điểm`, pending: 'Một số câu trả lời ngắn / tự luận sẽ do quản lý chấm; điểm cuối cùng có thể thay đổi.',
    pass: 'Đạt', fail: 'Chưa đạt', review: 'Đáp án & Giải thích', right: '✓ Đúng', wrong: '✗ Sai', partial: 'Đúng một phần',
    yourAnswer: 'Bạn trả lời', correct: 'Đáp án đúng', reference: 'Đáp án tham khảo', feedback: 'Nhận xét', none: '(chưa trả lời)',
    thanks: 'Đã nhận bài làm của bạn. Cảm ơn!',
  },
}

function pick(l: L10n | undefined, lang: ExamLang) {
  if (!l) return ''
  return l[lang] || l.zh || l.en || l.vi || ''
}

export function ExamTaker({ loadUrl, submitUrl, isPublic, defaultName }: {
  loadUrl: string
  submitUrl: string
  /** 應徵者公開作答：需填姓名與聯絡方式 */
  isPublic?: boolean
  defaultName?: string
}) {
  const [lang, setLang] = useState<ExamLang>('vi')
  const [data, setData] = useState<{ exam: { title: L10n; description: L10n; pass_score: number | null }; questions: PubQuestion[] } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState(defaultName ?? '')
  const [contact, setContact] = useState('')
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<{ score: number; max_score: number; grading_status: string; results: Record<string, Result>; key: Record<string, KeyItem> | null } | null>(null)
  const t = T[lang]

  useEffect(() => {
    try {
      const saved = localStorage.getItem('examLang')
      if (saved === 'zh' || saved === 'en' || saved === 'vi') { setLang(saved); return }
    } catch { /* ignore */ }
    const nav = (navigator.language || '').toLowerCase()
    setLang(nav.startsWith('zh') ? 'zh' : nav.startsWith('en') ? 'en' : 'vi')
  }, [])

  useEffect(() => {
    let alive = true
    fetch(loadUrl).then(r => (r.ok ? r.json() : Promise.reject())).then(d => { if (alive) setData(d) }).catch(() => { if (alive) setLoadError(true) })
    return () => { alive = false }
  }, [loadUrl])

  const chooseLang = (l: ExamLang) => {
    setLang(l)
    try { localStorage.setItem('examLang', l) } catch { /* ignore */ }
  }

  const setAns = (qid: string, v: string | string[]) => setAnswers(a => ({ ...a, [qid]: v }))

  const submit = async () => {
    if (!data) return
    if (isPublic && !name.trim()) { alert(t.needName); return }
    const missing = data.questions.some(q => {
      const v = answers[q.id]
      return Array.isArray(v) ? !v.length : !String(v ?? '').trim()
    })
    if (missing && !confirm(t.needAll)) return
    setSubmitting(true)
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, answers, name, contact }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setOutcome(await res.json())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      alert(t.failed)
    } finally {
      setSubmitting(false)
    }
  }

  const langBar = (
    <div className="flex justify-center gap-1">
      {LANGS.map(l => (
        <button key={l.code} type="button" onClick={() => chooseLang(l.code)}
          className={`px-3 py-1 rounded-full text-xs font-semibold ${l.code === lang ? 'bg-white text-indigo-700' : 'bg-indigo-500/60 text-white hover:bg-indigo-500'}`}>
          {l.label}
        </button>
      ))}
    </div>
  )

  if (loadError) return <div className="max-w-xl mx-auto p-8 text-center text-sm text-slate-500">{t.loadFailed}</div>
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>

  const { exam, questions } = data
  const done = !!outcome
  const percent = outcome && outcome.max_score ? Math.round(outcome.score / outcome.max_score * 100) : 0

  const renderKey = (q: PubQuestion) => {
    const k = outcome?.key?.[q.id]
    if (!k) return null
    let text = ''
    if (q.type === 'single') text = `${k.answer}. ${pick(q.options.find(o => o.key === k.answer)?.text, lang)}`
    else if (q.type === 'multi') text = (k.answer as string[]).map(a => `${a}. ${pick(q.options.find(o => o.key === a)?.text, lang)}`).join('；')
    else if (q.type === 'fill') { const f = k.answer as Record<string, string[]>; text = (f[lang]?.length ? f[lang] : [...(f.zh ?? []), ...(f.en ?? []), ...(f.vi ?? [])]).join(' / ') }
    else text = pick(k.answer as L10n, lang)
    return (
      <div className="space-y-1">
        <div><span className="font-medium">{q.type === 'short' || q.type === 'essay' ? t.reference : t.correct}：</span>{text}</div>
        {pick(k.explanation, lang) && <div className="text-slate-600">{pick(k.explanation, lang)}</div>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 px-6 py-6 text-white text-center space-y-3">
          {langBar}
          <h1 className="text-xl font-bold">{pick(exam.title, lang)}</h1>
          {pick(exam.description, lang) && <p className="text-xs text-indigo-100 whitespace-pre-line">{pick(exam.description, lang)}</p>}
        </div>

        {done && outcome && (
          <div className={`p-6 border-b text-center space-y-1 ${percent >= (exam.pass_score ?? 0) ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            {outcome.key ? (
              <>
                <div className="text-lg font-bold">{t.result(outcome.score, outcome.max_score)}</div>
                {exam.pass_score != null && <div className="text-sm font-semibold">{percent >= exam.pass_score ? t.pass : t.fail}（{percent}%）</div>}
                {outcome.grading_status === 'pending' && <div className="text-xs text-slate-600">{t.pending}</div>}
              </>
            ) : (
              <div className="text-base font-semibold">{t.thanks}</div>
            )}
          </div>
        )}

        <div className="p-6 space-y-6">
          {isPublic && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">{t.name}</span>
                <input value={name} disabled={done} maxLength={80} onChange={e => setName(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">{t.contact}</span>
                <input value={contact} disabled={done} maxLength={120} onChange={e => setContact(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm" />
              </label>
            </div>
          )}

          {questions.map((q, i) => {
            const r = outcome?.results?.[q.id]
            const v = answers[q.id]
            const border = !done || !outcome?.key ? 'border-slate-100' : r?.pending ? 'border-amber-200' : r?.correct ? 'border-emerald-200' : 'border-rose-200'
            return (
              <div key={q.id} className={`space-y-3 pt-4 border-t ${i === 0 ? 'border-t-0 pt-0' : ''}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-600">{t.q(i + 1, questions.length)} · {t.types[q.type]}</span>
                  <span className="text-slate-400">{t.pts(q.points)}</span>
                </div>
                <p className="font-medium text-sm text-slate-900 whitespace-pre-line">{pick(q.question, lang)}</p>

                {(q.type === 'single' || q.type === 'multi') && (
                  <div className="space-y-2">
                    {q.options.map(o => {
                      const checked = q.type === 'single' ? v === o.key : Array.isArray(v) && v.includes(o.key)
                      return (
                        <label key={o.key} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer text-sm hover:bg-slate-50">
                          <input
                            type={q.type === 'single' ? 'radio' : 'checkbox'}
                            name={q.id}
                            disabled={done}
                            checked={checked}
                            onChange={() => {
                              if (q.type === 'single') setAns(q.id, o.key)
                              else {
                                const cur = Array.isArray(v) ? v : []
                                setAns(q.id, cur.includes(o.key) ? cur.filter(x => x !== o.key) : [...cur, o.key])
                              }
                            }}
                          />
                          <span>{o.key}. {pick(o.text, lang)}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {q.type === 'fill' && (
                  <input value={String(v ?? '')} disabled={done} placeholder={t.fillPh} onChange={e => setAns(q.id, e.target.value)} className="w-full p-2.5 rounded-xl border text-sm" />
                )}
                {(q.type === 'short' || q.type === 'essay') && (
                  <textarea value={String(v ?? '')} disabled={done} placeholder={t.textPh} rows={q.type === 'essay' ? 8 : 4}
                    onChange={e => setAns(q.id, e.target.value)} className="w-full p-2.5 rounded-xl border text-sm" />
                )}

                {done && outcome?.key && r && (
                  <div className={`p-3 rounded-xl border text-sm space-y-1.5 ${border}`}>
                    <div className="font-semibold">
                      {r.pending ? t.pending : r.correct ? t.right : r.score > 0 ? `${t.partial} ${r.score}/${r.max}` : t.wrong}
                    </div>
                    {renderKey(q)}
                    {r.feedback && <div className="text-slate-600"><span className="font-medium">{t.feedback}：</span>{r.feedback}</div>}
                  </div>
                )}
              </div>
            )
          })}

          <button type="button" onClick={submit} disabled={done || submitting}
            className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {done ? t.submitted : submitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </div>
  )
}
