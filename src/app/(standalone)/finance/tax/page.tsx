'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Loader2, Search, Plus, Trash2, Save, RefreshCw, Download, ChevronDown, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DEFAULT_PIT_SETTINGS, type PitSettings, type PitMethod } from '@/lib/acc/pit'

type Tab = 'registry' | 'monthly' | 'annual' | 'settings'

interface Emp { id: string; name: string; attendance_no: string; store: string; position: string; staff_category: string; status: string; tax_code: string; id_number: string; pit_method: string }
interface Dep { id: string; employee_id: string; name: string; relationship: string; id_number: string; tax_code: string; birthday: string | null; from_month: string; to_month: string; registered: boolean; note: string }
interface Row {
  id: string; employee_id: string; year: number; month: number; method: PitMethod
  gross_income: number; exempt_income: number; insurance_deduction: number; dependents: number
  personal_deduction: number; dependent_deduction: number; taxable_income: number; tax_amount: number; note: string
  hr_employees: { name: string; attendance_no: string; store: string; tax_code: string; id_number: string } | null
}

const now = new Date()
const fmt = (n: number, locale: string) => Math.round(Number(n) || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function TaxPage() {
  const t = useTranslations('Pit')
  const [tab, setTab] = useState<Tab>('registry')
  const [emps, setEmps] = useState<Emp[]>([])
  const [deps, setDeps] = useState<Dep[]>([])
  const [settings, setSettings] = useState<PitSettings>(DEFAULT_PIT_SETTINGS)
  const [sources, setSources] = useState<{ label: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/finance/pit').then(async res => {
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error ?? 'error')
      else { setEmps(d.employees ?? []); setDeps(d.dependents ?? []); setSettings(d.settings); setSources(d.sources ?? []) }
      setLoading(false)
    })
  }, [])

  const TABS: [Tab, string][] = [['registry', t('tabRegistry')], ['monthly', t('tabMonthly')], ['annual', t('tabAnnual')], ['settings', t('tabSettings')]]

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="text-gray-500 hover:text-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <p className="text-xs text-gray-500">{t('subtitle')}</p>
        </div>
      </div>
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-emerald-600 text-emerald-700 font-medium' : 'border-transparent text-gray-500'}`}>{label}</button>
        ))}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <>
          {tab === 'registry' && <Registry emps={emps} setEmps={setEmps} deps={deps} setDeps={setDeps} />}
          {tab === 'monthly' && <Monthly />}
          {tab === 'annual' && <Annual />}
          {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} sources={sources} />}
        </>
      )}
    </div>
  )
}

// ─── 稅籍與扶養人 ─────────────────────────────────────────────
function Registry({ emps, setEmps, deps, setDeps }: { emps: Emp[]; setEmps: (f: (e: Emp[]) => Emp[]) => void; deps: Dep[]; setDeps: (f: (d: Dep[]) => Dep[]) => void }) {
  const t = useTranslations('Pit')
  const [q, setQ] = useState('')
  const [store, setStore] = useState('')
  const [onlyDeps, setOnlyDeps] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const depBy = useMemo(() => {
    const m = new Map<string, Dep[]>()
    for (const d of deps) (m.get(d.employee_id) ?? m.set(d.employee_id, []).get(d.employee_id)!).push(d)
    return m
  }, [deps])
  const stores = useMemo(() => [...new Set(emps.map(e => e.store).filter(Boolean))].sort(), [emps])
  const list = emps.filter(e =>
    (!store || e.store === store) &&
    (!onlyDeps || depBy.has(e.id)) &&
    (!q || `${e.name} ${e.attendance_no} ${e.tax_code} ${e.id_number}`.toLowerCase().includes(q.toLowerCase())))
  const noMst = emps.filter(e => e.status !== 'resigned' && !e.tax_code).length

  const patchEmp = async (id: string, body: Partial<Emp>) => {
    const res = await fetch('/api/finance/pit', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    if (res.ok) setEmps(es => es.map(e => e.id === id ? { ...e, ...body } : e))
    else alert((await res.json().catch(() => ({}))).error ?? t('saveFailed'))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Card className="p-3"><div className="text-gray-500 text-xs">{t('statEmployees')}</div><div className="text-lg font-semibold">{emps.length}</div></Card>
        <Card className="p-3"><div className="text-gray-500 text-xs">{t('statWithDeps')}</div><div className="text-lg font-semibold">{depBy.size}</div></Card>
        <Card className="p-3"><div className="text-gray-500 text-xs">{t('statDeps')}</div><div className="text-lg font-semibold">{deps.length}</div></Card>
        <Card className="p-3"><div className="text-gray-500 text-xs">{t('statNoMst')}</div><div className="text-lg font-semibold text-amber-600">{noMst}</div></Card>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('search')} className="pl-9" /></div>
        <select value={store} onChange={e => setStore(e.target.value)} className="border rounded-md px-2 py-2 text-sm">
          <option value="">{t('allStores')}</option>
          {stores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={onlyDeps} onChange={e => setOnlyDeps(e.target.checked)} />{t('onlyWithDeps')}</label>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadCsv('dependents.csv',
          [t('colCode'), t('colName'), t('colStore'), 'MST', 'CCCD', t('depName'), t('depRelation'), t('depId'), t('depRegistered')],
          deps.map(d => { const e = emps.find(x => x.id === d.employee_id); return [e?.attendance_no ?? '', e?.name ?? '', e?.store ?? '', e?.tax_code ?? '', e?.id_number ?? '', d.name, d.relationship, d.id_number, d.registered ? 'Y' : ''] }))}>
          <Download className="h-4 w-4" />{t('exportDeps')}
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs">
            <tr><th className="p-2 w-6"></th><th className="p-2 text-left">{t('colCode')}</th><th className="p-2 text-left">{t('colName')}</th><th className="p-2 text-left">{t('colStore')}</th><th className="p-2 text-left">CCCD</th><th className="p-2 text-left">MST</th><th className="p-2 text-left">{t('colMethod')}</th><th className="p-2 text-right">{t('colDeps')}</th></tr>
          </thead>
          <tbody>
            {list.map(e => {
              const ds = depBy.get(e.id) ?? []
              const isOpen = open === e.id
              return (
                <Fragment key={e.id}>
                  <tr className={`border-t ${e.status === 'resigned' ? 'text-gray-400' : ''}`}>
                    <td className="p-2"><button onClick={() => setOpen(isOpen ? null : e.id)} className="text-gray-400">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
                    <td className="p-2 whitespace-nowrap">{e.attendance_no || '—'}</td>
                    <td className="p-2 whitespace-nowrap">{e.name}{e.status === 'resigned' && <span className="ml-1 text-[11px]">({t('resigned')})</span>}</td>
                    <td className="p-2">{e.store}</td>
                    <td className="p-2 font-mono text-xs">{e.id_number}</td>
                    <td className="p-2"><Input defaultValue={e.tax_code} placeholder={t('mstPlaceholder')} className="h-8 w-36 font-mono text-xs" onBlur={ev => { if (ev.target.value.trim() !== e.tax_code) patchEmp(e.id, { tax_code: ev.target.value.trim() }) }} /></td>
                    <td className="p-2">
                      <select value={e.pit_method} onChange={ev => patchEmp(e.id, { pit_method: ev.target.value })} className="border rounded px-1 py-1 text-xs">
                        <option value="">{t('methodAuto', { m: e.staff_category === 'hourly' ? t('methodFlat10') : t('methodProgressive') })}</option>
                        <option value="progressive">{t('methodProgressive')}</option>
                        <option value="flat10">{t('methodFlat10')}</option>
                        <option value="none">{t('methodNone')}</option>
                      </select>
                    </td>
                    <td className="p-2 text-right">{ds.length || ''}</td>
                  </tr>
                  {isOpen && <tr className="bg-gray-50/60"><td colSpan={8} className="p-3"><DepEditor emp={e} deps={ds} setDeps={setDeps} /></td></tr>}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DepEditor({ emp, deps, setDeps }: { emp: Emp; deps: Dep[]; setDeps: (f: (d: Dep[]) => Dep[]) => void }) {
  const t = useTranslations('Pit')
  const blank = { name: '', relationship: '', id_number: '', from_month: '', to_month: '', registered: false }
  const [draft, setDraft] = useState(blank)

  const send = async (method: string, body: object) => {
    const res = await fetch('/api/finance/pit/dependents', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { alert(d.error ?? t('saveFailed')); return null }
    return d
  }
  const add = async () => {
    if (!draft.name.trim()) return
    const d = await send('POST', { employee_id: emp.id, ...draft })
    if (d) { setDeps(ds => [...ds, d.dependent]); setDraft(blank) }
  }
  const update = async (id: string, patch: Partial<Dep>) => {
    const d = await send('PATCH', { id, ...patch })
    if (d) setDeps(ds => ds.map(x => x.id === id ? d.dependent : x))
  }
  const remove = async (dep: Dep) => {
    if (!confirm(t('confirmDeleteDep', { name: dep.name }))) return
    if (await send('DELETE', { id: dep.id })) setDeps(ds => ds.filter(x => x.id !== dep.id))
  }

  const cell = 'h-8 text-xs'
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">{t('depHint')}</div>
      <div className="grid gap-2">
        {deps.map(d => (
          <div key={d.id} className="flex flex-wrap items-center gap-2">
            <Input defaultValue={d.name} className={`${cell} w-48`} onBlur={e => e.target.value !== d.name && update(d.id, { name: e.target.value })} />
            <Input defaultValue={d.relationship} placeholder={t('depRelation')} className={`${cell} w-24`} onBlur={e => e.target.value !== d.relationship && update(d.id, { relationship: e.target.value })} />
            <Input defaultValue={d.id_number} placeholder={t('depId')} className={`${cell} w-36 font-mono`} onBlur={e => e.target.value !== d.id_number && update(d.id, { id_number: e.target.value })} />
            <Input type="month" defaultValue={d.from_month} title={t('depFrom')} className={`${cell} w-36`} onBlur={e => e.target.value !== d.from_month && update(d.id, { from_month: e.target.value })} />
            <Input type="month" defaultValue={d.to_month} title={t('depTo')} className={`${cell} w-36`} onBlur={e => e.target.value !== d.to_month && update(d.id, { to_month: e.target.value })} />
            <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={d.registered} onChange={e => update(d.id, { registered: e.target.checked })} />{t('depRegistered')}</label>
            {!d.registered && <span className="text-[11px] text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />{t('depNotRegistered')}</span>}
            {d.note && <span className="text-[11px] text-gray-500">{d.note}</span>}
            <button onClick={() => remove(d)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
        <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={t('depName')} className={`${cell} w-48`} />
        <Input value={draft.relationship} onChange={e => setDraft({ ...draft, relationship: e.target.value })} placeholder={t('depRelation')} className={`${cell} w-24`} />
        <Input value={draft.id_number} onChange={e => setDraft({ ...draft, id_number: e.target.value })} placeholder={t('depId')} className={`${cell} w-36 font-mono`} />
        <Input type="month" value={draft.from_month} onChange={e => setDraft({ ...draft, from_month: e.target.value })} title={t('depFrom')} className={`${cell} w-36`} />
        <Button size="sm" onClick={add} className="gap-1 h-8"><Plus className="h-4 w-4" />{t('addDep')}</Button>
      </div>
    </div>
  )
}

// ─── 月扣繳 ───────────────────────────────────────────────────
function Monthly() {
  const t = useTranslations('Pit')
  const locale = useLocale()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<Row[]>([])
  const [tick, setTick] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const key = `${year}-${month}-${tick}`
  const loading = loadedKey !== key
  const load = () => setTick(x => x + 1)

  useEffect(() => {
    fetch(`/api/finance/pit/monthly?year=${year}&month=${month}`).then(async res => {
      const d = await res.json().catch(() => ({}))
      setRows(res.ok ? d.rows ?? [] : []); setLoadedKey(`${year}-${month}-${tick}`)
    })
  }, [year, month, tick])

  const generate = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/finance/pit/monthly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(d.error ?? t('saveFailed')); return }
    setMsg(d.generated ? t('generated', { n: d.generated }) : t('noPayroll'))
    load()
  }
  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch('/api/finance/pit/monthly', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    const d = await res.json().catch(() => ({}))
    if (res.ok) setRows(rs => rs.map(r => r.id === id ? d.row : r))
    else alert(d.error ?? t('saveFailed'))
  }

  const sum = (k: keyof Row) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
  const methodLabel = (m: string) => m === 'flat10' ? t('methodFlat10') : m === 'none' ? t('methodNone') : t('methodProgressive')
  const exportCsv = () => downloadCsv(`pit-${year}-${String(month).padStart(2, '0')}.csv`,
    [t('colCode'), t('colName'), t('colStore'), 'MST', 'CCCD', t('colMethod'), t('colGross'), t('colExempt'), t('colInsurance'), t('colDeps'), t('colFamilyDeduction'), t('colTaxable'), t('colTax')],
    rows.map(r => [r.hr_employees?.attendance_no ?? '', r.hr_employees?.name ?? '', r.hr_employees?.store ?? '', r.hr_employees?.tax_code ?? '', r.hr_employees?.id_number ?? '', methodLabel(r.method), r.gross_income, r.exempt_income, r.insurance_deduction, r.dependents, Number(r.personal_deduction) + Number(r.dependent_deduction), r.taxable_income, r.tax_amount]))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || now.getFullYear())} className="w-24" />
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="border rounded-md px-2 py-2 text-sm">
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{t('monthN', { n: i + 1 })}</option>)}
        </select>
        <Button size="sm" onClick={generate} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t('generate')}</Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length} className="gap-1"><Download className="h-4 w-4" />CSV</Button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
      <p className="text-xs text-gray-500">{t('monthlyHint')}</p>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center text-sm text-gray-400 py-8">{t('noRows')}</div>
          : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="p-2 text-left">{t('colName')}</th><th className="p-2 text-left">{t('colMethod')}</th>
                    <th className="p-2 text-right">{t('colGross')}</th><th className="p-2 text-right">{t('colExempt')}</th><th className="p-2 text-right">{t('colInsurance')}</th>
                    <th className="p-2 text-right">{t('colDeps')}</th><th className="p-2 text-right">{t('colFamilyDeduction')}</th><th className="p-2 text-right">{t('colTaxable')}</th><th className="p-2 text-right">{t('colTax')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{r.hr_employees?.name}<div className="text-[11px] text-gray-400">{r.hr_employees?.attendance_no} {r.hr_employees?.store}{!r.hr_employees?.tax_code && <span className="text-amber-600"> · {t('noMst')}</span>}</div></td>
                      <td className="p-2">
                        <select value={r.method} onChange={e => patch(r.id, { method: e.target.value })} className="border rounded px-1 py-1 text-xs">
                          <option value="progressive">{t('methodProgressive')}</option><option value="flat10">{t('methodFlat10')}</option><option value="none">{t('methodNone')}</option>
                        </select>
                      </td>
                      <td className="p-2 text-right"><Input type="number" defaultValue={r.gross_income} className="h-8 w-28 text-right text-xs ml-auto" onBlur={e => Number(e.target.value) !== Number(r.gross_income) && patch(r.id, { gross_income: e.target.value })} /></td>
                      <td className="p-2 text-right"><Input type="number" defaultValue={r.exempt_income} className="h-8 w-24 text-right text-xs ml-auto" onBlur={e => Number(e.target.value) !== Number(r.exempt_income) && patch(r.id, { exempt_income: e.target.value })} /></td>
                      <td className="p-2 text-right"><Input type="number" defaultValue={r.insurance_deduction} className="h-8 w-24 text-right text-xs ml-auto" onBlur={e => Number(e.target.value) !== Number(r.insurance_deduction) && patch(r.id, { insurance_deduction: e.target.value })} /></td>
                      <td className="p-2 text-right"><Input type="number" defaultValue={r.dependents} className="h-8 w-14 text-right text-xs ml-auto" onBlur={e => Number(e.target.value) !== r.dependents && patch(r.id, { dependents: e.target.value })} /></td>
                      <td className="p-2 text-right">{fmt(Number(r.personal_deduction) + Number(r.dependent_deduction), locale)}</td>
                      <td className="p-2 text-right">{fmt(r.taxable_income, locale)}</td>
                      <td className="p-2 text-right font-medium">{fmt(r.tax_amount, locale)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-medium">
                  <tr className="border-t">
                    <td className="p-2" colSpan={2}>{t('total', { n: rows.length })}</td>
                    <td className="p-2 text-right">{fmt(sum('gross_income'), locale)}</td><td className="p-2 text-right">{fmt(sum('exempt_income'), locale)}</td><td className="p-2 text-right">{fmt(sum('insurance_deduction'), locale)}</td>
                    <td className="p-2 text-right">{sum('dependents')}</td><td className="p-2 text-right">{fmt(sum('personal_deduction') + sum('dependent_deduction'), locale)}</td>
                    <td className="p-2 text-right">{fmt(sum('taxable_income'), locale)}</td><td className="p-2 text-right">{fmt(sum('tax_amount'), locale)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
    </div>
  )
}

// ─── 年度彙總（供年度結算 quyết toán 參考） ───────────────────
function Annual() {
  const t = useTranslations('Pit')
  const locale = useLocale()
  const [year, setYear] = useState(now.getFullYear())
  const [rows, setRows] = useState<Row[]>([])
  const [loadedYear, setLoadedYear] = useState(0)
  const loading = loadedYear !== year

  useEffect(() => {
    fetch(`/api/finance/pit/monthly?year=${year}`).then(r => r.ok ? r.json() : { rows: [] }).then(d => { setRows(d.rows ?? []); setLoadedYear(year) })
  }, [year])

  const agg = useMemo(() => {
    const m = new Map<string, { emp: Row['hr_employees']; months: number; gross: number; exempt: number; ins: number; taxable: number; tax: number }>()
    for (const r of rows) {
      const a = m.get(r.employee_id) ?? m.set(r.employee_id, { emp: r.hr_employees, months: 0, gross: 0, exempt: 0, ins: 0, taxable: 0, tax: 0 }).get(r.employee_id)!
      a.months++; a.gross += Number(r.gross_income); a.exempt += Number(r.exempt_income); a.ins += Number(r.insurance_deduction); a.taxable += Number(r.taxable_income); a.tax += Number(r.tax_amount)
    }
    return [...m.values()].sort((a, b) => (a.emp?.store ?? '').localeCompare(b.emp?.store ?? '') || (a.emp?.name ?? '').localeCompare(b.emp?.name ?? ''))
  }, [rows])
  const total = agg.reduce((s, a) => ({ gross: s.gross + a.gross, tax: s.tax + a.tax }), { gross: 0, tax: 0 })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || now.getFullYear())} className="w-24" />
        <Button size="sm" variant="outline" disabled={!agg.length} className="gap-1" onClick={() => downloadCsv(`pit-annual-${year}.csv`,
          [t('colCode'), t('colName'), t('colStore'), 'MST', 'CCCD', t('colMonths'), t('colGross'), t('colExempt'), t('colInsurance'), t('colTaxable'), t('colTax')],
          agg.map(a => [a.emp?.attendance_no ?? '', a.emp?.name ?? '', a.emp?.store ?? '', a.emp?.tax_code ?? '', a.emp?.id_number ?? '', a.months, a.gross, a.exempt, a.ins, a.taxable, a.tax]))}>
          <Download className="h-4 w-4" />CSV
        </Button>
        <span className="text-sm text-gray-600">{t('annualTotal', { gross: fmt(total.gross, locale), tax: fmt(total.tax, locale) })}</span>
      </div>
      <p className="text-xs text-gray-500">{t('annualHint')}</p>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        : agg.length === 0 ? <div className="text-center text-sm text-gray-400 py-8">{t('noRows')}</div> : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr><th className="p-2 text-left">{t('colName')}</th><th className="p-2 text-left">MST</th><th className="p-2 text-right">{t('colMonths')}</th><th className="p-2 text-right">{t('colGross')}</th><th className="p-2 text-right">{t('colInsurance')}</th><th className="p-2 text-right">{t('colTaxable')}</th><th className="p-2 text-right">{t('colTax')}</th></tr>
              </thead>
              <tbody>
                {agg.map((a, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{a.emp?.name}<div className="text-[11px] text-gray-400">{a.emp?.attendance_no} {a.emp?.store}</div></td>
                    <td className="p-2 font-mono text-xs">{a.emp?.tax_code || <span className="text-amber-600">{t('noMst')}</span>}</td>
                    <td className="p-2 text-right">{a.months}</td><td className="p-2 text-right">{fmt(a.gross, locale)}</td><td className="p-2 text-right">{fmt(a.ins, locale)}</td>
                    <td className="p-2 text-right">{fmt(a.taxable, locale)}</td><td className="p-2 text-right font-medium">{fmt(a.tax, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

// ─── 稅率設定 ─────────────────────────────────────────────────
function SettingsTab({ settings, setSettings, sources }: { settings: PitSettings; setSettings: (s: PitSettings) => void; sources: { label: string; url: string }[] }) {
  const t = useTranslations('Pit')
  const [s, setS] = useState(settings)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/finance/pit', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) setSettings(d.settings); else alert(d.error ?? t('saveFailed'))
  }
  const num = (k: keyof PitSettings, label: string, step = '1') => (
    <label className="block text-sm"><span className="text-gray-600 text-xs">{label}</span>
      <Input type="number" step={step} value={s[k] as number} onChange={e => setS({ ...s, [k]: Number(e.target.value) })} />
    </label>
  )
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        {num('personal_deduction', t('setPersonal'))}
        {num('dependent_deduction', t('setDependent'))}
        {num('insurance_rate', t('setInsurance'), '0.001')}
        {num('casual_rate', t('setCasualRate'), '0.01')}
        {num('casual_threshold', t('setCasualThreshold'))}
      </div>
      <div>
        <div className="text-xs text-gray-600 mb-1">{t('setBrackets')}</div>
        <div className="space-y-1">
          {s.brackets.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-gray-400">{i + 1}</span>
              <Input type="number" value={b.upTo ?? ''} placeholder={t('noLimit')} className="w-40" onChange={e => setS({ ...s, brackets: s.brackets.map((x, j) => j === i ? { ...x, upTo: e.target.value === '' ? null : Number(e.target.value) } : x) })} />
              <Input type="number" step="0.01" value={b.rate} className="w-24" onChange={e => setS({ ...s, brackets: s.brackets.map((x, j) => j === i ? { ...x, rate: Number(e.target.value) } : x) })} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="gap-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('save')}</Button>
        <Button variant="outline" onClick={() => setS(DEFAULT_PIT_SETTINGS)}>{t('resetDefault')}</Button>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div className="font-medium">{t('sources')}</div>
        {sources.map(src => <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-700 hover:underline"><ExternalLink className="h-3 w-3" />{src.label}</a>)}
      </div>
    </div>
  )
}
