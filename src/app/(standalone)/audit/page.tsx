'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Loader2, AlertCircle, Upload, Store, ShoppingCart, Boxes, Tag, FlaskConical, Gauge, Bell, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'analysis' | 'sales' | 'balance' | 'prices' | 'recipes'
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
    ['analysis', '合理性分析', <Gauge key="z" className="h-4 w-4" />],
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

      {tab === 'analysis' ? <AnalysisTab store={store} year={year} month={month} />
        : tab === 'sales' ? <SalesTab store={store} year={year} month={month} />
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

interface VarRow { material_code: string; material_name: string; unit: string; expected: number; actual: number; recipe_theo: number; remaining: number; diff: number; pct: number | null; over: boolean; price: number; money_loss: number }
interface Analysis {
  threshold: number; over_count: number; total_loss: number; rows: VarRow[]
  unmapped: { product_code: string; product_name: string; qty: number }[]
  cross_checks: { configured: boolean; cups_sold: number; cup_used: number | null; cup_diff: number | null; tea_used: number | null; creamer_used: number | null; ratio_actual: number | null; ratio_recipe: number | null; implied_cups_tea: number | null; implied_cups_creamer: number | null }
  possibility: { configured: boolean; has_displacement: boolean; extra_topping_servings: number; tea_explained: number; creamer_explained: number; tea_explained_pct: number | null; creamer_explained_pct: number | null; tea: { gap: number } | null; creamer: { gap: number } | null; toppings: { material_name: string; extra_servings: number }[] }
}
const pctStr = (p: number | null) => p === null ? '—' : `${p > 0 ? '+' : ''}${Math.round(p)}%`

function AnalysisTab({ store, year, month }: { store: string; year: number; month: number }) {
  const [data, setData] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showCfg, setShowCfg] = useState(false)
  const load = useCallback(() => {
    if (!store) return
    setLoading(true); setMsg('')
    fetch(`/api/inv/variance?store=${encodeURIComponent(store)}&year=${year}&month=${month}`).then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
  }, [store, year, month])
  useEffect(() => { load() }, [load])

  const notify = async () => {
    setMsg('通知中…')
    const res = await fetch('/api/inv/variance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, year, month }) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? (d.notified ? `已通知人事（${d.over_count} 項超標）` : '目前無超標項目') : (d.error ?? '通知失敗'))
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  if (!data) return <div className="text-center py-8 text-gray-400 text-sm">請先於上方選門市/年月，並確認已上傳當月四來源。</div>
  const cc = data.cross_checks, po = data.possibility

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">超標門檻 <b>{data.threshold}%</b>・超標 <b className="text-red-600">{data.over_count}</b> 項・估計金額損失 <b className="text-red-600">{fmt(data.total_loss)}</b></span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCfg(v => !v)}><Settings className="h-4 w-4" />設定</Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-amber-700 border-amber-200" onClick={notify}><Bell className="h-4 w-4" />通知人事</Button>
        </div>
        {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
      </div>

      {showCfg && <SettingsPanel onSaved={load} />}

      {cc.configured && (
        <Card className="p-3 text-sm grid sm:grid-cols-3 gap-2">
          <div>售出杯數：<b>{fmt(cc.cups_sold)}</b>{cc.cup_used !== null && <>・杯子實耗 <b>{fmt(cc.cup_used)}</b>{cc.cup_diff !== null && <span className={Math.abs(cc.cup_diff) > 0 ? 'text-amber-600' : ''}>（差 {fmt(cc.cup_diff)}）</span>}</>}</div>
          <div>茶／奶精實耗：{cc.tea_used === null ? '—' : fmt(cc.tea_used)} / {cc.creamer_used === null ? '—' : fmt(cc.creamer_used)}{cc.ratio_actual !== null && <>・比 {cc.ratio_actual.toFixed(2)}{cc.ratio_recipe !== null && <span className="text-gray-400">（配方 {cc.ratio_recipe.toFixed(2)}）</span>}</>}</div>
          <div>由茶/奶精反推杯數：{cc.implied_cups_tea === null ? '—' : fmt(cc.implied_cups_tea)} / {cc.implied_cups_creamer === null ? '—' : fmt(cc.implied_cups_creamer)}</div>
        </Card>
      )}

      {po.configured && po.has_displacement && (
        <Card className="p-3 text-sm bg-sky-50 border-sky-200 space-y-1">
          <div className="font-medium text-sky-800">加料排擠分析（茶/奶精「少用」可能是多加料所致，非短少）</div>
          <div>茶少用 {fmt(po.tea?.gap ?? 0)}，加料可解釋 <b>{fmt(po.tea_explained)}</b>{po.tea_explained_pct !== null && `（${Math.round(po.tea_explained_pct)}%）`}；奶精少用 {fmt(po.creamer?.gap ?? 0)}，可解釋 <b>{fmt(po.creamer_explained)}</b>{po.creamer_explained_pct !== null && `（${Math.round(po.creamer_explained_pct)}%）`}。</div>
          <div className="text-xs text-sky-700">推估額外加料份數合計 {fmt(po.extra_topping_servings)}{po.toppings.length > 0 && `（主要：${po.toppings.slice(0, 4).map(t => `${t.material_name} ${fmt(t.extra_servings)}`).join('、')}）`}</div>
        </Card>
      )}

      <Card className="p-4">
        <div className="overflow-x-auto max-h-[26rem]">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white">
            <th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">規定用量</th><th className="pr-2 text-right">實耗</th><th className="pr-2 text-right">差額</th><th className="pr-2 text-right">誤差%</th><th className="pr-2 text-right">金額損失</th></tr></thead>
            <tbody>{data.rows.map(r => (
              <tr key={r.material_code} className={`border-b last:border-0 ${r.over ? 'bg-red-50' : ''}`}>
                <td className="py-1 pr-2">{r.material_name}{r.over && <span className="ml-1 text-[11px] text-red-600">超標</span>}</td>
                <td className="pr-2 text-gray-400">{r.unit}</td>
                <td className="pr-2 text-right tabular-nums text-gray-500">{fmt(r.expected)}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(r.actual)}</td>
                <td className={`pr-2 text-right tabular-nums ${r.diff > 0 ? 'text-red-600' : r.diff < 0 ? 'text-emerald-600' : ''}`}>{fmt(r.diff)}</td>
                <td className={`pr-2 text-right tabular-nums ${r.over ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{pctStr(r.pct)}</td>
                <td className={`pr-2 text-right tabular-nums ${r.money_loss > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(r.money_loss)}</td>
              </tr>))}</tbody></table>
        </div>
        {data.unmapped.length > 0 && <p className="text-[11px] text-amber-600 mt-2">未對應配方的產品 {data.unmapped.length} 項（如 {data.unmapped.slice(0, 3).map(u => u.product_name || u.product_code).join('、')}…），請至研發/產品對應補齊。</p>}
        <p className="text-[11px] text-gray-400 mt-1">規定用量＝POS 點單推算(Xuất bán POS)；實耗＝當月使用量。AI 對談與硬性規則為下一階段。</p>
      </Card>
    </div>
  )
}

function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [cfg, setCfg] = useState({ variance_threshold: 10, cup_code: '', tea_code: '', creamer_code: '', tea_per_cup: 0, creamer_per_cup: 0 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/inv/settings').then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg(c => ({ ...c, ...d })) }) }, [])
  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/inv/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false); setMsg(res.ok ? '已儲存' : '儲存失敗'); if (res.ok) onSaved()
  }
  const F = (k: keyof typeof cfg, label: string, num = false) => (
    <label className="space-y-1"><span className="block text-[11px] text-gray-500">{label}</span>
      <Input value={String(cfg[k])} type={num ? 'number' : 'text'} onChange={e => setCfg({ ...cfg, [k]: num ? (Number(e.target.value) || 0) : e.target.value })} className="h-8" /></label>
  )
  return (
    <Card className="p-4 space-y-2">
      <div className="text-sm font-medium">分析設定（超標門檻與交叉檢核用原料）</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {F('variance_threshold', '超標門檻 %', true)}
        {F('cup_code', '杯子原料碼')}
        {F('tea_code', '茶原料碼')}
        {F('creamer_code', '奶精原料碼')}
        {F('tea_per_cup', '每杯茶量', true)}
        {F('creamer_per_cup', '每杯奶精量', true)}
      </div>
      <div className="flex items-center gap-2"><Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存設定'}</Button>{msg && <span className="text-sm text-gray-500">{msg}</span>}</div>
    </Card>
  )
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
