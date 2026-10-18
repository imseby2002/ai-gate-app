'use client'

// 店長排班總表（時間制）：一週切換、每天一張時間格，顯示每位員工可上班時段、需求人數與已排班。
// 在員工那一列拖曳即可排班；點已排的班可調整或刪除。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Loader2, Send, Users, CalendarPlus, Trash2, X, Wand2, Sparkles, BarChart3 } from 'lucide-react'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  SLOT_MIN, addDays, availableOn, covers, fmtMin, mondayOf, needsOn, timeOptions, weekdayOf,
  type AvailRule, type NeedRule, type PlanRow, type Interval,
} from '@/lib/shift/time'

interface Emp { id: string; name: string; employment_type: string | null; position: string | null }
interface Board { employees: Emp[]; rules: AvailRule[]; plans: PlanRow[]; needs: NeedRule[] }

const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_START = 6 * 60 // 營業可能時段 06:00–24:00
const DAY_END = 24 * 60
const todayStr = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const jsonPost = (url: string, method: string, body: unknown) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function ScheduleBoard({ store }: { store: string }) {
  const t = useTranslations('Shift')
  const WD = [t('wdSun'), t('wdMon'), t('wdTue'), t('wdWed'), t('wdThu'), t('wdFri'), t('wdSat')]
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayStr()))
  const [date, setDate] = useState(() => todayStr())
  const [board, setBoard] = useState<{ key: string; data: Board } | null>(null)
  const [tick, setTick] = useState(0)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [showNeeds, setShowNeeds] = useState(false)
  const [showAvail, setShowAvail] = useState(false)
  const [showSales, setShowSales] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [showOthers, setShowOthers] = useState(false)
  const [editing, setEditing] = useState<PlanRow | null>(null)
  const weekEnd = addDays(weekStart, 6)
  const key = `${store}|${weekStart}|${tick}`

  useEffect(() => {
    fetch(`/api/shift/board?store=${encodeURIComponent(store)}&from=${weekStart}&to=${weekEnd}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBoard({ key, data: d ?? { employees: [], rules: [], plans: [], needs: [] } }))
  }, [store, weekStart, weekEnd, key])
  const reload = useCallback(() => setTick(x => x + 1), [])
  const data = board?.data
  const loading = board?.key !== key && !data

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const selDate = date >= weekStart && date <= weekEnd ? date : weekStart
  const goWeek = (n: number) => { const ws = addDays(weekStart, n * 7); setWeekStart(ws); setDate(ws); setEditing(null) }

  // 顯示的時間範圍：固定 06:00–24:00；本週資料若早於 06:00 則往前延伸
  const [rangeStart, rangeEnd] = useMemo(() => {
    const all: Interval[] = [
      ...(data?.rules ?? []).map(r => ({ start: r.start_min, end: r.end_min })),
      ...(data?.needs ?? []).map(n => ({ start: n.start_min, end: n.end_min })),
      ...(data?.plans ?? []).map(p => ({ start: p.start_min, end: p.end_min })),
    ]
    if (all.length === 0) return [DAY_START, DAY_END]
    const s = Math.min(...all.map(x => x.start)), e = Math.max(...all.map(x => x.end))
    return [Math.min(DAY_START, Math.floor(s / 60) * 60), Math.max(DAY_END, Math.ceil(e / 60) * 60)]
  }, [data])
  const slots = useMemo(() => { const o: number[] = []; for (let m = rangeStart; m < rangeEnd; m += SLOT_MIN) o.push(m); return o }, [rangeStart, rangeEnd])

  const dayInfo = useCallback((d: string) => {
    if (!data) return { avail: new Map<string, Interval[]>(), plans: [] as PlanRow[], need: new Map<number, number>(), short: 0, drafts: 0 }
    const avail = new Map(data.employees.map(e => [e.id, availableOn(data.rules, e.id, d)]))
    const plans = data.plans.filter(p => p.work_date === d)
    const need = needsOn(data.needs, d)
    let short = 0
    for (const [m, n] of need) if (plans.filter(p => covers({ start: p.start_min, end: p.end_min }, m)).length < n) short++
    return { avail, plans, need, short, drafts: plans.filter(p => p.status === 'draft').length }
  }, [data])
  const info = dayInfo(selDate)
  const weekDrafts = data ? data.plans.filter(p => p.status === 'draft').length : 0

  // 員工排序：今天可上班或有班的在上面，其餘收合
  const emps = data?.employees ?? []
  const active = emps.filter(e => (info.avail.get(e.id)?.length ?? 0) > 0 || info.plans.some(p => p.employee_id === e.id))
  const others = emps.filter(e => !active.includes(e))
  const weekHours = (id: string) => (data?.plans ?? []).filter(p => p.employee_id === id).reduce((s, p) => s + (p.end_min - p.start_min), 0) / 60

  // 拖曳排班
  const [drag, setDrag] = useState<{ emp: string; a: number; b: number } | null>(null)
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const c = el?.closest('[data-slot]') as HTMLElement | null
    return c ? { emp: c.dataset.emp!, slot: Number(c.dataset.slot) } : null
  }
  const onPointerDown = (e: React.PointerEvent) => {
    const c = cellAt(e.clientX, e.clientY)
    if (!c) return
    const hit = info.plans.find(p => p.employee_id === c.emp && covers({ start: p.start_min, end: p.end_min }, c.slot))
    if (hit) { setEditing(hit); return }
    e.preventDefault()
    setEditing(null)
    setDrag({ emp: c.emp, a: c.slot, b: c.slot })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag
    if (!d) return
    const c = cellAt(e.clientX, e.clientY)
    if (c && c.emp === d.emp && c.slot !== d.b) setDrag({ ...d, b: c.slot })
  }
  const onPointerUp = async () => {
    const d = drag
    setDrag(null)
    if (!d) return
    const start = Math.min(d.a, d.b), end = Math.max(d.a, d.b) + SLOT_MIN
    await createPlan(d.emp, start, end)
  }

  async function createPlan(emp: string, start: number, end: number) {
    setErr('')
    const r = await jsonPost('/api/shift/plans', 'POST', { store, employee_id: emp, work_date: selDate, start_min: start, end_min: end })
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? t('saveFailed'))
    reload()
  }
  async function fillFromAvail(emp: string) {
    for (const iv of info.avail.get(emp) ?? []) {
      if (info.plans.some(p => p.employee_id === emp && p.start_min < iv.end && p.end_min > iv.start)) continue
      await createPlan(emp, iv.start, iv.end)
    }
  }
  async function publish() {
    if (!confirm(t('publishConfirm', { from: weekStart, to: weekEnd, n: weekDrafts }))) return
    setBusy(true); setErr('')
    const r = await jsonPost('/api/shift/publish', 'POST', { store, from: weekStart, to: weekEnd })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? t('saveFailed')); return }
    alert(t('publishDone', { employees: d.employees ?? 0, emailed: d.emailed ?? 0 }))
    reload()
  }

  const nameOf = (id: string) => emps.find(e => e.id === id)?.name ?? ''

  const row = (e: Emp) => {
    const av = info.avail.get(e.id) ?? []
    const mine = info.plans.filter(p => p.employee_id === e.id)
    return (
      <tr key={e.id} className="border-t">
        <td className="sticky left-0 z-10 bg-white dark:bg-gray-950 pr-2 py-1 whitespace-nowrap overflow-hidden">
          <div className="text-sm font-medium leading-tight">{e.name}</div>
          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            {e.employment_type === 'part-time' ? t('partTime') : t('fullTime')} · {t('weekHours', { h: Math.round(weekHours(e.id) * 10) / 10 })}
            {av.length > 0 && <button onClick={() => fillFromAvail(e.id)} className="text-primary hover:underline" title={t('fillFromAvailHint')}>{t('fillFromAvail')}</button>}
          </div>
        </td>
        {slots.map(m => {
          const isAv = av.some(iv => covers(iv, m))
          const plan = mine.find(p => covers({ start: p.start_min, end: p.end_min }, m))
          const inDrag = drag && drag.emp === e.id && m >= Math.min(drag.a, drag.b) && m <= Math.max(drag.a, drag.b)
          const cls = plan
            ? (plan.status === 'published' ? 'bg-blue-600' : 'bg-blue-400') + (isAv ? '' : ' ring-1 ring-inset ring-orange-400')
            : inDrag ? 'bg-blue-200'
              : isAv ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-50 dark:bg-gray-900'
          const first = plan && plan.start_min === m
          return (
            <td key={m} data-slot={m} data-emp={e.id}
              className={`relative h-9 w-[28px] min-w-[28px] max-w-[28px] border-l border-white dark:border-gray-950 cursor-pointer select-none ${m % 60 === 0 ? 'border-l-gray-200 dark:border-l-gray-800' : ''} ${cls}`}>
              {first && <span className="absolute left-0.5 top-0.5 z-[1] text-[9px] leading-none text-white whitespace-nowrap pointer-events-none">{fmtMin(plan.start_min)}–{fmtMin(plan.end_min)}</span>}
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => goWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">{weekStart} ~ {weekEnd}</span>
        <Button size="sm" variant="outline" onClick={() => goWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => { const ws = mondayOf(todayStr()); setWeekStart(ws); setDate(todayStr()) }}>{t('thisWeek')}</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowNeeds(true)}><Users className="h-4 w-4" />{t('needs')}</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAvail(true)}><CalendarPlus className="h-4 w-4" />{t('availForStaff')}</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowSales(true)}><BarChart3 className="h-4 w-4" />{t('hourlySales')}</Button>
          <Button size="sm" variant="outline" className="gap-1.5 border-violet-300 text-violet-700" onClick={() => setShowAi(true)}><Sparkles className="h-4 w-4" />{t('aiSuggest')}</Button>
          <Button size="sm" className="gap-1.5" onClick={publish} disabled={busy || weekDrafts === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t('publishWeek', { n: weekDrafts })}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const di = dayInfo(d)
          const on = d === selDate
          return (
            <button key={d} onClick={() => { setDate(d); setEditing(null) }}
              className={`rounded-lg border px-1 py-1.5 text-center ${on ? 'border-primary bg-primary/10' : 'bg-white dark:bg-gray-950'}`}>
              <div className="text-xs text-gray-500">{WD[weekdayOf(d)]}</div>
              <div className="text-sm font-semibold">{d.slice(5)}</div>
              <div className="text-[10px] leading-tight">
                {t('dayCount', { n: new Set(di.plans.map(p => p.employee_id)).size })}
                {di.short > 0 && <span className="block text-red-500">{t('dayShort', { n: di.short })}</span>}
                {di.drafts > 0 && <span className="block text-amber-600">{t('dayDrafts', { n: di.drafts })}</span>}
              </div>
            </button>
          )
        })}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <Card className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm bg-emerald-100" />{t('legendAvail')}</span>
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm bg-blue-400" />{t('legendDraft')}</span>
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm bg-blue-600" />{t('legendPublished')}</span>
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm ring-1 ring-orange-400" />{t('legendOutside')}</span>
          <span className="ml-auto">{t('dragHint')}</span>
        </div>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
          <div className="overflow-x-auto" style={{ touchAction: drag ? 'none' : 'pan-x pan-y' }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
            <table className="border-collapse table-fixed" style={{ width: 176 + slots.length * 28 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white dark:bg-gray-950 w-[176px]" />
                  {slots.map(m => <th key={m} className="relative h-5 w-[28px] min-w-[28px] max-w-[28px]">{m % 60 === 0 && <span className="absolute left-0 bottom-0.5 text-[10px] font-normal text-gray-400 whitespace-nowrap">{fmtMin(m)}</span>}</th>)}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-white dark:bg-gray-950 text-left text-[11px] font-normal text-gray-500 pr-2 whitespace-nowrap">{t('rowAvailable')}</th>
                  {slots.map(m => {
                    const n = emps.filter(e => (info.avail.get(e.id) ?? []).some(iv => covers(iv, m))).length
                    return <th key={m} className="w-[28px] text-[10px] font-normal text-emerald-700 h-5">{n || ''}</th>
                  })}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-white dark:bg-gray-950 text-left text-[11px] font-normal text-gray-500 pr-2 whitespace-nowrap">{t('rowCoverage')}</th>
                  {slots.map(m => {
                    const n = info.plans.filter(p => covers({ start: p.start_min, end: p.end_min }, m)).length
                    const need = info.need.get(m)
                    const cls = need == null ? 'text-gray-500' : n < need ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    return <th key={m} className={`w-[28px] text-[9px] font-medium h-6 whitespace-nowrap ${cls}`}>{need == null ? (n || '') : `${n}/${need}`}</th>
                  })}
                </tr>
              </thead>
              <tbody>
                {active.map(row)}
                {others.length > 0 && (
                  <tr className="border-t">
                    <td colSpan={slots.length + 1} className="py-1">
                      <button onClick={() => setShowOthers(v => !v)} className="text-xs text-gray-500 hover:underline">
                        {showOthers ? t('hideOthers') : t('showOthers', { n: others.length })}
                      </button>
                    </td>
                  </tr>
                )}
                {showOthers && others.map(row)}
              </tbody>
            </table>
            {emps.length === 0 && <p className="text-center text-sm text-gray-400 py-6">{t('noStaff')}</p>}
          </div>
        )}
      </Card>

      {editing && <PlanEditor plan={editing} name={nameOf(editing.employee_id)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      {showNeeds && <NeedsModal store={store} needs={data?.needs ?? []} WD={WD} onClose={() => setShowNeeds(false)} onChanged={reload} />}
      {showAvail && <AvailModal store={store} emps={emps} rules={data?.rules ?? []} WD={WD} onClose={() => setShowAvail(false)} onChanged={reload} />}
      {showSales && <SalesModal store={store} WD={WD} onClose={() => setShowSales(false)} />}
      {showAi && <AiSuggestModal store={store} from={weekStart} to={weekEnd} WD={WD} onClose={() => setShowAi(false)} onApplied={reload} />}
    </div>
  )
}

function TimeSelect({ value, onChange, end }: { value: number; onChange: (m: number) => void; end?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
      {timeOptions(end).filter(m => end ? m > 0 : true).map(m => <option key={m} value={m}>{fmtMin(m)}</option>)}
    </select>
  )
}

function WeekdayPicker({ value, onChange, WD }: { value: number[]; onChange: (v: number[]) => void; WD: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {WD_ORDER.map(n => (
        <button key={n} type="button" onClick={() => onChange(value.includes(n) ? value.filter(x => x !== n) : [...value, n])}
          className={`w-9 h-8 rounded-md border text-xs ${value.includes(n) ? 'bg-primary text-primary-foreground border-primary' : 'bg-white dark:bg-gray-950'}`}>{WD[n]}</button>
      ))}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-950 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PlanEditor({ plan, name, onClose, onSaved }: { plan: PlanRow; name: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('Shift')
  const [s, setS] = useState(plan.start_min)
  const [e, setE] = useState(plan.end_min)
  const [err, setErr] = useState('')
  const save = async () => {
    const r = await jsonPost('/api/shift/plans', 'PATCH', { id: plan.id, start_min: s, end_min: e })
    if (r.ok) onSaved(); else setErr((await r.json().catch(() => ({}))).error ?? t('saveFailed'))
  }
  const del = async () => {
    await jsonPost('/api/shift/plans', 'DELETE', { id: plan.id })
    onSaved()
  }
  return (
    <Card className="p-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{name} · {plan.work_date}</span>
      <TimeSelect value={s} onChange={setS} /> – <TimeSelect value={e} onChange={setE} end />
      <Button size="sm" onClick={save}>{t('save')}</Button>
      <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={del}><Trash2 className="h-4 w-4" />{t('delete')}</Button>
      <Button size="sm" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
      {plan.status === 'published' && <span className="text-xs text-amber-600">{t('editPublishedHint')}</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </Card>
  )
}

function NeedsModal({ store, needs, WD, onClose, onChanged }: { store: string; needs: NeedRule[]; WD: string[]; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('Shift')
  const [f, setF] = useState({ weekdays: [] as number[], start: 11 * 60, end: 14 * 60, headcount: 2 })
  const [err, setErr] = useState('')
  const wdText = (w: number[]) => w.length === 0 || w.length === 7 ? t('everyDay') : WD_ORDER.filter(n => w.includes(n)).map(n => WD[n]).join(' ')
  const add = async () => {
    setErr('')
    const r = await jsonPost('/api/shift/needs', 'POST', { store, weekdays: f.weekdays, start: fmtMin(f.start), end: fmtMin(f.end), headcount: f.headcount })
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? t('saveFailed')); return }
    onChanged()
  }
  const del = async (id: string) => { await jsonPost('/api/shift/needs', 'DELETE', { id }); onChanged() }
  return (
    <Modal title={t('needsTitle', { store })} onClose={onClose}>
      <p className="text-xs text-gray-500">{t('needsDesc')}</p>
      <div className="space-y-1">
        {needs.length === 0 && <p className="text-sm text-gray-400">{t('needsEmpty')}</p>}
        {needs.map(n => (
          <div key={n.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
            <span>{wdText(n.weekdays)} · {fmtMin(n.start_min)}–{fmtMin(n.end_min)} · <b>{t('people', { n: n.headcount })}</b></span>
            <button onClick={() => del(n.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="border rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-900">
        <div className="text-xs text-gray-500">{t('weekdaysHint')}</div>
        <WeekdayPicker value={f.weekdays} onChange={v => setF({ ...f, weekdays: v })} WD={WD} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <TimeSelect value={f.start} onChange={v => setF({ ...f, start: v })} /> – <TimeSelect value={f.end} onChange={v => setF({ ...f, end: v })} end />
          <input type="number" min={0} max={50} value={f.headcount} onChange={e => setF({ ...f, headcount: Number(e.target.value) || 0 })} className="h-9 w-16 rounded-md border px-2" />
          <span>{t('peopleUnit')}</span>
          <Button size="sm" onClick={add}>{t('add')}</Button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </Modal>
  )
}

function AvailModal({ store, emps, rules, WD, onClose, onChanged }: { store: string; emps: Emp[]; rules: AvailRule[]; WD: string[]; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('Shift')
  const today = todayStr()
  const [f, setF] = useState({ employee_id: emps[0]?.id ?? '', start_date: today, end_date: addDays(today, 27), weekdays: [] as number[], start: 8 * 60, end: 12 * 60 })
  const [err, setErr] = useState('')
  const wdText = (w: number[]) => w.length === 0 || w.length === 7 ? t('everyDay') : WD_ORDER.filter(n => w.includes(n)).map(n => WD[n]).join(' ')
  const add = async () => {
    setErr('')
    const r = await jsonPost('/api/shift/avail', 'POST', { store, employee_id: f.employee_id, start_date: f.start_date, end_date: f.end_date, weekdays: f.weekdays, start: fmtMin(f.start), end: fmtMin(f.end) })
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? t('saveFailed')); return }
    onChanged()
  }
  const del = async (id: string) => { await jsonPost('/api/shift/avail', 'DELETE', { id }); onChanged() }
  const mine = rules.filter(r => r.employee_id === f.employee_id)
  return (
    <Modal title={t('availTitle')} onClose={onClose}>
      <p className="text-xs text-gray-500">{t('availDesc')}</p>
      <select value={f.employee_id} onChange={e => setF({ ...f, employee_id: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
        {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <div className="space-y-1">
        {mine.map(r => (
          <div key={r.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
            <span>{r.start_date.slice(5)}~{r.end_date.slice(5)} · {wdText(r.weekdays)} · {fmtMin(r.start_min)}–{fmtMin(r.end_min)}</span>
            <button onClick={() => del(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="border rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-900">
        <div className="flex gap-2">
          <input type="date" value={f.start_date} min={today} onChange={e => setF({ ...f, start_date: e.target.value })} className="h-9 rounded-md border px-2 text-sm" />
          <input type="date" value={f.end_date} min={f.start_date} onChange={e => setF({ ...f, end_date: e.target.value })} className="h-9 rounded-md border px-2 text-sm" />
        </div>
        <div className="text-xs text-gray-500">{t('weekdaysHint')}</div>
        <WeekdayPicker value={f.weekdays} onChange={v => setF({ ...f, weekdays: v })} WD={WD} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <TimeSelect value={f.start} onChange={v => setF({ ...f, start: v })} /> – <TimeSelect value={f.end} onChange={v => setF({ ...f, end: v })} end />
          <Button size="sm" className="gap-1" onClick={add} disabled={!f.employee_id}><Wand2 className="h-4 w-4" />{t('add')}</Button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </Modal>
  )
}

const SALES_COLUMNS: ImportColumn[] = [
  { key: 'date', label: '日期', required: true, example: '2026-10-01', aliases: ['date', '日期', 'ngày', 'ngay'] },
  { key: 'hour', label: '小時', required: true, example: '15:00', aliases: ['hour', '小時', '時段', 'time', 'giờ', 'gio'] },
  { key: 'orders', label: '單數', example: 12, aliases: ['orders', '單數', '訂單數', 'số đơn', 'don'] },
  { key: 'cups', label: '杯數', example: 30, aliases: ['cups', '杯數', 'qty', '數量', 'số ly', 'ly'] },
  { key: 'revenue', label: '營收', example: 1500000, aliases: ['revenue', '營收', '金額', 'sales', 'doanh thu'] },
]

interface HourStat { weekday: number; hour: number; orders: number; cups: number; revenue: number }

// 每小時業績：匯入與近 8 週「星期 × 小時」平均杯數熱度表
function SalesModal({ store, WD, onClose }: { store: string; WD: string[]; onClose: () => void }) {
  const t = useTranslations('Shift')
  const [data, setData] = useState<{ days: number; firstDate: string | null; lastDate: string | null; stats: HourStat[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    fetch(`/api/shift/sales?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : null).then(setData)
  }, [store, tick])
  const stats = data?.stats ?? []
  const hours = [...new Set(stats.map(s => s.hour))].sort((a, b) => a - b)
  const metric = (s?: HourStat) => s ? (s.cups || s.orders) : 0
  const max = Math.max(1, ...stats.map(s => metric(s)))
  return (
    <Modal title={t('salesTitle', { store })} onClose={onClose}>
      <p className="text-xs text-gray-500">{t('salesDesc')}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{data?.days ? t('salesRange', { days: data.days, from: data.firstDate ?? '', to: data.lastDate ?? '' }) : t('salesNone')}</span>
        <Button size="sm" variant="outline" onClick={() => setImporting(true)}>{t('salesImport')}</Button>
      </div>
      {hours.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-[10px] border-collapse">
            <thead><tr><th />{hours.map(h => <th key={h} className="px-1 font-normal text-gray-400">{h}</th>)}</tr></thead>
            <tbody>
              {WD_ORDER.map(wd => (
                <tr key={wd}>
                  <td className="pr-1 text-gray-500">{WD[wd]}</td>
                  {hours.map(h => {
                    const s = stats.find(x => x.weekday === wd && x.hour === h)
                    const v = metric(s)
                    return <td key={h} title={s ? `${s.cups} / ${s.orders} / ${s.revenue}` : ''} className="w-7 h-6 text-center"
                      style={{ background: v ? `rgba(124, 58, 237, ${0.12 + 0.75 * v / max})` : undefined, color: v / max > 0.55 ? 'white' : undefined }}>{v ? Math.round(v) : ''}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-1">{t('salesHeatHint')}</p>
        </div>
      )}
      {importing && (
        <ExcelImportModal
          title={t('salesImportTitle', { store })}
          description={t('salesImportDesc')}
          columns={SALES_COLUMNS}
          templateFilename="hourly-sales"
          sheetName="hourly"
          onClose={() => setImporting(false)}
          onSuccess={() => setTick(x => x + 1)}
          onSubmit={async rows => (await jsonPost('/api/shift/sales', 'POST', { store, rows })).json()}
        />
      )}
    </Modal>
  )
}

interface Proposal { employee_id: string; name: string; work_date: string; start_min: number; end_min: number; reason: string }
interface SuggestedNeed { weekdays: number[]; start_min: number; end_min: number; headcount: number }

// AI 排班建議：依可上班時段、人力需求、既有班表與每小時業績產生草稿，勾選後套用
function AiSuggestModal({ store, from, to, WD, onClose, onApplied }: { store: string; from: string; to: string; WD: string[]; onClose: () => void; onApplied: () => void }) {
  const t = useTranslations('Shift')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<{ summary: string; staffing_advice: string; suggested_needs: SuggestedNeed[]; proposals: Proposal[]; rejected: number; sales_days: number } | null>(null)
  const [pick, setPick] = useState<Set<number>>(new Set())
  const [done, setDone] = useState('')
  const run = async () => {
    setBusy(true); setErr(''); setDone('')
    const r = await jsonPost('/api/shift/ai-suggest', 'POST', { store, from, to })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? t('saveFailed')); return }
    setRes(d)
    setPick(new Set((d.proposals ?? []).map((_: Proposal, i: number) => i)))
  }
  const apply = async () => {
    if (!res) return
    setBusy(true); setErr('')
    const items = res.proposals.filter((_, i) => pick.has(i)).map(p => ({ employee_id: p.employee_id, work_date: p.work_date, start_min: p.start_min, end_min: p.end_min }))
    const r = await jsonPost('/api/shift/plans', 'POST', { store, items })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? t('saveFailed')); return }
    setDone(t('aiApplied', { n: d.created ?? 0, failed: (d.errors ?? []).length }))
    onApplied()
  }
  const applyNeeds = async () => {
    if (!res || !confirm(t('aiNeedsConfirm'))) return
    const r = await jsonPost('/api/shift/needs', 'PUT', { store, items: res.suggested_needs })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(d.error ?? t('saveFailed')); return }
    setDone(t('aiNeedsApplied', { n: d.saved ?? 0 }))
    onApplied()
  }
  const wdText = (w: number[]) => w.length === 0 || w.length === 7 ? t('everyDay') : WD_ORDER.filter(n => w.includes(n)).map(n => WD[n]).join(' ')
  const byDate = res ? [...new Set(res.proposals.map(p => p.work_date))].sort() : []
  return (
    <Modal title={t('aiTitle', { from, to })} onClose={onClose}>
      <p className="text-xs text-gray-500">{t('aiDesc')}</p>
      {!res && (
        <Button onClick={run} disabled={busy} className="w-full gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? t('aiRunning') : t('aiRun')}
        </Button>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {res && (
        <div className="space-y-3">
          {res.sales_days === 0 && <p className="text-xs text-amber-600">{t('aiNoSales')}</p>}
          {res.summary && <p className="text-sm whitespace-pre-wrap">{res.summary}</p>}
          {res.staffing_advice && <p className="text-sm text-violet-700 dark:text-violet-300 whitespace-pre-wrap">{res.staffing_advice}</p>}
          {res.suggested_needs.length > 0 && (
            <div className="rounded-lg border p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{t('aiSuggestedNeeds')}</span>
                <Button size="sm" variant="outline" onClick={applyNeeds}>{t('aiApplyNeeds')}</Button>
              </div>
              {res.suggested_needs.map((n, i) => <div key={i} className="text-xs text-gray-600">{wdText(n.weekdays)} · {fmtMin(n.start_min)}–{fmtMin(n.end_min)} · {t('people', { n: n.headcount })}</div>)}
            </div>
          )}
          {res.proposals.length === 0 ? <p className="text-sm text-gray-400">{t('aiNoProposals')}</p> : (
            <div className="space-y-2">
              {byDate.map(d => (
                <div key={d}>
                  <div className="text-xs font-semibold text-gray-500">{d} ({WD[weekdayOf(d)]})</div>
                  {res.proposals.map((p, i) => p.work_date !== d ? null : (
                    <label key={i} className="flex items-start gap-2 text-sm py-0.5">
                      <input type="checkbox" checked={pick.has(i)} onChange={() => setPick(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })} className="mt-1" />
                      <span><b>{p.name}</b> {fmtMin(p.start_min)}–{fmtMin(p.end_min)}{p.reason && <span className="text-xs text-gray-500"> · {p.reason}</span>}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
          {res.rejected > 0 && <p className="text-[11px] text-gray-400">{t('aiRejected', { n: res.rejected })}</p>}
          {done && <p className="text-sm text-emerald-700">{done}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={run} disabled={busy}>{t('aiRerun')}</Button>
            <Button size="sm" onClick={apply} disabled={busy || pick.size === 0}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('aiApply', { n: pick.size })}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
