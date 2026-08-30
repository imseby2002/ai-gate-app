'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Loader2, AlertCircle, Upload, Store, ShoppingCart, Boxes, Tag, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'sales' | 'balance' | 'prices' | 'recipes'
const fmt = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('zh-TW')
const now = new Date()

export default function AuditPage() {
  const [ok, setOk] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('sales')
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    fetch('/api/inv/stores').then(r => { if (r.status === 403) { setOk(false); return null } setOk(true); return r.json() })
      .then(d => { if (d) { setStores(d.stores ?? []); setStore(s => s || (d.stores?.[0] ?? '')) } })
  }, [])

  if (ok === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅稽核單位可使用</p></div>
    </div>
  )

  const TABS: [Tab, string, ReactNode][] = [
    ['sales', 'IPOS 銷售', <ShoppingCart key="a" className="h-4 w-4" />],
    ['balance', 'IVT 進銷存', <Boxes key="b" className="h-4 w-4" />],
    ['prices', '進貨價', <Tag key="c" className="h-4 w-4" />],
    ['recipes', '配方', <FlaskConical key="d" className="h-4 w-4" />],
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><ClipboardCheck className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">稽核・原物料合理性</h1>
          <p className="text-sm text-gray-500">整併四來源：IPOS 銷售量、IVT 進銷存、中央廚房進貨價、研發配方（分析引擎為下一階段）</p>
        </div>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <label className="space-y-1"><span className="block text-xs text-gray-500">門市</span>
          <Input list="audit-stores" value={store} onChange={e => setStore(e.target.value)} className="w-36 h-9" placeholder="門市（如 YL）" />
          <datalist id="audit-stores">{stores.map(s => <option key={s} value={s} />)}</datalist>
        </label>
        <label className="space-y-1"><span className="block text-xs text-gray-500">年</span><Input type="number" value={String(year)} onChange={e => setYear(Number(e.target.value) || year)} className="w-24 h-9" /></label>
        <label className="space-y-1"><span className="block text-xs text-gray-500">月</span><Input type="number" value={String(month)} onChange={e => setMonth(Number(e.target.value) || month)} className="w-20 h-9" /></label>
        <span className="text-[11px] text-gray-400 ml-auto">粒度：門市 × 年月（分析可自訂區間為下一步）</span>
      </Card>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === id ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'sales' ? <SalesTab store={store} year={year} month={month} />
        : tab === 'balance' ? <BalanceTab store={store} year={year} month={month} />
        : tab === 'prices' ? <PricesTab />
        : <RecipesTab />}
    </div>
  )
}

function useUpload(url: string, extra: () => Record<string, string>, onDone: () => void) {
  const ref = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true); setMsg('匯入中…')
    const fd = new FormData(); fd.append('file', file)
    for (const [k, v] of Object.entries(extra())) fd.append(k, v)
    const res = await fetch(url, { method: 'POST', body: fd })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `匯入 ${d.imported ?? d.total ?? ''} 筆` : (d.error ?? '匯入失敗'))
    if (res.ok) onDone()
  }
  return { ref, msg, busy, upload }
}

function SalesTab({ store, year, month }: { store: string; year: number; month: number }) {
  const [rows, setRows] = useState<{ product_code: string; product_name: string; qty: number; revenue: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => {
    if (!store) return
    setLoading(true)
    fetch(`/api/audit/data?kind=sales&store=${encodeURIComponent(store)}&year=${year}&month=${month}`).then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [store, year, month])
  useEffect(() => { load() }, [load, tick])
  const up = useUpload('/api/inv/import/pos', () => ({ store, year: String(year), month: String(month) }), () => setTick(t => t + 1))

  return (
    <div className="space-y-3">
      <input ref={up.ref} type="file" hidden accept=".xls,.xlsx" onChange={up.upload} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500">IPOS 產品銷售量（範例：yl t7賣的數量）。上傳當月匯出檔。</p>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => up.ref.current?.click()} disabled={up.busy}>{up.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}上傳 IPOS 銷售</Button>
        {up.msg && <span className="text-sm text-blue-600 basis-full">{up.msg}</span>}
      </div>
      <Table loading={loading} empty={rows.length === 0} head={['產品碼', '品名', '數量', '金額']}
        rows={rows.map(r => [r.product_code, r.product_name, fmt(r.qty), fmt(r.revenue)])} numCols={[2, 3]} />
    </div>
  )
}

function BalanceTab({ store, year, month }: { store: string; year: number; month: number }) {
  const [rows, setRows] = useState<{ material_code: string; material_name: string; unit: string; open_qty: number; in_total: number; out_total: number; close_qty: number; usage_month: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => {
    if (!store) return
    setLoading(true)
    fetch(`/api/audit/data?kind=balance&store=${encodeURIComponent(store)}&year=${year}&month=${month}`).then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [store, year, month])
  useEffect(() => { load() }, [load, tick])
  const up = useUpload('/api/inv/import/inventory', () => ({ store, year: String(year), month: String(month) }), () => setTick(t => t + 1))

  return (
    <div className="space-y-3">
      <input ref={up.ref} type="file" hidden accept=".xlsx" onChange={up.upload} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500">IVT 進銷存報表（範例：yl ttt t7；多門市多工作表）。期初／進／出／期末。</p>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => up.ref.current?.click()} disabled={up.busy}>{up.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}上傳 IVT 進銷存</Button>
        {up.msg && <span className="text-sm text-blue-600 basis-full">{up.msg}</span>}
      </div>
      <Table loading={loading} empty={rows.length === 0} head={['原料碼', '品名', '單位', '期初', '進', '出', '期末', '本月用量']}
        rows={rows.map(r => [r.material_code, r.material_name, r.unit, fmt(r.open_qty), fmt(r.in_total), fmt(r.out_total), fmt(r.close_qty), fmt(r.usage_month)])} numCols={[3, 4, 5, 6, 7]} />
    </div>
  )
}

function PricesTab() {
  const [rows, setRows] = useState<{ material_code: string; material_name: string; unit: string; export_price: number; purchase_price: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/audit/data?kind=prices').then(r => r.ok ? r.json() : { rows: [] }).then(d => { setRows(d.rows ?? []); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load, tick])
  const up = useUpload('/api/inv/import/prices', () => ({}), () => setTick(t => t + 1))

  return (
    <div className="space-y-3">
      <input ref={up.ref} type="file" hidden accept=".xlsx" onChange={up.upload} />
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-gray-500">中央廚房標準出貨價（範例：GIÁ XUẤT CHUẨN…）。出貨價／進貨價。</p>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => up.ref.current?.click()} disabled={up.busy}>{up.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}上傳標準價</Button>
        {up.msg && <span className="text-sm text-blue-600 basis-full">{up.msg}</span>}
      </div>
      <Table loading={loading} empty={rows.length === 0} head={['原料碼', '品名', '單位', '出貨價', '進貨價']}
        rows={rows.map(r => [r.material_code, r.material_name, r.unit, fmt(r.export_price), fmt(r.purchase_price)])} numCols={[3, 4]} />
    </div>
  )
}

function RecipesTab() {
  const [rows, setRows] = useState<{ id: string; name: string; note: string }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/inv/recipes').then(r => r.ok ? r.json() : null).then(d => { setRows(d?.recipes ?? d?.materials ?? []); setLoading(false) })
  }, [])
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-500">配方來自研發單位（唯讀）。維護請至研發。</p>
        <Link href="/rd-recipes" className="ml-auto"><Button size="sm" variant="outline" className="gap-1.5"><FlaskConical className="h-4 w-4" />研發配方</Button></Link>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">尚無配方資料。</div>
        : <Card className="p-4"><div className="text-sm text-gray-600">目前 {rows.length} 筆配方（於研發單位維護）。</div></Card>}
    </div>
  )
}

function Table({ loading, empty, head, rows, numCols }: { loading: boolean; empty: boolean; head: string[]; rows: (string | number)[][]; numCols: number[] }) {
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  if (empty) return <div className="text-center py-8 text-gray-400 text-sm">此條件下尚無資料，請先於上方上傳匯出檔。</div>
  const numSet = new Set(numCols)
  return (
    <Card className="p-4">
      <div className="overflow-x-auto max-h-[28rem]">
        <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white">{head.map((h, i) => <th key={i} className={`py-2 pr-2 ${numSet.has(i) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => (
            <tr key={ri} className="border-b last:border-0">{r.map((c, ci) => <td key={ci} className={`py-1 pr-2 ${numSet.has(ci) ? 'text-right tabular-nums' : ''}`}>{c}</td>)}</tr>
          ))}</tbody></table>
      </div>
    </Card>
  )
}
