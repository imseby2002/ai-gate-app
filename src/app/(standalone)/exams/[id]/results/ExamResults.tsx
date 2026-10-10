'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Download, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ExamLang, ExamQuestion, L10n } from '@/lib/exams/types'

interface Result { score: number; max: number; correct?: boolean; feedback?: string; pending?: boolean }
interface Sub {
  id: string; kind: string; taker_name: string; taker_contact: string | null; lang: string | null
  answers: Record<string, string | string[]>; results: Record<string, Result>
  score: number; max_score: number; grading_status: string; created_at: string
}

export function ExamResults({ id }: { id: string }) {
  const t = useTranslations('Exams')
  const locale = useLocale()
  const lang: ExamLang = locale === 'vi' ? 'vi' : locale === 'en' ? 'en' : 'zh'
  const pick = (l: L10n | undefined) => (l ? l[lang] || l.zh || l.en || l.vi : '')

  const [title, setTitle] = useState<L10n | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Sub | null>(null)
  const [edits, setEdits] = useState<Record<string, { score: number; feedback: string }>>({})
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/exams/${id}`).then(r => (r.ok ? r.json() : null)),
      fetch(`/api/exams/${id}/submissions`).then(r => (r.ok ? r.json() : null)),
    ]).then(([e, s]) => {
      if (!alive) return
      if (e) { setTitle(e.exam.title); setQuestions(e.questions) }
      if (s) setSubs(s.submissions)
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, reloadKey])

  const openSub = (s: Sub) => {
    setOpen(s)
    setEdits(Object.fromEntries(Object.entries(s.results).map(([qid, r]) => [qid, { score: r.score, feedback: r.feedback ?? '' }])))
  }

  const saveReview = async () => {
    if (!open) return
    setSaving(true)
    const res = await fetch(`/api/exams/${id}/submissions/${open.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results: edits }),
    })
    setSaving(false)
    if (!res.ok) { alert(t('saveFailed')); return }
    setOpen(null); setReloadKey(k => k + 1)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const avg = subs.length ? subs.reduce((s, x) => s + (x.max_score ? x.score / x.max_score : 0), 0) / subs.length * 100 : 0
  const answerText = (q: ExamQuestion, a: string | string[] | undefined) => {
    if (Array.isArray(a)) return a.join(', ') || t('noAnswer')
    return a?.trim() ? a : t('noAnswer')
  }
  const keyText = (q: ExamQuestion) => {
    if (q.type === 'single') return String(q.answer)
    if (q.type === 'multi') return (q.answer as string[]).join(', ')
    if (q.type === 'fill') return Object.values(q.answer as Record<string, string[]>).flat().join(' / ')
    return pick(q.answer as L10n)
  }

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/exams/${id}`} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-xl font-bold flex-1 min-w-[12rem]">{pick(title ?? undefined)} · {t('results')}</h1>
          <a href={`/api/exams/${id}/export`}><Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1" />{t('exportExcel')}</Button></a>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('summary', { n: subs.length, avg: avg.toFixed(0), pending: subs.filter(s => s.grading_status === 'pending').length })}
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
              {!subs.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{t('noSubmissions')}</td></tr>}
              {subs.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(s.created_at).toLocaleString(locale, { hour12: false })}</td>
                  <td className="px-3 py-2 font-medium">{s.taker_name}{s.taker_contact ? <span className="text-xs text-muted-foreground"> · {s.taker_contact}</span> : null}</td>
                  <td className="px-3 py-2 text-xs">{t(`kind_${s.kind}`)}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{s.score} / {s.max_score}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={s.grading_status === 'pending' ? 'text-amber-700' : 'text-muted-foreground'}>{t(`grading_${s.grading_status}`)}</span>
                  </td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => openSub(s)}>{t('review')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
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
                    <div><span className="text-muted-foreground">{t('takerAnswer')}：</span><span className="whitespace-pre-line">{answerText(q, open.answers[q.id!])}</span></div>
                    <div className="text-muted-foreground"><span>{t('correctAnswer')}：</span>{keyText(q)}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs">{t('score')}</span>
                      <Input className="w-20 h-8" type="number" min={0} max={r.max} value={e.score}
                        onChange={ev => setEdits({ ...edits, [q.id!]: { ...e, score: Math.max(0, Math.min(r.max, Number(ev.target.value) || 0)) } })} />
                      <span className="text-xs text-muted-foreground">/ {r.max}</span>
                      {r.pending && <span className="text-xs text-amber-700">{t('needsGrading')}</span>}
                    </div>
                    {(q.type === 'short' || q.type === 'essay') && (
                      <textarea rows={2} className="w-full rounded-md border bg-background p-2 text-sm" placeholder={t('feedbackPh')}
                        value={e.feedback} onChange={ev => setEdits({ ...edits, [q.id!]: { ...e, feedback: ev.target.value } })} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="p-3 border-t flex justify-end">
              <Button onClick={saveReview} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveReview')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
