'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Download, Loader2, Sparkles, TrendingDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import type { ExamLang, ExamQuestion, L10n } from '@/lib/exams/types'
import type { ExamWeaknessSummary } from '@/lib/exams/weakness'

interface Result { score: number; max: number; correct?: boolean; feedback?: string; pending?: boolean }
interface Sub {
  id: string; kind: string; taker_name: string; taker_contact: string | null; lang: string | null
  answers: Record<string, string | string[]>; results: Record<string, Result>
  score: number; max_score: number; grading_status: string; created_at: string; released_at: string | null
}

export function ExamResults({ id }: { id: string }) {
  const t = useTranslations('Exams')
  const locale = useLocale()
  const router = useRouter()
  const lang: ExamLang = locale === 'vi' ? 'vi' : locale === 'en' ? 'en' : 'zh'
  const pick = (l: L10n | undefined) => (l ? l[lang] || l.zh || l.en || l.vi : '')

  const [title, setTitle] = useState<L10n | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [weaknessSummary, setWeaknessSummary] = useState<ExamWeaknessSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Sub | null>(null)
  const [edits, setEdits] = useState<Record<string, { score: number; feedback: string }>>({})
  const [saving, setSaving] = useState(false)
  const [release, setRelease] = useState(true)
  const [showOpts, setShowOpts] = useState<Record<string, boolean>>({})
  const [reloadKey, setReloadKey] = useState(0)
  // 作答來源篩選：員工（系統帳號）、員工專區、應徵者
  const [kindFilter, setKindFilter] = useState<string>('all')

  // 補強考卷彈窗狀態
  const [remedialModalOpen, setRemedialModalOpen] = useState(false)
  const [creatingRemedial, setCreatingRemedial] = useState(false)
  const [remedialRatio, setRemedialRatio] = useState<number>(0.5)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/exams/${id}`).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/exams/${id}/submissions`).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/exams/${id}/weaknesses`).then(r => (r.ok ? r.json() : null)),
    ]).then(([e, s, w]) => {
      if (!alive) return
      if (e) { setTitle(e.exam.title); setQuestions(e.questions) }
      if (s) setSubs(s.submissions)
      if (w) setWeaknessSummary(w)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, reloadKey])

  const createRemedialExam = async () => {
    setCreatingRemedial(true)
    try {
      const res = await fetch(`/api/exams/${id}/create-remedial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remedial_ratio: remedialRatio }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error ? `${t('saveFailed')} (${data.error})` : t('saveFailed'))
        setCreatingRemedial(false)
        return
      }
      setRemedialModalOpen(false)
      router.push(`/exams/${data.id}`)
    } catch {
      alert(t('saveFailed'))
      setCreatingRemedial(false)
    }
  }

  const openSub = (s: Sub) => {
    setOpen(s)
    setRelease(true)
    setShowOpts({})
    setEdits(Object.fromEntries(Object.entries(s.results).map(([qid, r]) => [qid, { score: r.score, feedback: r.feedback ?? '' }])))
  }

  const saveReview = async () => {
    if (!open) return
    setSaving(true)
    const res = await fetch(`/api/exams/${id}/submissions/${open.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: edits, release }),
    })
    setSaving(false)
    if (!res.ok) { alert(t('saveFailed')); return }
    setOpen(null); setReloadKey(k => k + 1)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const kinds = ['employee', 'portal', 'public'].filter(k => subs.some(x => x.kind === k))
  const shown = kindFilter === 'all' ? subs : subs.filter(x => x.kind === kindFilter)
  const avg = shown.length ? shown.reduce((s, x) => s + (x.max_score ? x.score / x.max_score : 0), 0) / shown.length * 100 : 0
  const answerText = (q: ExamQuestion, a: string | string[] | undefined) => {
    if (q.type === 'single' && typeof a === 'string' && a) return optText(q, a)
    if (Array.isArray(a)) return (q.type === 'multi' ? a.map(k => optText(q, k)).join('；') : a.join(', ')) || t('noAnswer')
    return a?.trim() ? a : t('noAnswer')
  }
  const optText = (q: ExamQuestion, k: string) => `${k}. ${pick(q.options.find(o => o.key === k)?.text)}`
  const keyText = (q: ExamQuestion) => {
    if (q.type === 'single') return optText(q, String(q.answer))
    if (q.type === 'multi') return (q.answer as string[]).map(k => optText(q, k)).join('；')
    if (q.type === 'fill') return Object.values(q.answer as Record<string, string[]>).flat().join(' / ')
    return pick(q.answer as L10n)
  }

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/exams/${id}`} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-xl font-bold flex-1 min-w-[12rem]">{pick(title ?? undefined)} · {t('results')}</h1>
          {subs.length > 0 && (
            <Button size="sm" onClick={() => setRemedialModalOpen(true)} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:from-indigo-700 hover:to-violet-700">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />{t('createRemedialExam')}
            </Button>
          )}
          <a href={`/api/exams/${id}/export`}><Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" />{t('exportExcel')}</Button></a>
        </div>

        {/* 錯題與弱點診斷區塊 */}
        {weaknessSummary && weaknessSummary.totalSubmissions > 0 && (
          <div className="rounded-2xl border bg-card p-5 space-y-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <TrendingDown className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-semibold text-sm">{t('weaknessAnalysis')}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t('weaknessCount', { n: weaknessSummary.totalSubmissions, count: weaknessSummary.weaknesses.length })}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setRemedialModalOpen(true)} className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 mr-1" />{t('createRemedialExam')}
              </Button>
            </div>

            {weaknessSummary.weaknesses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center bg-muted/40 rounded-lg">{t('noWeaknessesYet')}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {weaknessSummary.weaknesses.slice(0, 6).map((w, idx) => (
                  <div key={w.questionId || idx} className="rounded-xl border border-amber-200/70 bg-amber-50/30 dark:bg-amber-950/10 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2 font-medium">
                      <span className="truncate flex-1 text-foreground">
                        #{w.position + 1}. {pick(w.question)}
                      </span>
                      <span className="shrink-0 px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                        {t('errorRate')} {(w.errorRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t('weaknessPoints', { max: w.maxPoints, avg: w.avgScore.toFixed(1), count: w.incorrectCount })}
                    </div>
                    {w.commonWrongAnswers.length > 0 && (
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-background/80 rounded px-2 py-1 border border-border/50">
                        <span className="font-medium text-amber-800 dark:text-amber-300">{t('commonWrong')}：</span>
                        {w.commonWrongAnswers.map((cw, i) => (
                          <span key={i} className="inline-block mr-2">
                            {cw.answerText} <span className="text-muted-foreground">({cw.count}人)</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-muted-foreground mr-auto">
            {t('summary', { n: shown.length, avg: avg.toFixed(0), pending: shown.filter(s => s.grading_status === 'pending').length })}
          </div>
          {kinds.length > 1 && ['all', ...kinds].map(k => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={`px-3 py-1 rounded-full border text-xs ${kindFilter === k ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
              {k === 'all' ? t('kindAll', { n: subs.length }) : `${t(`kind_${k}`)}（${subs.filter(x => x.kind === k).length}）`}
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">{t('submittedAt')}</th>
                <th className="text-left px-3 py-2">{t('takerName')}</th>
                <th className="text-left px-3 py-2">{t('takerKind')}</th>
                <th className="text-left px-3 py-2">{t('score')}</th>
                <th className="text-left px-3 py-2">{t('gradingStatus')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!shown.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{t('noSubmissions')}</td></tr>}
              {shown.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(s.created_at).toLocaleString(locale, { hour12: false })}</td>
                  <td className="px-3 py-2 font-medium">{s.taker_name}{s.taker_contact ? <span className="text-xs text-muted-foreground"> · {s.taker_contact}</span> : null}</td>
                  <td className="px-3 py-2 text-xs">{t(`kind_${s.kind}`)}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{s.score} / {s.max_score}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={s.grading_status === 'pending' ? 'text-amber-700' : 'text-muted-foreground'}>{t(`grading_${s.grading_status}`)}</span>
                    {s.released_at && <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{t('released')}</span>}
                  </td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => openSub(s)}>{t('review')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setOpen(null)}>
          <div className="bg-card rounded-2xl w-full max-w-7xl h-[94vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center gap-2">
              <div className="font-semibold flex-1">{open.taker_name} · {open.score} / {open.max_score}</div>
              <button onClick={() => setOpen(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {questions.map((q, i) => {
                const r = open.results[q.id!]
                const e = edits[q.id!]
                if (!r || !e) return null
                return (
                  <div key={q.id} className={`rounded-lg border p-3 space-y-2 ${r.pending ? 'border-amber-300' : r.correct ? 'border-emerald-200' : 'border-rose-200'}`}>
                    <div className="font-medium">{i + 1}. {pick(q.question)}</div>
                    {/* 左：作答內容；右：檢查人專用（正確／參考答案、評分重點、說明，不會給作答者）。寬螢幕並排，減少上下捲動 */}
                    <div className="grid lg:grid-cols-2 gap-3 items-start">
                      <div className="rounded-md border bg-background p-2.5">
                        <div className="text-xs font-medium text-muted-foreground mb-1">{t('takerAnswer')}</div>
                        <div className="whitespace-pre-line">{answerText(q, open.answers[q.id!])}</div>
                      </div>
                      <div className="rounded-md bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 p-2.5 space-y-1">
                        <div><span className="font-medium text-emerald-800 dark:text-emerald-300">{t('correctAnswer')}：</span><span className="whitespace-pre-line">{keyText(q)}</span></div>
                        {(q.type === 'single' || q.type === 'multi') && (
                          <div>
                            <button type="button" className="text-xs text-indigo-700 hover:underline" onClick={() => setShowOpts(v => ({ ...v, [q.id!]: !v[q.id!] }))}>
                              {showOpts[q.id!] ? t('hideOptions') : t('showOptions')}
                            </button>
                            {showOpts[q.id!] && (
                              <div className="mt-1.5 space-y-1">
                                {q.options.map(o => {
                                  const keys = Array.isArray(q.answer) ? q.answer as string[] : [String(q.answer)]
                                  const a = open.answers[q.id!]
                                  const chosen = Array.isArray(a) ? a.includes(o.key) : a === o.key
                                  const ok = keys.includes(o.key)
                                  return (
                                    <div key={o.key} className={`rounded border px-2 py-1 flex items-center gap-2 ${ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : chosen ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/30' : 'border-slate-200 bg-background'}`}>
                                      <span className="flex-1">{o.key}. {pick(o.text)}</span>
                                      {chosen && <span className="text-[11px] text-indigo-700">{t('takerChose')}</span>}
                                      {ok && <span className="text-[11px] text-emerald-700">✓</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        {(q.type === 'short' || q.type === 'essay') && pick(q.rubric) && (
                          <div><span className="font-medium text-emerald-800 dark:text-emerald-300">{t('rubric')}：</span><span className="whitespace-pre-line">{pick(q.rubric)}</span></div>
                        )}
                        {pick(q.explanation) && (
                          <div className="text-muted-foreground"><span className="font-medium">{t('explanation')}：</span><span className="whitespace-pre-line">{pick(q.explanation)}</span></div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 lg:items-start">
                    <div className="flex flex-wrap items-center gap-2 shrink-0 lg:pt-1.5">
                      <span className="text-xs">{t('score')}</span>
                      <Input className="w-20 h-8" type="number" min={0} max={r.max} value={e.score}
                        onChange={ev => setEdits({ ...edits, [q.id!]: { ...e, score: Math.max(0, Math.min(r.max, Number(ev.target.value) || 0)) } })} />
                      <span className="text-xs text-muted-foreground">/ {r.max}</span>
                      {r.pending && <span className="text-xs text-amber-700">{t('needsGrading')}</span>}
                    </div>
                    {(q.type === 'short' || q.type === 'essay') && (
                      <AutoTextarea minRows={2} placeholder={t('feedbackPh')}
                        value={e.feedback} onChange={ev => setEdits({ ...edits, [q.id!]: { ...e, feedback: ev.target.value } })} />
                    )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="p-3 border-t flex flex-wrap items-center justify-end gap-3">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer mr-auto" title={t('releaseTip')}>
                <input type="checkbox" checked={release} onChange={e => setRelease(e.target.checked)} />
                {t('releaseToTaker')}
                {open.released_at && <span className="text-xs text-emerald-700">（{t('releasedAt', { time: new Date(open.released_at).toLocaleString(undefined, { hour12: false }) })}）</span>}
              </label>
              <Button onClick={saveReview} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveReview')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 依錯題建立補強考卷彈窗 */}
      {remedialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !creatingRemedial && setRemedialModalOpen(false)}>
          <div className="bg-card rounded-2xl w-full max-w-lg p-6 space-y-5 border shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  {t('remedialModalTitle')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t('remedialModalDesc')}
                </p>
              </div>
              <button
                type="button"
                disabled={creatingRemedial}
                onClick={() => setRemedialModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {weaknessSummary && (
              <div className="rounded-xl border bg-muted/40 p-3 space-y-1 text-xs">
                <div className="font-medium text-foreground">
                  {t('weaknessCount', { n: weaknessSummary.totalSubmissions, count: weaknessSummary.weaknesses.length })}
                </div>
                {weaknessSummary.weaknesses.length > 0 && (
                  <p className="text-muted-foreground">
                    {t('remedialLoaded', {
                      n: weaknessSummary.weaknesses.length,
                      rate: (
                        (weaknessSummary.weaknesses.reduce((s, w) => s + w.errorRate, 0) /
                          weaknessSummary.weaknesses.length) *
                        100
                      ).toFixed(0),
                    })}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                {t('remedialRatio')}
              </label>
              <div className="space-y-2 text-xs">
                {[
                  { ratio: 0.5, label: t('remedialRatio50') },
                  { ratio: 0.7, label: t('remedialRatio70') },
                  { ratio: 1.0, label: t('remedialRatio100') },
                ].map(opt => (
                  <label
                    key={opt.ratio}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      remedialRatio === opt.ratio
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 font-medium'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="remedialRatio"
                      value={opt.ratio}
                      checked={remedialRatio === opt.ratio}
                      disabled={creatingRemedial}
                      onChange={() => setRemedialRatio(opt.ratio)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={creatingRemedial}
                onClick={() => setRemedialModalOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                disabled={creatingRemedial}
                onClick={createRemedialExam}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {creatingRemedial ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    {t('creatingRemedial')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    {t('createRemedialExam')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
