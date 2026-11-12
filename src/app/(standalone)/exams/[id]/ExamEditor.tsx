'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, Check, Copy, Loader2, PenLine, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import { getLocalizedDepartments } from '@/lib/org-units'
import { EXAM_LANGS, QUESTION_TYPES, emptyL10n, type ExamLang, type ExamQuestion, type L10n, type QuestionType } from '@/lib/exams/types'

interface Exam {
  id: string; department: string; title: L10n; description: L10n; status: 'draft' | 'published' | 'closed'
  audience: string[]; public_token: string | null; knowledge_doc_ids: string[]; pass_score: number | null; reveal_answers: boolean
  opens_at: string | null; closes_at: string | null
}

// ISO 時間 ↔ <input type="datetime-local"> 的本地時間字串
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
interface Doc { id: string; department: string; title: string; char_count: number }

const LANG_LABEL: Record<ExamLang, string> = { zh: '中文', en: 'English', vi: 'Tiếng Việt' }

// 依內容自動長高的輸入框：題目、選項、答案一次看完整，不用在小框裡捲動
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
  const [scope, setScope] = useState('')
  const [manual, setManual] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [regenFeedback, setRegenFeedback] = useState('')
  const [regenerating, setRegenerating] = useState(false)
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
  // 已發布或已關閉的考卷只能檢視；要改題目請先「改回草稿」
  const readOnly = locked || exam.status !== 'draft'
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
        opens_at: exam.opens_at, closes_at: exam.closes_at,
        ...(locked ? {} : { questions: questions.map((q, i) => ({ ...q, position: i })) }),
        ...extra,
      }),
    })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { alert(d.error === 'no_questions' ? t('noQuestionsToPublish') : d.error === 'has_submissions' ? t('locked') : d.error === 'bad_window' ? t('openWindowInvalid') : t('saveFailed')); return false }
    setReloadKey(k => k + 1)
    return true
  }

  const generate = async () => {
    if (dirty && !(await saveAll())) return
    if (!exam.knowledge_doc_ids.length) { alert(t('needKnowledge')); return }
    setGenerating(true)
    const res = await fetch(`/api/exams/${id}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counts, topic, scope, knowledge_doc_ids: exam.knowledge_doc_ids }),
    }).catch(() => null)
    setGenerating(false)
    const d = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      alert(d?.error === 'knowledge_too_long' ? t('knowledgeTooLong') : d?.error === 'too_many' ? t('tooMany', { max: d.max }) : d?.detail ? `${t('generateFailed')} (${d.detail})` : t('generateFailed'))
      return
    }
    setReloadKey(k => k + 1)
  }

  // AI 單題重新出題（可給意見或不給意見）
  const regenerateQuestion = async (i: number) => {
    const q = questions[i]
    if (!q) return
    if (!exam.knowledge_doc_ids.length) { alert(t('needKnowledge')); return }
    setRegenerating(true)
    const res = await fetch(`/api/exams/${id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: q.id,
        position: i,
        type: q.type,
        points: q.points,
        current_question: q.question,
        feedback: regenFeedback.trim() || undefined,
        topic: topic.trim() || undefined,
        scope: scope.trim() || undefined,
        knowledge_doc_ids: exam.knowledge_doc_ids,
      }),
    }).catch(() => null)
    setRegenerating(false)
    const d = await res?.json().catch(() => ({}))
    if (!res?.ok || !d?.question) {
      alert(d?.detail ? `${t('generateFailed')} (${d.detail})` : t('generateFailed'))
      return
    }
    setQuestions(qs => qs.map((item, j) => (j === i ? d.question : item)))
    setRegenIdx(null)
    setRegenFeedback('')
    setDirty(true)
  }

  // 人工出題、AI 修飾：手寫題目交給 AI 整理成三語正式題目，新增在題目最後
  const polishManual = async () => {
    if (!manual.trim()) return
    if (dirty && !(await saveAll())) return
    setPolishing(true)
    const res = await fetch(`/api/exams/${id}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual, knowledge_doc_ids: exam.knowledge_doc_ids }),
    }).catch(() => null)
    setPolishing(false)
    const d = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      alert(d?.error === 'manual_too_long' ? t('manualTooLong', { max: d.max }) : d?.error === 'knowledge_too_long' ? t('knowledgeTooLong') : t('generateFailed'))
      return
    }
    setManual('')
    setReloadKey(k => k + 1)
  }

  // 發布後回到考試中心清單，不再停留在出題頁
  const publish = async () => {
    if (!confirm(t('publishConfirm'))) return
    if (await saveAll({ status: 'published' })) router.push('/exams')
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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
            <AutoTextarea minRows={2} value={exam.description[editLang]} onChange={e => setMeta({ description: setL(exam.description, e.target.value) })} />
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
          {/* 開放作答時間（空白＝不限） */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{t('openWindow')}</span>
            <Input type="datetime-local" className="w-auto h-9" value={toLocalInput(exam.opens_at)} onChange={e => setMeta({ opens_at: fromLocalInput(e.target.value) })} />
            <span className="text-muted-foreground">~</span>
            <Input type="datetime-local" className="w-auto h-9" value={toLocalInput(exam.closes_at)} onChange={e => setMeta({ closes_at: fromLocalInput(e.target.value) })} />
            <span className="text-xs text-muted-foreground">{t('openWindowHint')}</span>
          </div>
          {exam.opens_at && exam.closes_at && exam.closes_at <= exam.opens_at && <p className="text-xs text-red-600">{t('openWindowInvalid')}</p>}
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
          {!readOnly && (
            <>
              {/* 出題範圍與章節限定 */}
              <div className="space-y-2 p-3 rounded-xl border bg-muted/30 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-medium text-foreground flex items-center gap-1">
                    {t('scope')}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: t('scopeAll'), val: '' },
                      { label: t('scopeFirst3'), val: '前3章' },
                      { label: t('scopeFirst5'), val: '前5章' },
                      { label: t('scopeFirst30Pct'), val: '前30%' },
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setScope(p.val)}
                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          scope === p.val ? 'bg-primary text-primary-foreground border-primary font-medium' : 'bg-background hover:bg-accent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  className="h-8 text-xs bg-background"
                  placeholder={t('scopePh')}
                  value={scope}
                  maxLength={200}
                  onChange={e => setScope(e.target.value)}
                />
              </div>

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

        {/* 人工出題、AI 修飾 */}
        {!readOnly && (
          <section className="rounded-2xl border bg-card p-5 space-y-3">
            <div>
              <h2 className="font-semibold flex items-center gap-1.5"><PenLine className="h-4 w-4" />{t('manualTitle')}</h2>
              <p className="text-xs text-muted-foreground mt-1">{t('manualHint')}</p>
            </div>
            <AutoTextarea minRows={6} placeholder={t('manualPh')} value={manual} maxLength={20000} onChange={e => setManual(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={polishManual} disabled={polishing || !manual.trim()}>
                {polishing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                {polishing ? t('manualPolishing') : t('manualPolish')}
              </Button>
              <span className="text-xs text-muted-foreground">{t('manualPolishHint')}</span>
            </div>
          </section>
        )}

        {/* 題目 */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t('questionsTitle', { n: questions.length, points: totalPoints })}</h2>
            {!readOnly && (
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
          {!locked && readOnly && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{t('publishedReadOnly')}</div>}
          {!readOnly && questions.length > 0 && <p className="text-xs text-muted-foreground">{t('editHint')}</p>}

          {questions.map((q, i) => (
            <div key={q.id ?? `new-${i}`} className="rounded-xl border bg-card p-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{i + 1}.</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{t(`type_${q.type}`)}</span>
                <label className="flex items-center gap-1 text-xs ml-auto">
                  {t('points')}
                  <Input className="w-16 h-7" type="number" min={1} max={100} disabled={readOnly} value={q.points} onChange={e => setQ(i, { points: Math.max(1, Number(e.target.value) || 1) })} />
                </label>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={t('regenerateQuestion')}
                      onClick={() => {
                        if (regenIdx === i) { setRegenIdx(null); setRegenFeedback('') }
                        else { setRegenIdx(i); setRegenFeedback('') }
                      }}
                      className={`h-7 px-2 rounded border flex items-center gap-1 text-xs transition-colors ${
                        regenIdx === i ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 font-medium' : 'hover:bg-accent text-indigo-600'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t('regenerateQuestion')}</span>
                    </button>
                    <button disabled={i === 0} onClick={() => { setQuestions(qs => { const c = [...qs]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c }); setDirty(true) }} className="p-1 rounded border disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button disabled={i === questions.length - 1} onClick={() => { setQuestions(qs => { const c = [...qs]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c }); setDirty(true) }} className="p-1 rounded border disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setQuestions(qs => qs.filter((_, j) => j !== i)); setDirty(true) }} className="p-1 rounded border text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>

              {regenIdx === i && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      {t('regenerateTitle')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{t('regenerateHint')}</span>
                  </div>
                  <Input
                    className="h-8 text-xs bg-background"
                    placeholder={t('regenerateFeedbackPh')}
                    value={regenFeedback}
                    maxLength={500}
                    disabled={regenerating}
                    onChange={e => setRegenFeedback(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void regenerateQuestion(i) }}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={regenerating} onClick={() => { setRegenIdx(null); setRegenFeedback('') }}>
                      {t('cancel')}
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={regenerating} onClick={() => regenerateQuestion(i)}>
                      {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                      {regenerating ? t('regenerating') : t('regenerateConfirm')}
                    </Button>
                  </div>
                </div>
              )}

              <AutoTextarea minRows={3} disabled={readOnly} className="text-base" placeholder={t('questionPh')}
                value={q.question[editLang]} onChange={e => setQ(i, { question: setL(q.question, e.target.value) })} />

              {(q.type === 'single' || q.type === 'multi') && (
                <div className="space-y-1.5">
                  {q.options.map((o, oi) => {
                    const correct = q.type === 'single' ? q.answer === o.key : (q.answer as string[]).includes(o.key)
                    return (
                      <div key={o.key} className="flex items-start gap-2">
                        <input type={q.type === 'single' ? 'radio' : 'checkbox'} className="mt-3" disabled={readOnly} checked={correct} title={t('markCorrect')}
                          onChange={() => {
                            if (q.type === 'single') setQ(i, { answer: o.key })
                            else { const cur = q.answer as string[]; setQ(i, { answer: cur.includes(o.key) ? cur.filter(x => x !== o.key) : [...cur, o.key].sort() }) }
                          }} />
                        <span className="w-5 font-medium mt-2.5">{o.key}.</span>
                        <AutoTextarea minRows={1} disabled={readOnly} className={correct ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' : ''} value={o.text[editLang]}
                          onChange={e => setQ(i, { options: q.options.map((x, xi) => (xi === oi ? { ...x, text: setL(x.text, e.target.value) } : x)) })} />
                      </div>
                    )
                  })}
                  {!readOnly && q.options.length < 8 && (
                    <button className="text-xs text-primary" onClick={() => setQ(i, { options: [...q.options, { key: String.fromCharCode(65 + q.options.length), text: emptyL10n() }] })}>+ {t('addOption')}</button>
                  )}
                </div>
              )}
              {q.type === 'fill' && (
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">{t('fillAnswers')}（{LANG_LABEL[editLang]}）</span>
                  <Input disabled={readOnly} value={((q.answer as Record<ExamLang, string[]>)[editLang] ?? []).join(' / ')}
                    onChange={e => setQ(i, { answer: { ...(q.answer as Record<ExamLang, string[]>), [editLang]: e.target.value.split('/').map(s => s.trim()).filter(Boolean) } })} />
                </label>
              )}
              {(q.type === 'short' || q.type === 'essay') && (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('referenceAnswer')}（{LANG_LABEL[editLang]}）</span>
                    <AutoTextarea minRows={4} disabled={readOnly} value={(q.answer as L10n)[editLang]}
                      onChange={e => setQ(i, { answer: setL(q.answer as L10n, e.target.value) })} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('rubric')}（{LANG_LABEL[editLang]}）</span>
                    <AutoTextarea minRows={3} disabled={readOnly} value={q.rubric[editLang]}
                      onChange={e => setQ(i, { rubric: setL(q.rubric, e.target.value) })} />
                  </label>
                </>
              )}
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t('explanation')}（{LANG_LABEL[editLang]}）</span>
                <AutoTextarea minRows={2} disabled={readOnly} value={q.explanation[editLang]}
                  onChange={e => setQ(i, { explanation: setL(q.explanation, e.target.value) })} />
              </label>
            </div>
          ))}
        </section>

        {/* 操作 */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => saveAll()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button>
          {exam.status !== 'published' && <Button variant="outline" onClick={publish} disabled={saving}>{t('publish')}</Button>}
          {exam.status === 'published' && <Button variant="outline" onClick={() => saveAll({ status: 'closed' })} disabled={saving}>{t('close')}</Button>}
          {exam.status !== 'draft' && <Button variant="outline" onClick={() => saveAll({ status: 'draft' })} disabled={saving}>{t('backToDraft')}</Button>}
          {dirty && <span className="text-xs text-amber-600">{t('unsaved')}</span>}
          <Button variant="outline" className="ml-auto text-red-600" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
