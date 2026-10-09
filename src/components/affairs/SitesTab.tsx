'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, MapPin, BarChart3, Loader2, CalendarClock, CheckSquare, Square, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SITE_CATEGORIES, SITE_STATUSES, SITE_SUBTYPES } from '@/lib/affairs/records'
import { Chips, Field, Modal, selectCls, textareaCls, useRecords, fmtNum, type Row } from './shared'

const STATUS_COLOR: Record<string, string> = {
  prospect: 'bg-slate-100 text-slate-700', visiting: 'bg-sky-100 text-sky-700', negotiating: 'bg-amber-100 text-amber-800',
  applying: 'bg-violet-100 text-violet-700', reviewing: 'bg-indigo-100 text-indigo-700', approved: 'bg-emerald-100 text-emerald-700',
  signed: 'bg-green-600 text-white', rejected: 'bg-red-100 text-red-700', dropped: 'bg-zinc-200 text-zinc-600',
}

interface Step { step: string; done: boolean; due: string; note: string }

export function SitesTab() {
  const t = useTranslations('AffairsX')
  const locale = useLocale()
  const sites = useRecords<Row>('sites')
  const contacts = useRecords<Row>('contacts')
  const [cat, setCat] = useState<'all' | (typeof SITE_CATEGORIES)[number]>('all')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Partial<Row> | null>(null)
  const [analysing, setAnalysing] = useState<Row | null>(null)

  const list = sites.items.filter(s => (cat === 'all' || s.category === cat) && (!status || s.status === status))
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of sites.items) c[s.status] = (c[s.status] ?? 0) + 1
    return c
  }, [sites.items])

  const contactName = (id: string | null) => {
    const c = contacts.items.find(x => x.id === id)
    return c ? [c.name, c.organization].filter(Boolean).join(' · ') : ''
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Chips value={cat} onChange={setCat} options={[['all', t('all')], ...SITE_CATEGORIES.map(c => [c, t(`cat.${c}`)] as [typeof c, string])]} />
        <div className="flex gap-2">
          <select className={`${selectCls} w-40`} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{t('allStatuses')}</option>
            {SITE_STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}{counts[s] ? ` (${counts[s]})` : ''}</option>)}
          </select>
          <Button size="sm" className="gap-1" onClick={() => setEditing({ category: cat === 'all' ? 'street' : cat, status: 'prospect', application: [] })}>
            <Plus className="h-4 w-4" />{t('newSite')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t('sitesHint')}</p>

      {sites.loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t('noSites')}</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map(s => {
            const steps: Step[] = Array.isArray(s.application) ? s.application : []
            const done = steps.filter(x => x.done).length
            const score = s.analysis?.score
            return (
              <Card key={s.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t(`cat.${s.category}`)}{s.subtype ? ` · ${t(`sub.${s.subtype}`)}` : ''}{s.floor ? ` · ${s.floor}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[s.status] ?? ''}`}>{t(`status.${s.status}`)}</span>
                </div>
                {s.address && <div className="flex items-start gap-1 text-sm"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />{s.address}</div>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {s.monthly_rent != null && <span>{t('rentShort')} {fmtNum(s.monthly_rent, locale)}</span>}
                  {s.area_sqm != null && <span>{fmtNum(s.area_sqm, locale)} m²</span>}
                  {s.households != null && <span>{t('householdsShort', { n: fmtNum(s.households, locale) })}</span>}
                  {s.contact_id && <span>{contactName(s.contact_id)}</span>}
                  {steps.length > 0 && <span>{t('applicationProgress', { done, total: steps.length })}</span>}
                  {s.application_deadline && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{s.application_deadline}</span>}
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setAnalysing(s)}>
                    <BarChart3 className="h-3.5 w-3.5" />{t('marketAnalysis')}
                    {score != null && <span className="ml-1 font-semibold">{score}</span>}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => { if (confirm(t('confirmDelete'))) sites.remove(s.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && <SiteModal site={editing} contacts={contacts.items} onClose={() => setEditing(null)}
        onSave={async row => { const err = await sites.save(row); if (!err) setEditing(null); return err }} />}
      {analysing && <AnalysisModal site={analysing} onClose={() => setAnalysing(null)} onDone={() => sites.reload()} />}
    </div>
  )
}

function defaultSteps(t: ReturnType<typeof useTranslations>, category: string): Step[] {
  const keys = category === 'public' ? ['pub1', 'pub2', 'pub3', 'pub4', 'pub5', 'pub6'] : ['pri1', 'pri2', 'pri3', 'pri4']
  return keys.map(k => ({ step: t(`stepTpl.${k}`), done: false, due: '', note: '' }))
}

function SiteModal({ site, contacts, onClose, onSave }: { site: Partial<Row>; contacts: Row[]; onClose: () => void; onSave: (r: Partial<Row>) => Promise<string | null> }) {
  const t = useTranslations('AffairsX')
  const [f, setF] = useState<Partial<Row>>(site)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }))
  const steps: Step[] = Array.isArray(f.application) ? f.application : []
  const setSteps = (s: Step[]) => set('application', s)
  const needsApplication = f.category === 'public' || f.category === 'private'
  const relevantContacts = contacts.filter(c => f.category === 'street' ? c.category === 'landlord' : f.category === 'mall' ? c.category === 'mall' : c.category === f.category || c.category === 'other')

  const submit = async () => {
    setBusy(true)
    const e = await onSave(f)
    setBusy(false)
    if (e) setErr(e)
  }

  return (
    <Modal title={f.id ? t('editSite') : t('newSite')} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('f.name')}><Input value={f.name ?? ''} onChange={e => set('name', e.target.value)} /></Field>
        <Field label={t('f.status')}>
          <select className={selectCls} value={f.status ?? 'prospect'} onChange={e => set('status', e.target.value)}>
            {SITE_STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </Field>
        <Field label={t('f.category')}>
          <select className={selectCls} value={f.category ?? 'street'} onChange={e => setF(p => ({ ...p, category: e.target.value, subtype: '' }))}>
            {SITE_CATEGORIES.map(c => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
          </select>
        </Field>
        <Field label={t('f.subtype')}>
          <select className={selectCls} value={f.subtype ?? ''} onChange={e => set('subtype', e.target.value)}>
            <option value="">—</option>
            {(SITE_SUBTYPES[f.category ?? 'street'] ?? []).map(s => <option key={s} value={s}>{t(`sub.${s}`)}</option>)}
          </select>
        </Field>
        <Field label={t('f.address')} className="sm:col-span-2"><Input value={f.address ?? ''} onChange={e => set('address', e.target.value)} /></Field>
        <Field label={t('f.region')}><Input value={f.region ?? ''} onChange={e => set('region', e.target.value)} placeholder={t('regionPh')} /></Field>
        <Field label={t('f.floor')}><Input value={f.floor ?? ''} onChange={e => set('floor', e.target.value)} /></Field>
        <Field label={t('f.area')}><Input type="number" value={f.area_sqm ?? ''} onChange={e => set('area_sqm', e.target.value)} /></Field>
        <Field label={t('f.frontage')}><Input type="number" value={f.frontage_m ?? ''} onChange={e => set('frontage_m', e.target.value)} /></Field>
        <Field label={t('f.rent')}><Input type="number" value={f.monthly_rent ?? ''} onChange={e => set('monthly_rent', e.target.value)} /></Field>
        <Field label={t('f.deposit')}><Input type="number" value={f.deposit ?? ''} onChange={e => set('deposit', e.target.value)} /></Field>
        {f.category === 'mall' && (
          <Field label={t('f.households')}><Input type="number" value={f.households ?? ''} onChange={e => set('households', e.target.value)} /></Field>
        )}
        <Field label={t('f.contact')}>
          <select className={selectCls} value={f.contact_id ?? ''} onChange={e => set('contact_id', e.target.value)}>
            <option value="">—</option>
            {relevantContacts.map(c => <option key={c.id} value={c.id}>{[c.name, c.organization].filter(Boolean).join(' · ')}</option>)}
          </select>
        </Field>
      </div>

      {needsApplication && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{t('applicationTitle')}</div>
              <div className="text-xs text-muted-foreground">{t('applicationHint')}</div>
            </div>
            <Field label={t('f.deadline')} className="w-40"><Input type="date" value={f.application_deadline ?? ''} onChange={e => set('application_deadline', e.target.value)} /></Field>
          </div>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button onClick={() => setSteps(steps.map((x, j) => j === i ? { ...x, done: !x.done } : x))}>
                {s.done ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4 text-muted-foreground" />}
              </button>
              <Input className="h-8 flex-1" value={s.step} onChange={e => setSteps(steps.map((x, j) => j === i ? { ...x, step: e.target.value } : x))} />
              <Input className="h-8 w-36" type="date" value={s.due} onChange={e => setSteps(steps.map((x, j) => j === i ? { ...x, due: e.target.value } : x))} />
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { step: '', done: false, due: '', note: '' }])}>{t('addStep')}</Button>
            {steps.length === 0 && <Button size="sm" variant="outline" onClick={() => setSteps(defaultSteps(t, f.category ?? 'public'))}>{t('useTemplate')}</Button>}
          </div>
        </div>
      )}

      <Field label={t('f.notes')}><textarea className={textareaCls} value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={submit} disabled={busy || !f.name}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}{t('save')}</Button>
      </div>
    </Modal>
  )
}

const LEVEL_COLOR: Record<string, string> = { high: 'text-emerald-600', medium: 'text-amber-600', low: 'text-red-600' }

function AnalysisModal({ site, onClose, onDone }: { site: Row; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('AffairsX')
  const locale = useLocale()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI 分析結果為自由格式 JSON
  const [a, setA] = useState<Record<string, any> | null>(site.analysis ?? null)
  const [at, setAt] = useState<string | null>(site.analysis_at ?? null)
  const [radius, setRadius] = useState(String(site.analysis?.radius_m ?? 1000))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const run = async () => {
    setBusy(true); setErr('')
    const res = await fetch('/api/affairs/ai/site-analysis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: site.id, radius_m: Number(radius) }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(d.error ?? res.statusText); return }
    setA(d.analysis); setAt(d.analysis_at); onDone()
  }

  const lvl = (v?: string) => v ? <span className={`font-semibold ${LEVEL_COLOR[v] ?? ''}`}>{t(`level.${v}`)}</span> : '—'
  const n = (v: unknown) => fmtNum(v, locale)

  return (
    <Modal title={`${t('marketAnalysis')} · ${site.name}`} onClose={onClose} wide>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('radius')} className="w-36">
          <select className={selectCls} value={radius} onChange={e => setRadius(e.target.value)}>
            {[500, 1000, 2000, 3000].map(r => <option key={r} value={r}>{r} m</option>)}
          </select>
        </Field>
        <Button onClick={run} disabled={busy} className="gap-1">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}{a ? t('rerunAnalysis') : t('runAnalysis')}
        </Button>
        <span className="text-xs text-muted-foreground">{busy ? t('analysisRunning') : at ? t('analysisAt', { at: new Date(at).toLocaleString(locale) }) : t('analysisHint')}</span>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {a && (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
            <div className="text-center">
              <div className="text-3xl font-bold">{a.score ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{a.recommendation ? t(`reco.${a.recommendation}`) : ''}</div>
            </div>
            <p className="flex-1">{a.summary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Section title={t('sec.population')}>
              <KV k={t('residents')} v={n(a.population?.residents)} />
              <KV k={t('density')} v={n(a.population?.density_per_km2)} />
              <Note s={a.population?.note} />
            </Section>
            <Section title={t('sec.income')}>
              <KV k={t('perCapita')} v={`${n(a.income?.per_capita_monthly)} ${a.income?.currency ?? ''}`} />
              <KV k={t('levelLabel')} v={lvl(a.income?.level)} />
              <Note s={a.income?.note} />
            </Section>
            <Section title={t('sec.demographics')}>
              {(a.demographics?.age_groups ?? []).map((g: { label: string; share_pct: number | null }, i: number) => <KV key={i} k={g.label} v={`${n(g.share_pct)}%`} />)}
              <Note s={a.demographics?.composition} />
              <Note s={a.demographics?.note} />
            </Section>
            <Section title={t('sec.traffic')}>
              <KV k={t('footTraffic')} v={lvl(a.foot_traffic?.level)} />
              <KV k={t('peakHours')} v={a.foot_traffic?.peak_hours || '—'} />
              <Note s={a.foot_traffic?.note} />
              <KV k={t('vehicleTraffic')} v={lvl(a.vehicle_traffic?.level)} />
              <Note s={a.vehicle_traffic?.note} />
            </Section>
            <Section title={t('sec.storefront')}>
              <KV k={t('visibility')} v={lvl(a.storefront?.visibility)} />
              <Note s={a.storefront?.note} />
            </Section>
            <Section title={t('sec.rent')}>
              <KV k={t('rentEstimate')} v={`${n(a.rent?.estimate_monthly)} ${a.rent?.currency ?? ''}`} />
              <Note s={a.rent?.note} />
            </Section>
          </div>

          <ListTable title={t('sec.schools')} rows={a.schools} cols={[['name', t('col.name')], ['type', t('col.type')], ['students', t('col.students')], ['distance_m', t('col.distance')]]} />
          <ListTable title={t('sec.residential')} rows={a.residential} cols={[['name', t('col.name')], ['households', t('col.households')], ['distance_m', t('col.distance')], ['note', t('col.note')]]} />
          <ListTable title={t('sec.competitors')} rows={a.competitors} cols={[['name', t('col.name')], ['distance_m', t('col.distance')], ['note', t('col.note')]]} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Section title={t('sec.opportunities')}><ul className="list-disc pl-5 space-y-1">{(a.opportunities ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Section>
            <Section title={t('sec.risks')}><ul className="list-disc pl-5 space-y-1">{(a.risks ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></Section>
          </div>

          {(a.sources ?? []).length > 0 && (
            <Section title={t('sources')}>
              <ul className="space-y-1">
                {a.sources.map((s: { url: string; title: string }) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs"><ExternalLink className="h-3 w-3" />{s.title}</a></li>
                ))}
              </ul>
            </Section>
          )}
          <p className="text-xs text-muted-foreground">{t('aiDisclaimer')}</p>
        </div>
      )}
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border p-3 space-y-1"><div className="font-semibold text-sm mb-1">{title}</div>{children}</div>
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>
}
function Note({ s }: { s?: string }) {
  return s ? <p className="text-xs text-muted-foreground">{s}</p> : null
}
function ListTable({ title, rows, cols }: { title: string; rows?: Record<string, unknown>[]; cols: [string, string][] }) {
  const locale = useLocale()
  if (!rows?.length) return null
  return (
    <Section title={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground text-left">{cols.map(([k, l]) => <th key={k} className="py-1 pr-3 font-medium">{l}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {cols.map(([k]) => <td key={k} className="py-1 pr-3">{typeof r[k] === 'number' ? fmtNum(r[k], locale) : String(r[k] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
