'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, BarChart3, ClipboardList, Loader2, Pencil, Plus, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLocalizedDepartments } from '@/lib/org-units'
import type { ExamLang, L10n } from '@/lib/exams/types'

interface ExamItem {
  id: string; department: string; title: L10n; status: 'draft' | 'published' | 'closed'; audience: string[]
  editable: boolean; question_count: number; submission_count?: number
  my_last: { score: number; max_score: number; grading_status: string; created_at: string } | null
}

export function ExamsPage() {
  const t = useTranslations('Exams')
  const locale = useLocale()
  const router = useRouter()
  const lang: ExamLang = locale === 'vi' ? 'vi' : locale === 'en' ? 'en' : 'zh'
  const depts = useMemo(() => getLocalizedDepartments(locale), [locale])
  const deptLabel = (k: string) => { const d = depts.find(x => x.key === k); return d ? `${d.icon} ${d.label}` : k }
  const title = (l: L10n) => l[lang] || l.zh || l.en || l.vi

  const [exams, setExams] = useState<ExamItem[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [managed, setManaged] = useState<string[] | null>([])
  const [loading, setLoading] = useState(true)
  const [noCompany, setNoCompany] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ department: '', title: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/exams')
      .then(r => { if (r.status === 403) { setNoCompany(true); return null } return r.ok ? r.json() : null })
      .then(d => { if (alive && d) { setExams(d.exams); setIsAdmin(d.isCompanyAdmin); setManaged(d.managedUnits) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const createDepts = depts.filter(d => isAdmin || (d.key !== 'system' && (managed ?? []).includes(d.key)))

  const create = async () => {
    if (!form.department || !form.title.trim()) return
    setBusy(true)
    const res = await fetch('/api/exams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: form.department, title: { [lang]: form.title.trim() } }),
    })
    setBusy(false)
    if (!res.ok) { alert(t('saveFailed')); return }
    const { id } = await res.json()
    router.push(`/exams/${id}`)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (noCompany) return <div className="max-w-3xl mx-auto px-6 py-10 text-sm text-muted-foreground">{t('noCompany')}</div>

  const mine = exams.filter(e => e.status === 'published' && e.audience.includes('employee'))
  const managing = exams.filter(e => e.editable)

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start gap-3">
          <Link href="/office" className="mt-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold">{t('myExams')}</h2>
          {!mine.length && <div className="text-sm text-muted-foreground">{t('noMyExams')}</div>}
          {mine.map(e => (
            <div key={e.id} className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-3">
              <ClipboardList className="h-5 w-5 text-indigo-500 shrink-0" />
              <div className="flex-1 min-w-[12rem]">
                <div className="font-medium">{title(e.title)}</div>
                <div className="text-xs text-muted-foreground">
                  {deptLabel(e.department)} · {t('questionCount', { n: e.question_count })}
                  {e.my_last && ` · ${t('lastScore', { score: e.my_last.score, max: e.my_last.max_score })}`}
                </div>
              </div>
              <Link href={`/exams/${e.id}/take`}><Button size="sm"><Play className="h-3.5 w-3.5 mr-1" />{e.my_last ? t('retake') : t('start')}</Button></Link>
            </div>
          ))}
        </section>

        {(createDepts.length > 0 || managing.length > 0) && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{t('manage')}</h2>
              {createDepts.length > 0 && !creating && (
                <Button size="sm" onClick={() => { setCreating(true); setForm({ department: createDepts[0].key, title: '' }) }}><Plus className="h-4 w-4 mr-1" />{t('create')}</Button>
              )}
            </div>
            {creating && (
              <div className="rounded-xl border bg-card p-4 grid sm:grid-cols-[12rem_1fr_auto] gap-2 items-end">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{t('department')}</span>
                  <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                    {createDepts.map(d => <option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">{t('examTitle')}</span>
                  <Input value={form.title} maxLength={120} onChange={e => setForm({ ...form, title: e.target.value })} />
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCreating(false)}>{t('cancel')}</Button>
                  <Button onClick={create} disabled={busy || !form.title.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('createGo')}</Button>
                </div>
              </div>
            )}
            {!managing.length && <div className="text-sm text-muted-foreground">{t('noManaged')}</div>}
            {managing.map(e => (
              <div key={e.id} className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-medium flex items-center gap-2">
                    {title(e.title) || t('untitled')}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${e.status === 'published' ? 'bg-emerald-50 text-emerald-700' : e.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{t(`status_${e.status}`)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {deptLabel(e.department)} · {t('questionCount', { n: e.question_count })} · {t('submissionCount', { n: e.submission_count ?? 0 })}
                    {' · '}{e.audience.map(a => t(`audience_${a}`)).join('、')}
                  </div>
                </div>
                <Link href={`/exams/${e.id}`}><Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5 mr-1" />{t('edit')}</Button></Link>
                <Link href={`/exams/${e.id}/results`}><Button size="sm" variant="outline"><BarChart3 className="h-3.5 w-3.5 mr-1" />{t('results')}</Button></Link>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
