'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, RefreshCw, X, RotateCcw, Save, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getStoreKindLabel, type PnlLine } from './pnl-schema'

export interface Store { id: string; code: string; name: string; name_vi: string; kind: string; sort: number }
interface Entry { store_id: string; line_code: string; amount: number; source: string }
interface SeriesRow { period: string; line_code: string; amount: number; source: string }
type Vals = Record<string, number>

const HQ_CODE = '__HQ__'
const fmt = (n: number, locale: string) => n === 0 ? '–' : Math.round(n).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')
const pct = (v: number, base: number) => base && v ? (v / base * 100).toFixed(1) + '%' : ''
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const editable = (l: PnlLine) => l.kind === 'detail' || l.kind === 'revenue'

// 依存值＋科目樹公式，解出每個科目的最終值（存值優先，缺值才套公式）
export function resolveStore(vals: Vals, lines: PnlLine[], map: Record<string, PnlLine>): Vals {
  const out: Vals = {}
  const visiting = new Set<string>()
  const get = (code: string): number => {
    if (code in out) return out[code]
    if (code in vals) { out[code] = vals[code]; return out[code] }
    const line = map[code]
    if (!line?.compute) { out[code] = 0; return 0 }
    if (visiting.has(code)) return 0
    visiting.add(code)
    const c = line.compute
    let r = 0
    if (c.op === 'sum') r = c.codes.reduce((s, x) => s + get(x), 0)
    else if (c.op === 'sumSection') r = lines.filter(l => l.section === c.section && l.kind === 'detail').reduce((s, l) => s + get(l.code), 0)
    else if (c.op === 'sub') r = get(c.left) - get(c.right)
    else if (c.op === 'subMany') r = c.minus.reduce((s, x) => s - get(x), get(c.base))
    visiting.delete(code)
    out[code] = r
    return r
  }
  for (const l of lines) get(l.code)
  return out
}

const rowBg = (kind: string) => kind === 'revenue' ? 'bg-blue-50 dark:bg-blue-950/40 font-bold' : kind === 'subtotal' ? 'bg-gray-100 dark:bg-gray-800 font-semibold' : 'bg-white dark:bg-gray-950'

interface Col { key: string; title: string; sub?: string; vals: Vals; manual: Set<string>; logs?: Record<string, number>; storeId?: string; period?: string }

/** 共用表格：科目為列、欄（門市或月份）並排；第一欄固定窄寬、可左右捲動 */
function PnlTable({ cols, lines, showPct, onCell }: { cols: Col[]; lines: PnlLine[]; showPct: boolean; onCell?: (c: Col, l: PnlLine) => void }) {
  const t = useTranslations('FinancePage')
  const locale = useLocale()
  return (
    <div className="overflow-auto max-h-[75vh] border rounded-xl">
      <table className="text-sm border-separate border-spacing-0 w-max min-w-full">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-gray-900 text-left px-2 py-2 border-b border-r w-40 min-w-40 max-w-40">{t('lineColHeader')}</th>
            {cols.map(c => (
              <th key={c.key} className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 px-2 py-2 border-b border-r text-right min-w-[112px] max-w-[160px]">
                <div className="font-semibold truncate" title={c.title}>{c.title}</div>
                {c.sub && <div className="text-[10px] font-normal text-gray-400 truncate">{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map(line => (
            <tr key={line.code}>
              <td className={`sticky left-0 z-10 px-2 py-1 border-b border-r w-40 min-w-40 max-w-40 ${rowBg(line.kind)}`}>
                <div className="truncate" title={`${line.zh} ${line.vi}`}>{line.zh}</div>
                <div className="text-[10px] text-gray-400 font-normal truncate">{line.vi}</div>
              </td>
              {cols.map(c => {
                const v = c.vals[line.code] ?? 0
                const manual = c.manual.has(line.code)
                const logs = c.logs?.[line.code] ?? 0
                const click = onCell && c.storeId && c.period && editable(line)
                return (
                  <td key={c.key}
                    onClick={click ? () => onCell!(c, line) : undefined}
                    title={manual ? t('pnlManualTip') : click ? t('pnlClickTip') : undefined}
                    className={`px-2 py-1 border-b border-r text-right tabular-nums whitespace-nowrap ${rowBg(line.kind)} ${manual ? '!bg-amber-50 dark:!bg-amber-950/40' : ''} ${click ? 'cursor-pointer hover:!bg-blue-100 dark:hover:!bg-blue-900/40' : ''}`}>
                    <div className="flex items-center justify-end gap-1">
                      {manual && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
                      {!manual && logs > 0 && <History className="h-3 w-3 text-gray-300 shrink-0" />}
                      <span className={v < 0 ? 'text-red-600' : ''}>{fmt(v, locale)}</span>
                    </div>
                    {showPct && line.kind !== 'revenue' && <div className="text-[10px] text-gray-400 leading-tight">{pct(v, c.vals.revenue ?? 0)}&nbsp;</div>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 多店比較：月份固定，門市並排 ──
export function CompareView({ lines: allLines }: { lines: PnlLine[] }) {
  const t = useTranslations('FinancePage')
  const STORE_KIND_LABEL = getStoreKindLabel(t)
  const [stores, setStores] = useState<Store[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [auto, setAuto] = useState<Record<string, Vals>>({})
  const [logCounts, setLogCounts] = useState<Record<string, number>>({})
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState(thisMonth())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [hideEmpty, setHideEmpty] = useState(true)
  const [showPct, setShowPct] = useState(true)
  const [cell, setCell] = useState<{ store: Store; line: PnlLine } | null>(null)

  const lineMap = useMemo(() => Object.fromEntries(allLines.map(l => [l.code, l])), [allLines])
  const lines = useMemo(() => allLines.filter(l => l.section !== 'compare' && !l.archived), [allLines])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const res = await fetch(`/api/hr/pnl?period=${period}`)
      const j = await res.json()
      if (!res.ok) { setErr(j.error ?? t('loadFailed')); return }
      setStores(j.stores ?? []); setEntries(j.entries ?? []); setAuto(j.auto ?? {})
      setPeriods(j.periods ?? []); setLogCounts(j.logCounts ?? {})
    } finally { setLoading(false) }
  }, [period, t])
  useEffect(() => { load() }, [load])

  const cols = useMemo(() => {
    const manualBy: Record<string, Set<string>> = {}
    const valsBy: Record<string, Vals> = {}
    for (const s of stores) { valsBy[s.id] = { ...(auto[s.id] ?? {}) }; manualBy[s.id] = new Set() }
    for (const e of entries) {
      if (!valsBy[e.store_id]) continue
      valsBy[e.store_id][e.line_code] = Number(e.amount) || 0
      manualBy[e.store_id].add(e.line_code)
    }
    const storeCols: Col[] = stores.map(s => {
      const logs: Record<string, number> = {}
      for (const [k, n] of Object.entries(logCounts)) { const [sid, lc] = k.split('|'); if (sid === s.id) logs[lc] = n }
      return {
        key: s.id, storeId: s.id, period, title: s.code === HQ_CODE ? t('pnlHqCol') : s.name,
        sub: s.code === HQ_CODE ? t('pnlHqSub') : `${s.code} · ${STORE_KIND_LABEL[s.kind] ?? s.kind}`,
        vals: resolveStore(valsBy[s.id], allLines, lineMap), manual: manualBy[s.id], logs,
      }
    })
    const visible = hideEmpty ? storeCols.filter(c => lines.some(l => l.kind !== 'subtotal' && (c.vals[l.code] ?? 0) !== 0)) : storeCols
    const total: Vals = {}
    for (const l of lines) total[l.code] = visible.reduce((s, c) => s + (c.vals[l.code] ?? 0), 0)
    return [{ key: '__total', title: t('pnlTotalCol'), sub: t('pnlStoreCount', { n: visible.length }), vals: total, manual: new Set<string>() }, ...visible]
  }, [stores, entries, auto, logCounts, allLines, lineMap, lines, hideEmpty, period, t, STORE_KIND_LABEL])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">{t('monthLabel')}</span>
        <Input type="month" value={period} onChange={e => e.target.value && setPeriod(e.target.value)} className="h-8 w-40 text-sm" />
        {periods.length > 0 && (
          <select value={periods.includes(period) ? period : ''} onChange={e => e.target.value && setPeriod(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="">{t('periodsWithDataPlaceholder')}</option>
            {periods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t('refresh')}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-2"><input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />{t('pnlHideEmpty')}</label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} />{t('pnlShowPct')}</label>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        {t('pnlAutoHint')} <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t('pnlManualLegend')}</span>
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading && stores.length === 0
        ? <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : <PnlTable cols={cols} lines={lines} showPct={showPct}
            onCell={(c, l) => { const s = stores.find(x => x.id === c.storeId); if (s) setCell({ store: s, line: l }) }} />}
      {cell && <CellDialog period={period} store={cell.store} line={cell.line} onClose={() => setCell(null)} onSaved={() => { setCell(null); load() }} />}
    </div>
  )
}

// ── 單店趨勢：選一門市，近 12 個月並排 ──
export function TrendView({ stores, lines: allLines }: { stores: Store[]; lines: PnlLine[] }) {
  const t = useTranslations('FinancePage')
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [auto, setAuto] = useState<Record<string, Vals>>({})
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showPct, setShowPct] = useState(true)
  const [cell, setCell] = useState<{ period: string; line: PnlLine } | null>(null)

  const lineMap = useMemo(() => Object.fromEntries(allLines.map(l => [l.code, l])), [allLines])
  const lines = useMemo(() => allLines.filter(l => l.section !== 'compare' && !l.archived), [allLines])
  useEffect(() => { if (!storeId && stores[0]) setStoreId(stores[0].id) }, [stores, storeId])

  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/pnl?store_id=${storeId}&months=12`)
      const j = await res.json()
      setAuto(j.auto ?? {}); setSeries(j.series ?? [])
    } finally { setLoading(false) }
  }, [storeId])
  useEffect(() => { load() }, [load])

  const cols = useMemo(() => {
    const months = Array.from(new Set([...Object.keys(auto), ...series.map(r => r.period)])).sort().reverse()
    return months.map(m => {
      const vals: Vals = { ...(auto[m] ?? {}) }
      const manual = new Set<string>()
      for (const r of series) if (r.period === m) { vals[r.line_code] = Number(r.amount) || 0; manual.add(r.line_code) }
      return { key: m, title: m, vals: resolveStore(vals, allLines, lineMap), manual, storeId, period: m } as Col
    })
  }, [auto, series, allLines, lineMap, storeId])

  const store = stores.find(s => s.id === storeId)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">{t('storeLabel')}</span>
        <select value={storeId} onChange={e => setStoreId(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm min-w-[140px]">
          {stores.map(s => <option key={s.id} value={s.id}>{s.code === HQ_CODE ? t('pnlHqCol') : s.name}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t('refresh')}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-2"><input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} />{t('pnlShowPct')}</label>
      </div>
      {loading && cols.length === 0
        ? <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : cols.length === 0
          ? <div className="py-12 text-center text-gray-400 text-sm">{t('noMonthDataForStore')}</div>
          : <PnlTable cols={cols} lines={lines} showPct={showPct} onCell={(c, l) => setCell({ period: c.period!, line: l })} />}
      {cell && store && <CellDialog period={cell.period} store={store} line={cell.line} onClose={() => setCell(null)} onSaved={() => { setCell(null); load() }} />}
    </div>
  )
}

// ── 單格明細：來源、人工修改（需填原因）、改回自動、修改紀錄 ──
interface Detail {
  auto: number
  entry: { amount: number; source: string; updated_at: string } | null
  contributions: { src: string; label: string; amount: number; total: number; split: number; date?: string; category?: string }[]
  contributionCount: number
  logs: { action: string; old_amount: number | null; new_amount: number | null; auto_amount: number | null; reason: string; user_name: string; created_at: string }[]
}

function CellDialog({ period, store, line, onClose, onSaved }: { period: string; store: Store; line: PnlLine; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('FinancePage')
  const locale = useLocale()
  const [d, setD] = useState<Detail | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/hr/pnl/detail?period=${period}&store_id=${store.id}&line_code=${line.code}`)
      .then(r => r.json()).then((j: Detail & { error?: string }) => {
        if (j.error) { setErr(j.error); return }
        setD(j); setAmount(String(Math.round(Number(j.entry?.amount ?? j.auto) || 0)))
      })
  }, [period, store.id, line.code])

  const submit = async (revert: boolean) => {
    if (!reason.trim()) { setErr(t('pnlReasonRequired')); return }
    const n = Number(amount.replace(/[,\s]/g, ''))
    if (!revert && !Number.isFinite(n)) { setErr(t('pnlAmountInvalid')); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/hr/pnl', {
        method: revert ? 'DELETE' : 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revert
          ? { period, store_id: store.id, line_code: line.code, reason }
          : { period, reason, values: [{ store_id: store.id, line_code: line.code, amount: n }] }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error ?? t('saveFailed')); return }
      onSaved()
    } finally { setSaving(false) }
  }

  const srcLabel = (s: string) => s === 'payroll' ? t('pnlSrcPayroll') : s === 'bill' ? t('pnlSrcBill') : s === 'pos' ? t('pnlSrcPos') : s === 'inventory' ? t('pnlSrcInventory') : t('pnlSrcCashflow')
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-4 border-b sticky top-0 bg-white dark:bg-gray-900">
          <div>
            <div className="font-semibold">{line.zh} <span className="text-xs text-gray-400">{line.vi}</span></div>
            <div className="text-xs text-gray-500">{store.code === HQ_CODE ? t('pnlHqCol') : store.name} · {period}</div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {!d ? (
          <div className="p-8 flex justify-center text-gray-400">{err ? <span className="text-red-600 text-sm">{err}</span> : <Loader2 className="h-6 w-6 animate-spin" />}</div>
        ) : (
          <div className="p-4 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-gray-500">{t('pnlAutoValue')}</div>
                <div className="text-lg font-semibold tabular-nums">{fmt(d.auto, locale)}</div>
              </div>
              <div className={`rounded-lg border p-3 ${d.entry ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200' : ''}`}>
                <div className="text-xs text-gray-500">{t('pnlManualValue')}</div>
                <div className="text-lg font-semibold tabular-nums">{d.entry ? fmt(Number(d.entry.amount), locale) : '—'}</div>
                {d.entry && <div className="text-[10px] text-gray-400">{d.entry.source} · {new Date(d.entry.updated_at).toLocaleString()}</div>}
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="text-xs font-medium text-gray-600">{t('pnlEditTitle')}</div>
              <div className="flex flex-wrap gap-2">
                <Input value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" className="h-8 w-44 text-sm tabular-nums" />
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('pnlReasonPlaceholder')} className="h-8 flex-1 min-w-[180px] text-sm" />
              </div>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submit(false)} disabled={saving} className="h-8 gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('pnlSaveManual')}
                </Button>
                {d.entry && (
                  <Button size="sm" variant="outline" onClick={() => submit(true)} disabled={saving} className="h-8 gap-1.5">
                    <RotateCcw className="h-4 w-4" />{t('pnlRevertAuto')}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">{t('pnlSources', { n: d.contributionCount })}</div>
              {d.contributions.length === 0 ? <p className="text-xs text-gray-400">{t('pnlNoSources')}</p> : (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {d.contributions.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1 whitespace-nowrap text-gray-400">{c.date ?? ''}</td>
                          <td className="px-2 py-1">
                            <div>{c.label}</div>
                            <div className="text-[10px] text-gray-400">{srcLabel(c.src)}{c.category ? ` · ${c.category}` : ''}{c.split > 1 ? ` · ${t('pnlSplit', { n: c.split, total: fmt(c.total, locale) })}` : ''}</div>
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{fmt(c.amount, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">{t('pnlLogs')}</div>
              {d.logs.length === 0 ? <p className="text-xs text-gray-400">{t('pnlNoLogs')}</p> : (
                <ul className="space-y-1.5">
                  {d.logs.map((l, i) => (
                    <li key={i} className="text-xs border-l-2 border-amber-300 pl-2">
                      <div className="text-gray-500">{new Date(l.created_at).toLocaleString()} · {l.user_name || '—'}</div>
                      <div>
                        {l.action === 'revert'
                          ? t('pnlLogRevert', { old: fmt(Number(l.old_amount ?? 0), locale), auto: fmt(Number(l.auto_amount ?? 0), locale) })
                          : t('pnlLogSet', { old: fmt(Number(l.old_amount ?? 0), locale), next: fmt(Number(l.new_amount ?? 0), locale), auto: fmt(Number(l.auto_amount ?? 0), locale) })}
                      </div>
                      {l.reason && <div className="text-gray-500">{t('pnlLogReason')}{l.reason}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 營業額／庫存比對：iPOS 營業額 vs 出納門市收入；進銷存規定用量 vs 實耗 ──
interface Recon { pos_revenue: number; cash_revenue: number; has_pos: boolean; inv_expected: number; inv_actual: number; inv_loss: number; has_inv: boolean; missing_price: number }

export function ReconView() {
  const t = useTranslations('FinancePage')
  const locale = useLocale()
  const [period, setPeriod] = useState(thisMonth())
  const [stores, setStores] = useState<Store[]>([])
  const [recon, setRecon] = useState<Record<string, Recon>>({})
  const [skipped, setSkipped] = useState(0)
  const [loading, setLoading] = useState(false)
  const [onlyData, setOnlyData] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/pnl?period=${period}`)
      const j = await res.json()
      setStores(j.stores ?? []); setRecon(j.recon ?? {}); setSkipped(Number(j.purchasesSkipped) || 0)
    } finally { setLoading(false) }
  }, [period])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => stores
    .map(s => ({ s, r: recon[s.id] }))
    .filter(x => x.s.kind === 'store' || x.r)
    .filter(x => !onlyData || x.r?.has_pos || x.r?.has_inv || (x.r?.cash_revenue ?? 0) !== 0), [stores, recon, onlyData])
  const tot = rows.reduce((a, { r }) => {
    if (!r) return a
    a.pos += r.pos_revenue; a.cash += r.cash_revenue; a.exp += r.inv_expected; a.act += r.inv_actual; a.loss += r.inv_loss
    return a
  }, { pos: 0, cash: 0, exp: 0, act: 0, loss: 0 })
  const posCount = rows.filter(x => x.r?.has_pos).length, invCount = rows.filter(x => x.r?.has_inv).length
  const storeCount = rows.filter(x => x.s.kind === 'store').length
  const pctTxt = (a: number, b: number) => b ? `${(a / b * 100).toFixed(1)}%` : '–'
  const f = (n: number) => fmt(n, locale)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">{t('monthLabel')}</span>
        <Input type="month" value={period} onChange={e => e.target.value && setPeriod(e.target.value)} className="h-8 w-40 text-sm" />
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t('refresh')}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-2"><input type="checkbox" checked={onlyData} onChange={e => setOnlyData(e.target.checked)} />{t('reconOnlyData')}</label>
        <a href="/store-reports" className="ml-auto text-xs text-blue-600 hover:underline">{t('reconImportLink')}</a>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 ${posCount < storeCount ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{t('reconPosStatus', { n: posCount, total: storeCount })}</span>
        <span className={`rounded-full px-2.5 py-1 ${invCount < storeCount ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{t('reconInvStatus', { n: invCount, total: storeCount })}</span>
        {skipped > 0 && <span className="rounded-full px-2.5 py-1 bg-gray-100 text-gray-600">{t('reconPurchasesSkipped', { amt: f(skipped) })}</span>}
      </div>
      <p className="text-xs text-gray-500">{t('reconHint')}</p>
      <div className="overflow-auto max-h-[75vh] border rounded-xl">
        <table className="text-sm border-separate border-spacing-0 w-max min-w-full">
          <thead>
            <tr className="text-xs">
              <th rowSpan={2} className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-gray-900 text-left px-2 py-2 border-b border-r w-40 min-w-40">{t('storeLabel')}</th>
              <th colSpan={4} className="sticky top-0 z-20 bg-blue-50 dark:bg-blue-950 px-2 py-1 border-b border-r">{t('reconRevenueGroup')}</th>
              <th colSpan={4} className="sticky top-0 z-20 bg-emerald-50 dark:bg-emerald-950 px-2 py-1 border-b">{t('reconInvGroup')}</th>
            </tr>
            <tr className="text-xs">
              {[t('reconPos'), t('reconCash'), t('reconDiff'), t('reconCashShare'), t('reconExpected'), t('reconActual'), t('reconLoss'), t('reconLossPct')].map((h, i) => (
                <th key={i} className="sticky top-8 z-20 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 border-b border-r text-right whitespace-nowrap min-w-[104px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, r }) => {
              const x = r ?? { pos_revenue: 0, cash_revenue: 0, has_pos: false, inv_expected: 0, inv_actual: 0, inv_loss: 0, has_inv: false, missing_price: 0 }
              const lossPct = x.inv_expected ? x.inv_loss / x.inv_expected * 100 : 0
              return (
                <tr key={s.id}>
                  <td className="sticky left-0 z-10 bg-white dark:bg-gray-950 px-2 py-1.5 border-b border-r w-40 min-w-40">
                    <div className="truncate">{s.code === HQ_CODE ? t('pnlHqCol') : s.name}</div>
                    <div className="text-[10px] text-gray-400">{s.code === HQ_CODE ? '' : s.code}</div>
                  </td>
                  <td className="px-2 py-1.5 border-b border-r text-right tabular-nums">{x.has_pos ? f(x.pos_revenue) : <span className="text-[11px] text-amber-600">{t('reconNoPos')}</span>}</td>
                  <td className="px-2 py-1.5 border-b border-r text-right tabular-nums">{f(x.cash_revenue)}</td>
                  <td className="px-2 py-1.5 border-b border-r text-right tabular-nums">{x.has_pos ? f(x.pos_revenue - x.cash_revenue) : '–'}</td>
                  <td className="px-2 py-1.5 border-b border-r text-right tabular-nums">{x.has_pos ? pctTxt(x.cash_revenue, x.pos_revenue) : '–'}</td>
                  <td className="px-2 py-1.5 border-b border-r text-right tabular-nums">{x.has_inv ? f(x.inv_expected) : <span className="text-[11px] text-amber-600">{t('reconNoInv')}</span>}</td>
                  <td className="px-2 py-1.5 border-b border-r text-right tabular-nums">{x.has_inv ? f(x.inv_actual) : '–'}</td>
                  <td className={`px-2 py-1.5 border-b border-r text-right tabular-nums ${x.inv_loss > 0 ? 'text-red-600' : ''}`}>{x.has_inv ? f(x.inv_loss) : '–'}</td>
                  <td className={`px-2 py-1.5 border-b text-right tabular-nums ${lossPct > 5 ? 'text-red-600 font-semibold' : ''}`}>
                    {x.has_inv ? `${lossPct.toFixed(1)}%` : '–'}
                    {x.missing_price > 0 && <div className="text-[10px] text-amber-600">{t('reconMissingPrice', { n: x.missing_price })}</div>}
                  </td>
                </tr>
              )
            })}
            <tr className="font-semibold bg-gray-50 dark:bg-gray-900">
              <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 border-r">{t('pnlTotalCol')}</td>
              <td className="px-2 py-1.5 border-r text-right tabular-nums">{f(tot.pos)}</td>
              <td className="px-2 py-1.5 border-r text-right tabular-nums">{f(tot.cash)}</td>
              <td className="px-2 py-1.5 border-r text-right tabular-nums">{f(tot.pos - tot.cash)}</td>
              <td className="px-2 py-1.5 border-r text-right tabular-nums">{pctTxt(tot.cash, tot.pos)}</td>
              <td className="px-2 py-1.5 border-r text-right tabular-nums">{f(tot.exp)}</td>
              <td className="px-2 py-1.5 border-r text-right tabular-nums">{f(tot.act)}</td>
              <td className="px-2 py-1.5 border-r text-right tabular-nums">{f(tot.loss)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{tot.exp ? `${(tot.loss / tot.exp * 100).toFixed(1)}%` : '–'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
