'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Plus, RefreshCw, X, Columns3, LineChart, Settings2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STORE_KIND_LABEL, type PnlLine } from './pnl-schema'
import PnlSchemaEditor from './PnlSchemaEditor'
import PnlImportSchema from './PnlImportSchema'

interface Store { id: string; code: string; name: string; name_vi: string; kind: string; sort: number }
interface Entry { store_id: string; line_code: string; amount: number }
interface SeriesRow { period: string; line_code: string; amount: number }

const fmt = (n: number) => n === 0 ? '–' : Math.round(n).toLocaleString('zh-TW')
const pct = (v: number, base: number) => base ? (v / base * 100).toFixed(2) + '%' : '–'
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

// 依存值＋科目樹公式，解出單一門市每個科目的最終值（存值優先，缺值才套公式）
function resolveStore(vals: Record<string, number>, lines: PnlLine[], map: Record<string, PnlLine>): Record<string, number> {
  const out: Record<string, number> = {}
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

const rowStyle = (kind: string) =>
  kind === 'revenue' ? 'bg-primary/10 font-bold'
    : kind === 'subtotal' ? 'bg-gray-100 font-semibold'
      : ''

export default function PnlReport() {
  const [mode, setMode] = useState<'compare' | 'trend'>('compare')
  const [stores, setStores] = useState<Store[]>([])
  const [lines, setLines] = useState<PnlLine[]>([])
  const [loadingSchema, setLoadingSchema] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [importing, setImporting] = useState(false)

  // 共用：載入門市清單（兩種檢視都要）
  const loadStores = useCallback(async (): Promise<Store[]> => {
    const res = await fetch('/api/hr/pnl')
    const j = await res.json()
    setStores(j.stores ?? [])
    return j.stores ?? []
  }, [])

  // 載入自訂科目樹（首次由後端種入預設 + 建一個 A門市）
  const loadSchema = useCallback(async () => {
    setLoadingSchema(true)
    try {
      const res = await fetch('/api/hr/pnl/schema')
      const j = await res.json()
      setLines(j.lines ?? [])
    } finally { setLoadingSchema(false) }
  }, [])

  useEffect(() => { loadStores(); loadSchema() }, [loadStores, loadSchema])

  if (editing) {
    return (
      <PnlSchemaEditor
        initial={lines}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); loadSchema(); loadStores() }}
      />
    )
  }

  if (importing) {
    return (
      <PnlImportSchema
        onClose={() => setImporting(false)}
        onSaved={() => { setImporting(false); loadSchema(); loadStores() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          <button onClick={() => setMode('compare')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
            style={mode === 'compare' ? { background: 'white', color: 'var(--primary)' } : { color: '#6b7280' }}>
            <Columns3 className="h-4 w-4" />多店比較
          </button>
          <button onClick={() => setMode('trend')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
            style={mode === 'trend' ? { background: 'white', color: 'var(--primary)' } : { color: '#6b7280' }}>
            <LineChart className="h-4 w-4" />單店趨勢
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setImporting(true)} className="gap-1.5 h-8 ml-auto">
          <Upload className="h-4 w-4" />報表匯入
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5 h-8">
          <Settings2 className="h-4 w-4" />科目設定
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5 h-8">
          <Plus className="h-4 w-4" />新增門市
        </Button>
      </div>

      {adding && <AddStoreForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); loadStores() }} nextSort={stores.length} />}

      {loadingSchema ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : stores.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          尚無門市。先「新增門市」，再以「資料匯入」帶入各月損益數字。
        </div>
      ) : mode === 'compare' ? (
        <CompareView stores={stores} lines={lines} />
      ) : (
        <TrendView stores={stores} lines={lines} />
      )}
    </div>
  )
}

// ── 多店比較：月份固定，門市並排（科目為列） ──
function CompareView({ stores, lines: allLines }: { stores: Store[]; lines: PnlLine[] }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState(thisMonth())
  const [loading, setLoading] = useState(false)

  const lineMap = useMemo(() => Object.fromEntries(allLines.map(l => [l.code, l])), [allLines])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/pnl?period=${period}`)
      const j = await res.json()
      setEntries(j.entries ?? [])
      setPeriods(j.periods ?? [])
    } finally { setLoading(false) }
  }, [period])
  useEffect(() => { load() }, [load])

  const resolved = useMemo(() => {
    const byStore: Record<string, Record<string, number>> = {}
    for (const s of stores) byStore[s.id] = {}
    for (const e of entries) {
      if (!byStore[e.store_id]) byStore[e.store_id] = {}
      byStore[e.store_id][e.line_code] = Number(e.amount) || 0
    }
    const out: Record<string, Record<string, number>> = {}
    for (const s of stores) out[s.id] = resolveStore(byStore[s.id] ?? {}, allLines, lineMap)
    return out
  }, [stores, entries, allLines, lineMap])

  const lines = useMemo(() => allLines.filter(l => l.section !== 'compare' && !l.archived), [allLines])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">月份</span>
        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-8 w-40 text-sm" />
        {periods.length > 0 && (
          <select value={periods.includes(period) ? period : ''} onChange={e => e.target.value && setPeriod(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm">
            <option value="">— 已有資料月份 —</option>
            {periods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}重新整理
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-xl">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 border-b border-r min-w-[180px]">科目</th>
              {stores.map(s => (
                <th key={s.id} className="px-3 py-2 border-b border-r text-right min-w-[120px] whitespace-nowrap">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[10px] font-normal text-gray-400">{STORE_KIND_LABEL[s.kind] ?? s.kind}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.code} className={rowStyle(line.kind)}>
                <td className={`sticky left-0 z-10 px-3 py-1.5 border-b border-r whitespace-nowrap ${rowStyle(line.kind) || 'bg-white'}`}>
                  {line.zh}<span className="ml-1.5 text-[10px] text-gray-400">{line.vi}</span>
                </td>
                {stores.map(s => {
                  const v = resolved[s.id]?.[line.code] ?? 0
                  const base = resolved[s.id]?.revenue ?? 0
                  return (
                    <td key={s.id} className="px-3 py-1.5 border-b border-r text-right tabular-nums whitespace-nowrap">
                      <span className={v < 0 ? 'text-red-600' : ''}>{fmt(v)}</span>
                      {line.kind !== 'revenue' && <span className="ml-1.5 text-[10px] text-gray-400">{pct(v, base)}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 單店趨勢：選一門市，月份並排（科目為列），看逐月走勢 ──
function TrendView({ stores, lines: allLines }: { stores: Store[]; lines: PnlLine[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [loading, setLoading] = useState(false)

  const lineMap = useMemo(() => Object.fromEntries(allLines.map(l => [l.code, l])), [allLines])

  useEffect(() => { if (!storeId && stores[0]) setStoreId(stores[0].id) }, [stores, storeId])

  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/pnl?store_id=${storeId}`)
      const j = await res.json()
      setSeries(j.series ?? [])
    } finally { setLoading(false) }
  }, [storeId])
  useEffect(() => { load() }, [load])

  // 所有出現過的月份（由新到舊）
  const months = useMemo(() => Array.from(new Set(series.map(r => r.period))).sort().reverse(), [series])

  // 每月解析後的科目值
  const byMonth = useMemo(() => {
    const raw: Record<string, Record<string, number>> = {}
    for (const r of series) {
      (raw[r.period] ??= {})[r.line_code] = Number(r.amount) || 0
    }
    const out: Record<string, Record<string, number>> = {}
    for (const m of months) out[m] = resolveStore(raw[m] ?? {}, allLines, lineMap)
    return out
  }, [series, months, allLines, lineMap])

  const lines = useMemo(() => allLines.filter(l => l.section !== 'compare' && !l.archived), [allLines])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">門市</span>
        <select value={storeId} onChange={e => setStoreId(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm min-w-[140px]">
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}重新整理
        </Button>
      </div>

      {months.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">此門市尚無任何月份資料。</div>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="text-sm border-collapse w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 border-b border-r min-w-[180px]">科目</th>
                {months.map(m => (
                  <th key={m} className="px-3 py-2 border-b border-r text-right min-w-[120px] whitespace-nowrap font-semibold">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <tr key={line.code} className={rowStyle(line.kind)}>
                  <td className={`sticky left-0 z-10 px-3 py-1.5 border-b border-r whitespace-nowrap ${rowStyle(line.kind) || 'bg-white'}`}>
                    {line.zh}<span className="ml-1.5 text-[10px] text-gray-400">{line.vi}</span>
                  </td>
                  {months.map(m => {
                    const v = byMonth[m]?.[line.code] ?? 0
                    const base = byMonth[m]?.revenue ?? 0
                    return (
                      <td key={m} className="px-3 py-1.5 border-b border-r text-right tabular-nums whitespace-nowrap">
                        <span className={v < 0 ? 'text-red-600' : ''}>{fmt(v)}</span>
                        {line.kind !== 'revenue' && <span className="ml-1.5 text-[10px] text-gray-400">{pct(v, base)}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AddStoreForm({ onClose, onSaved, nextSort }: { onClose: () => void; onSaved: () => void; nextSort: number }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [nameVi, setNameVi] = useState('')
  const [kind, setKind] = useState('store')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!code.trim() || !name.trim()) { setErr('代碼與名稱為必填'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/hr/pnl/stores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, name_vi: nameVi, kind, sort: nextSort }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error ?? '儲存失敗'); return }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">新增門市</span>
        <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">代碼 *</label>
          <Input value={code} onChange={e => setCode(e.target.value)} placeholder="BACH_MAI" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">顯示名 *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="白梅店" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">越文名</label>
          <Input value={nameVi} onChange={e => setNameVi(e.target.value)} placeholder="BACH MAI" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">類型</label>
          <select value={kind} onChange={e => setKind(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm">
            {Object.entries(STORE_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5 h-8">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}儲存
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} className="h-8">取消</Button>
      </div>
    </div>
  )
}
