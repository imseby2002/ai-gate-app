'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, Trash2, Loader2, Sparkles, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SITE_SUBTYPES } from '@/lib/affairs/records'
import { Field, selectCls, useRecords, todayStr, fmtNum, type Row } from './shared'

const ALL_SUBTYPES = Object.values(SITE_SUBTYPES).flat()

interface AiResult {
  summary?: string
  typical_rent_per_sqm?: number | null
  currency?: string
  trend?: string
  trend_note?: string
  negotiation_tips?: string[]
  listings: { address: string; area_sqm: number | null; monthly_rent: number; currency: string; observed_at: string; source_url: string; note: string }[]
  sources: { url: string; title: string }[]
}

// 每坪/每平方公尺租金，沒有面積時無法比較
const perSqm = (r: Row) => (r.area_sqm ? Number(r.monthly_rent) / Number(r.area_sqm) : null)

export function RentsTab() {
  const t = useTranslations('AffairsX')
  const locale = useLocale()
  const rents = useRecords<Row>('rents')
  const contacts = useRecords<Row>('contacts')
  const regions = useMemo(() => [...new Set(rents.items.map(r => r.region).filter(Boolean))].sort(), [rents.items])
  const [region, setRegion] = useState('')
  const active = region || regions[0] || ''
  const rows = rents.items.filter(r => r.region === active)
  const landlords = contacts.items.filter(c => c.category === 'landlord')

  const [f, setF] = useState({ address: '', subtype: '', area_sqm: '', monthly_rent: '', currency: '', observed_at: todayStr(), contact_id: '', notes: '' })
  const [newRegion, setNewRegion] = useState('')
  const [err, setErr] = useState('')

  // 依月份平均每平方公尺租金
  const series = useMemo(() => {
    const m: Record<string, number[]> = {}
    for (const r of rows) {
      const v = perSqm(r)
      if (v == null) continue
      const k = String(r.observed_at).slice(0, 7)
      ;(m[k] ??= []).push(v)
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([month, vs]) => ({ month, value: Math.round(vs.reduce((s, x) => s + x, 0) / vs.length) }))
  }, [rows])
  const change = series.length >= 2 ? ((series[series.length - 1].value - series[0].value) / series[0].value) * 100 : null
  const avg = series.length ? Math.round(series.reduce((s, x) => s + x.value, 0) / series.length) : null

  const add = async () => {
    const reg = newRegion.trim() || active
    if (!reg) { setErr(t('regionRequired')); return }
    const e = await rents.save({ ...f, region: reg, source: 'manual' })
    if (e) { setErr(e); return }
    setErr(''); setNewRegion(''); setRegion(reg)
    setF({ ...f, address: '', area_sqm: '', monthly_rent: '', notes: '' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('region')} className="w-56">
          <select className={selectCls} value={active} onChange={e => setRegion(e.target.value)}>
            {regions.length === 0 && <option value="">—</option>}
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <p className="text-xs text-muted-foreground flex-1">{t('rentsHint')}</p>
      </div>

      {active && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold">{active}</span>
            <span className="text-muted-foreground">{t('records', { n: rows.length })}</span>
            {avg != null && <span>{t('avgPerSqm')}: <b>{fmtNum(avg, locale)}</b></span>}
            {change != null && (
              <span className={`flex items-center gap-1 font-semibold ${change > 1 ? 'text-red-600' : change < -1 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {change > 1 ? <TrendingUp className="h-4 w-4" /> : change < -1 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                {t('changeSince', { pct: change.toFixed(1), from: series[0].month })}
              </span>
            )}
          </div>
          {series.length >= 2 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={v => Number(v).toLocaleString(locale)} />
                  <Tooltip formatter={v => [Number(v).toLocaleString(locale), t('perSqm')]} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-muted-foreground">{t('needTwoPoints')}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3">{t('col.date')}</th><th className="pr-3">{t('f.address')}</th><th className="pr-3">{t('f.subtype')}</th>
                <th className="pr-3 text-right">{t('f.area')}</th><th className="pr-3 text-right">{t('f.rent')}</th><th className="pr-3 text-right">{t('perSqm')}</th>
                <th className="pr-3">{t('col.source')}</th><th />
              </tr></thead>
              <tbody>
                {[...rows].reverse().map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.observed_at}</td>
                    <td className="pr-3">{r.address || '—'}{r.notes ? <div className="text-xs text-muted-foreground">{r.notes}</div> : null}</td>
                    <td className="pr-3 text-xs">{r.subtype ? t(`sub.${r.subtype}`) : '—'}</td>
                    <td className="pr-3 text-right">{fmtNum(r.area_sqm, locale)}</td>
                    <td className="pr-3 text-right">{fmtNum(r.monthly_rent, locale)} {r.currency}</td>
                    <td className="pr-3 text-right">{fmtNum(perSqm(r) != null ? Math.round(perSqm(r)!) : null, locale)}</td>
                    <td className="pr-3 text-xs">
                      {r.source === 'ai' ? (r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">AI<ExternalLink className="h-3 w-3" /></a> : 'AI') : t('manual')}
                    </td>
                    <td><button className="text-muted-foreground hover:text-red-600" onClick={() => rents.remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">{t('addRent')}</div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label={t('newRegion')}><Input value={newRegion} onChange={e => setNewRegion(e.target.value)} placeholder={active || t('regionPh')} /></Field>
          <Field label={t('f.address')} className="sm:col-span-2"><Input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></Field>
          <Field label={t('f.subtype')}>
            <select className={selectCls} value={f.subtype} onChange={e => setF({ ...f, subtype: e.target.value })}>
              <option value="">—</option>
              {ALL_SUBTYPES.map(s => <option key={s} value={s}>{t(`sub.${s}`)}</option>)}
            </select>
          </Field>
          <Field label={t('f.area')}><Input type="number" value={f.area_sqm} onChange={e => setF({ ...f, area_sqm: e.target.value })} /></Field>
          <Field label={t('f.rent')}><Input type="number" value={f.monthly_rent} onChange={e => setF({ ...f, monthly_rent: e.target.value })} /></Field>
          <Field label={t('currency')}><Input value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} placeholder="VND / TWD" /></Field>
          <Field label={t('col.date')}><Input type="date" value={f.observed_at} onChange={e => setF({ ...f, observed_at: e.target.value })} /></Field>
          <Field label={t('landlord')}>
            <select className={selectCls} value={f.contact_id} onChange={e => setF({ ...f, contact_id: e.target.value })}>
              <option value="">—</option>
              {landlords.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('f.notes')} className="sm:col-span-3"><Input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button size="sm" className="gap-1" onClick={add} disabled={!f.monthly_rent}><Plus className="h-4 w-4" />{t('add')}</Button>
      </Card>

      <AiRentSearch defaultRegion={active} onSaved={reg => { rents.reload(); setRegion(reg) }} saveMany={rents.saveMany} />
    </div>
  )
}

function AiRentSearch({ defaultRegion, onSaved, saveMany }: { defaultRegion: string; onSaved: (region: string) => void; saveMany: (rows: Partial<Row>[]) => Promise<string | null> }) {
  const t = useTranslations('AffairsX')
  const locale = useLocale()
  const [q, setQ] = useState({ region: '', address: '', subtype: '' })
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<AiResult | null>(null)
  const [pick, setPick] = useState<Set<number>>(new Set())
  const [err, setErr] = useState('')
  const region = q.region.trim() || defaultRegion

  const run = async () => {
    setBusy(true); setErr(''); setRes(null)
    const r = await fetch('/api/affairs/ai/rent-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...q, region }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? r.statusText); return }
    setRes(d); setPick(new Set(d.listings.map((_: unknown, i: number) => i)))
  }

  const save = async () => {
    if (!res) return
    const rows = res.listings.filter((_, i) => pick.has(i)).map(l => ({
      region, address: l.address, subtype: q.subtype, area_sqm: l.area_sqm, monthly_rent: l.monthly_rent,
      currency: l.currency, observed_at: l.observed_at || todayStr(), source: 'ai', source_url: l.source_url, notes: l.note,
    }))
    const e = await saveMany(rows)
    if (e) { setErr(e); return }
    setRes(null); onSaved(region)
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="font-semibold text-sm flex items-center gap-1"><Sparkles className="h-4 w-4 text-primary" />{t('aiRentTitle')}</div>
      <p className="text-xs text-muted-foreground">{t('aiRentHint')}</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label={t('region')}><Input value={q.region} onChange={e => setQ({ ...q, region: e.target.value })} placeholder={defaultRegion || t('regionPh')} /></Field>
        <Field label={t('f.address')} className="sm:col-span-2"><Input value={q.address} onChange={e => setQ({ ...q, address: e.target.value })} /></Field>
        <Field label={t('f.subtype')}>
          <select className={selectCls} value={q.subtype} onChange={e => setQ({ ...q, subtype: e.target.value })}>
            <option value="">—</option>
            {ALL_SUBTYPES.map(s => <option key={s} value={s}>{t(`sub.${s}`)}</option>)}
          </select>
        </Field>
      </div>
      <Button size="sm" className="gap-1" onClick={run} disabled={busy || (!region && !q.address)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? t('searching') : t('searchRent')}
      </Button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {res && (
        <div className="space-y-3 text-sm">
          <p>{res.summary}</p>
          <div className="flex flex-wrap gap-4 text-xs">
            {res.typical_rent_per_sqm != null && <span>{t('typicalPerSqm')}: <b>{fmtNum(res.typical_rent_per_sqm, locale)} {res.currency}</b></span>}
            {res.trend && <span>{t('trend')}: <b>{t(`trendV.${res.trend}`)}</b></span>}
          </div>
          {res.trend_note && <p className="text-xs text-muted-foreground">{res.trend_note}</p>}
          {(res.negotiation_tips ?? []).length > 0 && (
            <div><div className="text-xs font-semibold mb-1">{t('negotiationTips')}</div><ul className="list-disc pl-5 text-xs space-y-0.5">{res.negotiation_tips!.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {res.listings.length > 0 ? (
            <>
              <div className="space-y-1">
                {res.listings.map((l, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs rounded-md bg-muted/40 p-2">
                    <input type="checkbox" checked={pick.has(i)} onChange={() => setPick(p => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })} />
                    <span className="flex-1">
                      {l.address} · {fmtNum(l.area_sqm, locale)} m² · <b>{fmtNum(l.monthly_rent, locale)} {l.currency}</b> · {l.observed_at}
                      {l.note && <span className="text-muted-foreground"> · {l.note}</span>}
                    </span>
                    {l.source_url && <a href={l.source_url} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={save} disabled={pick.size === 0}>{t('saveSelected', { n: pick.size, region })}</Button>
            </>
          ) : <p className="text-xs text-muted-foreground">{t('noListings')}</p>}
          {res.sources.length > 0 && (
            <div className="text-xs space-y-0.5">
              <div className="font-semibold">{t('sources')}</div>
              {res.sources.map(s => <div key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{s.title}</a></div>)}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
