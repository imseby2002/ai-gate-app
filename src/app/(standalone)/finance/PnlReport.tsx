'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PNL_LINES, PNL_LINE_MAP, RENT_DETAIL_CODES, STORE_KIND_LABEL,
} from './pnl-schema'

interface Store { id: string; code: string; name: string; name_vi: string; kind: string; sort: number }
interface Entry { store_id: string; line_code: string; amount: number }

const fmt = (n: number) => n === 0 ? '–' : Math.round(n).toLocaleString('zh-TW')
const pct = (v: number, base: number) => base ? (v / base * 100).toFixed(2) + '%' : '–'
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

// 依存值＋科目樹公式，解出單一門市每個科目的最終值（存值優先，缺值才套公式）
function resolveStore(vals: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  const visiting = new Set<string>()
  const get = (code: string): number => {
    if (code in out) return out[code]
    if (code in vals) { out[code] = vals[code]; return out[code] }
    const line = PNL_LINE_MAP[code]
    if (!line?.compute) { out[code] = 0; return 0 }
    if (visiting.has(code)) return 0
    visiting.add(code)
    const c = line.compute
    let r = 0
    if (c.op === 'sum') r = c.codes.reduce((s, x) => s + get(x), 0)
    else if (c.op === 'sumSection') r = PNL_LINES.filter(l => l.section === c.section && l.kind === 'detail').reduce((s, l) => s + get(l.code), 0)
    else if (c.op === 'sub') {
      const right = c.right === '@rent_details'
        ? RENT_DETAIL_CODES.reduce((s, x) => s + get(x), 0)
        : get(c.right)
      r = get(c.left) - right
    }
    visiting.delete(code)
    out[code] = r
    return r
  }
  for (const l of PNL_LINES) get(l.code)
  return out
}

export default function PnlReport() {
  const [stores, setStores] = useState<Store[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState(thisMonth())
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hr/pnl?period=${period}`)
      const j = await res.json()
      setStores(j.stores ?? [])
      setEntries(j.entries ?? [])
      setPeriods(j.periods ?? [])
    } finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  // 解析每門市的科目值
  const resolved = useMemo(() => {
    const byStore: Record<string, Record<string, number>> = {}
    for (const s of stores) byStore[s.id] = {}
    for (const e of entries) {
      if (!byStore[e.store_id]) byStore[e.store_id] = {}
      byStore[e.store_id][e.line_code] = Number(e.amount) || 0
    }
    const out: Record<string, Record<string, number>> = {}
    for (const s of stores) out[s.id] = resolveStore(byStore[s.id] ?? {})
    return out
  }, [stores, entries])

  // 第一階段不顯示跨期比較行
  const lines = useMemo(() => PNL_LINES.filter(l => l.section !== 'compare'), [])

  const rowStyle = (kind: string) =>
    kind === 'revenue' ? 'bg-primary/10 font-bold'
      : kind === 'subtotal' ? 'bg-gray-100 font-semibold'
        : ''

  return (
    <div className="space-y-4">
      {/* 工具列 */}
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
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5 h-8 ml-auto">
          <Plus className="h-4 w-4" />新增門市
        </Button>
      </div>

      {adding && <AddStoreForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} nextSort={stores.length} />}

      {stores.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          尚無門市。先「新增門市」，再以「資料匯入」帶入各月損益數字。
        </div>
      ) : (
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
                    {line.zh}
                    <span className="ml-1.5 text-[10px] text-gray-400">{line.vi}</span>
                  </td>
                  {stores.map(s => {
                    const v = resolved[s.id]?.[line.code] ?? 0
                    const base = resolved[s.id]?.revenue ?? 0
                    return (
                      <td key={s.id} className="px-3 py-1.5 border-b border-r text-right tabular-nums whitespace-nowrap">
                        <span className={v < 0 ? 'text-red-600' : ''}>{fmt(v)}</span>
                        {line.kind !== 'revenue' && (
                          <span className="ml-1.5 text-[10px] text-gray-400">{pct(v, base)}</span>
                        )}
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
