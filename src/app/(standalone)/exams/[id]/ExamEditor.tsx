'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, Check, Copy, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLocalizedDepartments } from '@/lib/org-units'
import { EXAM_LANGS, QUESTION_TYPES, emptyL10n, type ExamLang, type ExamQuestion, type L10n, type QuestionType } from '@/lib/exams/types'

interface Exam {
  id: string; department: string; title: L10n; description: L10n; status: 'draft' | 'published' | 'closed'
  audience: string[]; public_token: string | null; knowledge_doc_ids: string[]; pass_score: number | null; reveal_answers: boolean
}
interface Doc { id: string; department: string; title: string; char_count: number }

const LANG_LABEL: Record<ExamLang, string> = { zh: '中文', en: 'English', vi: 'Tiếng Việt' }

function newQuestion(type: QuestionType, position: number): ExamQuestion {
  const base = { position, type, question: emptyL10n(), rubric: emptyL10n(), explanation: emptyL10n(), points: type === 'essay' ? 10 : type === 'short' ? 5 : 1 }
  if (type === 'single' || type === 'multi') {
    return { ...base, options: ['A', 'B', 'C', 'D'].map(key => ({ key, text: emptyL10n() })), answer: type === 'single' ? 'A' : ['A'] }
  }
  if (type === 'fill') return { ...base, options: [], answer: { zh: [], en: [], vi: [] } }
  return { ...base, options: [], answer: emptyL10n() }
}

export function ExamEditor({ id }: { id: string }) {
  const t = useTranslations('Exams')
  const locale = useLocale()
  const router = useRouter()
  const depts = useMemo(() => getLocalizedDepartments(locale), [locale])

  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [submissionCount, setSubmissionCount] = useState(0)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loadError, setLoadError] = useState(false)
  const [editLang, setEditLang] = useState<ExamLang>(locale === 'vi' ? 'vi' : locale === 'en' ? 'en' : 'zh')
  const [counts, setCounts] = useState<Record<QuestionType, number>>({ single: 5, multi: 2, fill: 2, short: 1, essay: 0 })
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/exams/${id}`).then(r => (r.ok ? r.json() : Promise.reject())),
      fetch('/api/knowledge').then(r => (r.ok ? r.json() : { docs: [] })),
    ]).then(([e, k]) => {
      if (!alive) return
      setExam(e.exam); setQuestions(e.questions); setSubmissionCount(e.submission_count); setDocs(k.docs); setDirty(false)
    }).catch(() => { if (alive) setLoadError(true) })
    return () => { alive = false }
  }, [id, reloadKey])

  if (loadError) return <div className="max-w-3xl mx-auto px-6 py-10 text-sm text-muted-foreground">{t('loadFailed')}</div>
  if (!exam) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const locked = submissionCount > 0
  const setMeta = (patch: Partial<Exam>) => { setExam({ ...exam, ...patch }); setDirty(true) }
  const setQ = (i: number, patch: Partial<ExamQuestion>) => { setQuestions(qs => qs.map((q, j) => (j === i ? { ...q, ...patch } : q))); setDirty(true) }
  const setL = (l: L10n, v: string): L10n => ({ ...l, [editLang]: v })

  const saveAll = async (extra: Record<string, unknown> = {}) => {
    setSaving(true)
    const res = await fetch(`/api/exams/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: exam.department, title: exam.title, description: exam.description, audience: exam.audience,
        knowledge_doc_ids: exam.knowledge_doc_ids, pass_score: exam.pass_score, reveal_answers: exam.reveal_answers,
        ...(locked ? {} : { questions: questions.map((q, i) => ({ ...q, position: i })) }),
        ...extra,
      }),
    })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { alert(d.error === 'no_questions' ? t('noQuestionsToPublish') : d.error === 'has_submissions' ? t('locked') : t('saveFailed')); return false }
    setReloadKey(k => k + 1)
    return true
  }

  const generate = async () => {
    if (dirty && !(await saveAll())) return
    if (!exam.knowledge_doc_ids.length) { alert(t('needKnowledge')); return }
    setGenerating(true)
    const res = await fetch(`/api/exams/${id}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counts, topic, knowledge_doc_ids: exam.knowledge_doc_ids }),
    }).catch(() => null)
    setGenerating(false)
    const d = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      alert(d?.error === 'knowledge_too_long' ? t('knowledgeTooLong') : d?.error === 'too_many' ? t('tooMany', { max: d.max }) : t('generateFailed'))
      return
    }
    setReloadKey(k => k + 1)
  }

  const remove = async () => {
    if (!confirm(t('confirmDeleteExam'))) return
    const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/exams')
  }

  const publicUrl = exam.public_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/x/${exam.public_token}` : ''
  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0)
  const totalPoints = questions.reduce((s, q) => s + q.points, 0)

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/exams" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-xl font-bold flex-1 min-w-[12rem]">{exam.title[editLang] || exam.title.zh || exam.title.en || exam.title.vi || t('untitled')}</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${exam.status === 'published' ? 'bg-emerald-50 text-emerald-700' : exam.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{t(`status_${exam.status}`)}</span>
          <Link href={`/exams/${id}/results`}><Button size="sm" variant="outline"><BarChart3 className="h-3.5 w-3.5 mr-1" />{t('results')}</Button></Link>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('editLang')}</span>
          {EXAM_LANGS.map(l => (
            <button key={l} onClick={() => setEditLang(l)} className={`px-3 py-1 rounded-full border ${editLang === l ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>{LANG_LABEL[l]}</button>
          ))}
        </div>

        {/* 基本資料 */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold">{t('basicInfo')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t('department')}</span>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={exam.department} onChange={e => setMeta({ department: e.target.value })}>
                {depts.map(d => <option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t('examTitle')}（{LANG_LABEL[editLang]}）</span>
              <Input value={exam.title[editLang]} onChange={e => setMeta({ title: setL(exam.title, e.target.value) })} />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('description')}（{LANG_LABEL[editLang]}）</span>
            <textarea rows={2} className="w-full rounded-md border bg-background p-2 text-sm" value={exam.description[editLang]} onChange={e => setMeta({ description: setL(exam.description, e.target.value) })} />
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            {['employee', 'public'].map(a => (
              <label key={a} className="flex items-center gap-1.5">
                <input type="checkbox" checked={exam.audience.includes(a)}
                  onChange={() => setMeta({ audience: exam.audience.includes(a) ? exam.audience.filter(x => x !== a) : [...exam.audience, a] })} />
                {t(`audience_${a}`)}
              </label>
            ))}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={exam.reveal_answers} onChange={() => setMeta({ reveal_answers: !exam.reveal_answers })} />
              {t('revealAnswers')}
            </label>
            <label className="flex items-center gap-1.5">
              {t('passScore')}
              <Input className="w-20 h-8" type="number" min={0} max={100} value={exam.pass_score ?? ''} onChange={e => setMeta({ pass_score: e.target.value === '' ? null : Number(e.target.value) })} />%
            </label>
          </div>
          {exam.audience.includes('public') && exam.public_token && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">{t('publicLink')}</span>
              <code className="flex-1 bg-muted rounded px-2 py-1.5 break-all">{publicUrl}</code>
              <button className="h-8 w-8 rounded border flex items-center justify-center" onClick={() => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
          {exam.audience.includes('public') && !exam.public_token && <p className="text-xs text-muted-foreground">{t('publicLinkAfterSave')}</p>}
        </section>

        {/* 知識與 AI 出題 */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('knowledgeAndAi')}</h2>
            <Link href="/knowledge" className="text-xs text-primary hover:underline">{t('manageKnowledge')}</Link>
          </div>
          {!docs.length && <p className="text-sm text-muted-foreground">{t('noKnowledge')}</p>}
          <div className="max-h-56 overflow-y-auto space-y-1">
            {docs.map(d => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={exam.knowledge_doc_ids.includes(d.id)}
                  onChange={() => setMeta({ knowledge_doc_ids: exam.knowledge_doc_ids.includes(d.id) ? exam.knowledge_doc_ids.filter(x => x !== d.id) : [...exam.knowledge_doc_ids, d.id] })} />
                <span>{d.title}</span>
                <span className="text-xs text-muted-foreground">{depts.find(x => x.key === d.department)?.label ?? d.department} · {t('chars', { n: d.char_count.toLocaleString() })}</span>
              </label>
            ))}
          </div>
          {!locked && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {QUESTION_TYPES.map(qt => (
                  <label key={qt} className="space-y-1 text-xs">
                    <span className="font-medium">{t(`type_${qt}`)}</span>
                    <Input type="number" min={0} max={40} value={counts[qt]} onChange={e => setCounts({ ...counts, [qt]: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                ))}
              </div>
              <Input placeholder={t('topicPh')} value={topic} maxLength={500} onChange={e => setTopic(e.target.value)} />
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={generate} disabled={generating || !totalCount}>
                  {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  {generating ? t('generating') : t('generate', { n: totalCount })}
                </Button>
                <span className="text-xs text-muted-foreground">{t('generateHint')}</span>
              </div>
            </>
          )}
        </section>

        {/* 題目 */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t('questionsTitle', { n: questions.length, points: totalPoints })}</h2>
            {!locked && (
              <div className="flex flex-wrap gap-1">
                {QUESTION_TYPES.map(qt => (
                  <Button key={qt} size="sm" variant="outline" onClick={() => { setQuestions(qs => [...qs, newQuestion(qt, qs.length)]); setDirty(true) }}>
                    <Plus className="h-3.5 w-3.5 mr-0.5" />{t(`type_${qt}`)}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {locked && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('locked')}</div>}

          {questions.map((q, i) => (
            <div key={q.id ?? `new-${i}`} className="rounded-xl border bg-card p-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{i + 1}.</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{t(`type_${q.type}`)}</span>
                <label className="flex items-center gap-1 text-xs ml-auto">
                  {t('points')}
                  <Input className="w-16 h-7" type="number" min={1} max={100} disabled={locked} value={q.points} onChange={e => setQ(i, { points: Math.max(1, Number(e.target.value) || 1) })} />
                </label>
                {!locked && (
                  <div className="flex gap-1">
                    <button disabled={i === 0} onClick={() => { setQuestions(qs => { const c = [...qs]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c }); setDirty(true) }} className="p-1 rounded border disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button disabled={i === questions.length - 1} onClick={() => { setQuestions(qs => { const c = [...qs]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c }); setDirty(true) }} className="p-1 rounded border disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setQuestions(qs => qs.filter((_, j) => j !== i)); setDirty(true) }} className="p-1 rounded border text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>

              <textarea rows={2} disabled={locked} className="w-full rounded-md border bg-background p-2" placeholder={t('questionPh')}
                value={q.question[editLang]} onChange={e => setQ(i, { question: setL(q.question, e.target.value) })} />

              {(q.type === 'single' || q.type === 'multi') && (
                <div className="space-y-1.5">
                  {q.options.map((o, oi) => {
                    const correct = q.type === 'single' ? q.answer === o.key : (q.answer as string[]).includes(o.key)
                    return (
                      <div key={o.key} className="flex items-center gap-2">
                        <input type={q.type === 'single' ? 'radio' : 'checkbox'} disabled={locked} checked={correct} title={t('markCorrect')}
                          onChange={() => {
                            if (q.type === 'single') setQ(i, { answer: o.key })
                            else { const cur = q.answer as string[]; setQ(i, { answer: cur.includes(o.key) ? cur.filter(x => x !== o.key) : [...cur, o.key].sort() }) }
                          }} />
                        <span className="w-5 font-medium">{o.key}.</span>
                        <Input disabled={locked} className={correct ? 'border-emerald-400' : ''} value={o.text[editLang]}
                          onChange={e => setQ(i, { options: q.options.map((x, xi) => (xi === oi ? { ...x, text: setL(x.text, e.target.value) } : x)) })} />
                      </div>
                    )
                  })}
                  {!locked && q.options.length < 8 && (
                    <button className="text-xs text-primary" onClick={() => setQ(i, { options: [...q.options, { key: String.fromCharCode(65 + q.options.length), text: emptyL10n() }] })}>+ {t('addOption')}</button>
                  )}
                </div>
              )}
              {q.type === 'fill' && (
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('fillAnswers')}（{LANG_LABEL[editLang]}）</span>
                  <Input disabled={locked} value={((q.answer as Record<ExamLang, string[]>)[editLang] ?? []).join(' / ')}
                    onChange={e => setQ(i, { answer: { ...(q.answer as Record<ExamLang, string[]>), [editLang]: e.target.value.split('/').map(s => s.trim()).filter(Boolean) } })} />
                </label>
              )}
              {(q.type === 'short' || q.type === 'essay') && (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('referenceAnswer')}（{LANG_LABEL[editLang]}）</span>
                    <textarea rows={3} disabled={locked} className="w-full rounded-md border bg-background p-2" value={(q.answer as L10n)[editLang]}
                      onChange={e => setQ(i, { answer: setL(q.answer as L10n, e.target.value) })} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('rubric')}（{LANG_LABEL[editLang]}）</span>
                    <textarea rows={2} disabled={locked} className="w-full rounded-md border bg-background p-2" value={q.rubric[editLang]}
                      onChange={e => setQ(i, { rubric: setL(q.rubric, e.target.value) })} />
                  </label>
                </>
              )}
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('explanation')}（{LANG_LABEL[editLang]}）</span>
                <textarea rows={2} disabled={locked} className="w-full rounded-md border bg-background p-2" value={q.explanation[editLang]}
                  onChange={e => setQ(i, { explanation: setL(q.explanation, e.target.value) })} />
              </label>
            </div>
          ))}
        </section>

        {/* 操作 */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => saveAll()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button>
          {exam.status !== 'published' && <Button variant="outline" onClick={() => saveAll({ status: 'published' })} disabled={saving}>{t('publish')}</Button>}
          {exam.status === 'published' && <Button variant="outline" onClick={() => saveAll({ status: 'closed' })} disabled={saving}>{t('close')}</Button>}
          {exam.status !== 'draft' && <Button variant="outline" onClick={() => saveAll({ status: 'draft' })} disabled={saving}>{t('backToDraft')}</Button>}
          {dirty && <span className="text-xs text-amber-600">{t('unsaved')}</span>}
          <Button variant="outline" className="ml-auto text-red-600" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
