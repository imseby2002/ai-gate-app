'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, Loader2, AlertCircle, Store, Plus, Trash2, Copy, Check, Users, Wand2, Send, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const SHIFT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'employee_name', label: '員工姓名', required: true, example: '王小明', aliases: ['employee_name', '姓名', '員工'] },
  { key: 'work_date', label: '工作日期', required: true, example: '2026-03-05', aliases: ['work_date', '日期', '排班日期'] },
  { key: 'slot_code', label: '時段', required: true, example: '早', aliases: ['slot_code', '時段', '班別', '早晚班'] },
]

interface Slot { code: string; label: string }
interface Period { id: string; title: string; start_date: string; end_date: string; slots: Slot[]; status: string }
interface Emp { employee_id: string; employee_name: string; token: string; submitted_at: string | null }
interface Avail { employee_id: string; work_date: string; slot_code: string }
interface Assign { employee_id: string; work_date: string; slot_code: string }
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export default function ShiftPage() {
  const t = useTranslations('Shift')
  const STATUS_LABEL: Record<string, string> = { collecting: t('statusCollecting'), suggested: t('statusSuggested'), confirmed: t('statusConfirmed') }
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    fetch('/api/inv/stores').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() })
      .then(d => { if (d) { setStores(d.stores ?? []); setStore(s => s || (d.stores?.[0] ?? '')) } })
  }, [])

  const loadPeriods = useCallback(() => {
    if (!store) return
    fetch(`/api/shift/periods?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { periods: [] })
      .then(d => setPeriods(d.periods ?? []))
  }, [store])
  useEffect(() => { loadPeriods() }, [loadPeriods, tick])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('adminOnly')}</p></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="ml-auto"><Link href="/store-inventory"><Button variant="outline" size="sm" className="gap-1.5"><Store className="h-4 w-4" />{t('inventory')}</Button></Link></div>
      </div>

      <Card className="p-3">
        <label className="space-y-1 inline-block">
          <span className="block text-xs text-gray-500">{t('store')}</span>
          <Input list="shift-store-list" value={store} onChange={e => { setStore(e.target.value); setSel(null) }} placeholder={t('storePlaceholder')} className="w-40" />
          <datalist id="shift-store-list">{stores.map(s => <option key={s} value={s} />)}</datalist>
        </label>
      </Card>

      {!store ? <div className="text-center py-10 text-gray-400 text-sm">{t('selectStoreFirst')}</div>
        : <div className="grid md:grid-cols-[20rem_1fr] gap-4">
          <div className="space-y-3">
            <CreatePeriod store={store} onCreated={() => setTick(x => x + 1)} />
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">{t('periods')}</div>
              {periods.length === 0 ? <div className="text-xs text-gray-400 py-4 text-center">{t('noPeriods')}</div>
                : <div className="space-y-1">{periods.map(p => (
                  <button key={p.id} onClick={() => setSel(p.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sel === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100'}`}>
                    <div className="font-medium">{p.title || `${p.start_date} ~ ${p.end_date}`}</div>
                    <div className="text-[11px] text-gray-400">{p.start_date} ~ {p.end_date}・{STATUS_LABEL[p.status] ?? p.status}</div>
                  </button>
                ))}</div>}
            </Card>
          </div>
          {sel ? <PeriodDetail key={sel} periodId={sel} onChanged={() => setTick(x => x + 1)} onDeleted={() => { setSel(null); setTick(x => x + 1) }} />
            : <Card className="p-8 text-center text-gray-400 text-sm">{t('selectPeriodHint')}</Card>}
        </div>}
    </div>
  )
}

function CreatePeriod({ store, onCreated }: { store: string; onCreated: () => void }) {
  const t = useTranslations('Shift')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [labels, setLabels] = useState(t('defaultSlots'))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const create = async () => {
    if (!start || !end) { setMsg(t('fillDatesFirst')); return }
    setSaving(true); setMsg('')
    const slots = labels.split(/[,，]/).map(s => s.trim()).filter(Boolean).map((label, i) => ({ code: `s${i}`, label }))
    const res = await fetch('/api/shift/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, title, start_date: start, end_date: end, slots }) })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('createFailed')); return }
    setTitle(''); setStart(''); setEnd(''); setMsg(t('createdWithEmployees', { n: d.employees })); onCreated()
  }

  return (
    <Card className="p-3 space-y-2">
      <div className="text-sm font-medium flex items-center gap-1.5"><Plus className="h-4 w-4 text-primary" />{t('newPeriod')}</div>
      <label className="space-y-1 block"><span className="text-[11px] text-gray-500">{t('nameOptional')}</span><Input value={title} onChange={e => setTitle(e.target.value)} className="h-8" placeholder={t('namePlaceholder')} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 block"><span className="text-[11px] text-gray-500">{t('startDate')}</span><Input type="date" value={start} onChange={e => setStart(e.target.value)} className="h-8" /></label>
        <label className="space-y-1 block"><span className="text-[11px] text-gray-500">{t('endDate')}</span><Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="h-8" /></label>
      </div>
      <label className="space-y-1 block"><span className="text-[11px] text-gray-500">{t('slotsCommaSep')}</span><Input value={labels} onChange={e => setLabels(e.target.value)} className="h-8" /></label>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={create} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('create')}</Button>
        {msg && <span className="text-xs text-blue-600">{msg}</span>}
      </div>
    </Card>
  )
}

function PeriodDetail({ periodId, onChanged, onDeleted }: { periodId: string; onChanged: () => void; onDeleted: () => void }) {
  const t = useTranslations('Shift')
  const wd = (d: string) => t(`weekday_${WEEKDAY_KEYS[new Date(d + 'T00:00:00Z').getUTCDay()] ?? 'sun'}`)
  const STATUS_LABEL: Record<string, string> = { collecting: t('statusCollecting'), suggested: t('statusSuggested'), confirmed: t('statusConfirmed') }
  const [data, setData] = useState<{ period: Period; dates: string[]; employees: Emp[]; availability: Avail[]; assignments: Assign[] } | null>(null)
  const [assignSet, setAssignSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState('')
  const [need, setNeed] = useState(1)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/shift/periods/${periodId}`).then(r => r.ok ? r.json() : null).then(d => {
      setData(d)
      setAssignSet(new Set<string>((d?.assignments ?? []).map((a: Assign) => `${a.employee_id}|${a.work_date}|${a.slot_code}`)))
      setLoading(false)
    })
  }, [periodId])
  useEffect(() => { load() }, [load])

  const copy = (token: string) => {
    const url = `${location.origin}/shift/${token}`
    navigator.clipboard?.writeText(url).then(() => { setCopied(token); setTimeout(() => setCopied(''), 1500) }).catch(() => {})
  }
  const del = async () => {
    if (!confirm(t('confirmDeletePeriod'))) return
    const res = await fetch('/api/shift/periods', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: periodId }) })
    if (res.ok) onDeleted()
  }
  const suggest = async () => {
    setBusy('suggest'); setMsg('')
    const res = await fetch(`/api/shift/periods/${periodId}/suggest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ need }) })
    setBusy('')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('suggestFailed')); return }
    setMsg(t('suggestedAssigned', { n: d.assigned })); load(); onChanged()
  }
  const confirmSend = async () => {
    if (!confirm(t('confirmSendConfirm'))) return
    setBusy('confirm'); setMsg('')
    const res = await fetch(`/api/shift/periods/${periodId}/confirm`, { method: 'POST' })
    setBusy('')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('confirmFailed')); return }
    setMsg(t('confirmedSent', { employees: d.employees, emailed: d.emailed })); load(); onChanged()
  }
  const toggleAssign = async (empId: string, date: string, slot: string) => {
    const key = `${empId}|${date}|${slot}`
    const on = assignSet.has(key)
    setAssignSet(p => { const n = new Set(p); on ? n.delete(key) : n.add(key); return n })
    const res = await fetch('/api/shift/assignments', {
      method: on ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: periodId, employee_id: empId, work_date: date, slot_code: slot }),
    })
    if (!res.ok) { setAssignSet(p => { const n = new Set(p); on ? n.add(key) : n.delete(key); return n }); const d = await res.json().catch(() => ({})); setMsg(d.error ?? t('adjustFailed')) }
  }

  if (loading) return <Card className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></Card>
  if (!data) return <Card className="p-8 text-center text-gray-400 text-sm">{t('loadFailed')}</Card>
  const { period, dates, employees, availability } = data
  const slots = period.slots ?? []
  const nameOf = new Map(employees.map(e => [e.employee_id, e.employee_name]))
  const availByCell = new Map<string, string[]>()
  for (const a of availability) { const k = `${a.work_date}|${a.slot_code}`; (availByCell.get(k) ?? availByCell.set(k, []).get(k)!).push(a.employee_id) }
  const submitted = employees.filter(e => e.submitted_at).length
  const confirmed = period.status === 'confirmed'

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div>
          <div className="font-semibold">{period.title || `${period.start_date} ~ ${period.end_date}`}</div>
          <div className="text-xs text-gray-400">{period.start_date} ~ {period.end_date}・{STATUS_LABEL[period.status] ?? period.status}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />{t('bulkImportShift')}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" onClick={del}><Trash2 className="h-4 w-4" />{t('delete')}</Button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入排班表"
          description="支援 .xlsx, .xls 與 .csv 檔案。請填寫員工姓名、工作日期（YYYY-MM-DD）與時段（如：早、午、晚）。"
          columns={SHIFT_IMPORT_COLUMNS}
          templateFilename="門市排班範本"
          sheetName="排班表"
          onClose={() => setShowImport(false)}
          onSuccess={() => { load(); onChanged() }}
          onSubmit={async rows => {
            const res = await fetch('/api/shift/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period_id: periodId, rows }),
            })
            return await res.json()
          }}
        />
      )}

      <div>
        <div className="text-sm font-medium flex items-center gap-1.5 mb-2"><Users className="h-4 w-4 text-gray-400" />{t('reportLinks', { submitted, total: employees.length })}</div>
        {employees.length === 0 ? <div className="text-xs text-gray-400">{t('noActiveEmployees')}</div>
          : <div className="grid sm:grid-cols-2 gap-1.5">{employees.map(e => (
            <div key={e.employee_id} className="flex items-center gap-2 text-sm border rounded-lg px-2 py-1.5">
              <span className={`h-2 w-2 rounded-full ${e.submitted_at ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <span className="flex-1 truncate">{e.employee_name || t('unnamed')}</span>
              <button onClick={() => copy(e.token)} className="text-gray-400 hover:text-primary" title={t('copyReportLink')}>
                {copied === e.token ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}</div>}
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-medium">{t('scheduleTableHint')}</div>
          {!confirmed && <label className="ml-auto text-xs text-gray-500 flex items-center gap-1">{t('needPerCell')}
            <Input type="number" value={String(need)} onChange={e => setNeed(Math.max(1, Number(e.target.value) || 1))} className="w-14 h-7" /></label>}
          {!confirmed && <Button size="sm" variant="outline" className="gap-1.5" onClick={suggest} disabled={busy !== ''}>{busy === 'suggest' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{t('autoSuggest')}</Button>}
          {!confirmed && <Button size="sm" className="gap-1.5" onClick={confirmSend} disabled={busy !== ''}>{busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t('confirmAndSend')}</Button>}
          {msg && <span className="text-xs text-blue-600 basis-full">{msg}</span>}
        </div>
        {confirmed && <p className="text-[11px] text-amber-600">{t('confirmedNotice')}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-gray-500 border-b"><th className="text-left py-2 pr-2">{t('date')}</th>{slots.map(s => <th key={s.code} className="px-2 text-left">{s.label}</th>)}</tr></thead>
            <tbody>{dates.map(d => (
              <tr key={d} className="border-b last:border-0 align-top">
                <td className="py-1.5 pr-2 whitespace-nowrap">{d.slice(5)} <span className="text-gray-400">({wd(d)})</span></td>
                {slots.map(s => {
                  const pool = availByCell.get(`${d}|${s.code}`) ?? []
                  return <td key={s.code} className="px-2 py-1.5">
                    {pool.length === 0 ? <span className="text-gray-300 text-xs">—</span>
                      : <div className="flex flex-wrap gap-1">{pool.map(emp => {
                        const on = assignSet.has(`${emp}|${d}|${s.code}`)
                        return <button key={emp} disabled={confirmed} onClick={() => toggleAssign(emp, d, s.code)}
                          className={`px-1.5 py-0.5 rounded text-[11px] ${on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{nameOf.get(emp) || '?'}</button>
                      })}</div>}
                  </td>
                })}
              </tr>
            ))}</tbody></table>
        </div>
        <p className="text-[11px] text-gray-400">{t('legendHint')}</p>
      </div>
    </Card>
  )
}
