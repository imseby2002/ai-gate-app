'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { Store, Upload, Loader2, AlertCircle, TrendingUp, Package, Building2, DollarSign, BookOpen, Link2, Scale, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('zh-TW')
type Tab = 'report' | 'recipes' | 'mapping' | 'variance'

// ── 型別 ──
interface PosRow { product_code: string; product_name: string; qty: number; revenue: number }
interface MovRow { material_code: string; material_name: string; unit: string; open_qty: number; in_total: number; in_value: number; out_total: number; out_value: number; close_qty: number }
interface Report {
  pos: { rows: PosRow[]; total_revenue: number; total_qty: number; product_count: number }
  inventory: { rows: MovRow[]; purchase_value: number; out_value: number; close_value: number; material_count: number }
}
interface Material { code: string; name: string; unit: string }
interface RecipeItem { material_code: string; material_name: string; qty_per_cup: number }
interface Recipe { id: string; name: string; note: string; items: RecipeItem[] }
interface ProductMap { product_code: string; product_name: string; recipe_id: string | null }
interface VarRow { material_code: string; material_name: string; unit: string; theoretical: number; actual: number; remaining: number; diff: number; pct: number | null; over: boolean }

export default function StoreReportsPage() {
  const now = new Date()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('report')
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const loadStores = useCallback(async () => {
    const res = await fetch('/api/inv/stores')
    if (res.status === 403) { setIsAdmin(false); return }
    setIsAdmin(true)
    const d = await res.json()
    setStores(d.stores ?? [])
    setStore(s => s || (d.stores?.[0] ?? ''))
  }, [])
  useEffect(() => { loadStores() }, [loadStores])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅管理者可使用門市報表</p></div>
    </div>
  )

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'report', label: '報表', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'recipes', label: '配方', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'mapping', label: '成品對照', icon: <Link2 className="h-4 w-4" /> },
    { id: 'variance', label: '差異分析', icon: <Scale className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Store className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">門市報表</h1>
          <p className="text-sm text-gray-500">業績、進銷存、配方與差異分析</p>
        </div>
        <div className="ml-auto"><Link href="/hr"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />人事管理</Button></Link></div>
      </div>

      {/* 門市 / 年月（報表與差異用） */}
      {(tab === 'report' || tab === 'variance') && (
        <Card className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-xs text-gray-500">門市</span>
              <Input list="store-list" value={store} onChange={e => setStore(e.target.value)} placeholder="門市（如 YL）" className="w-36" />
              <datalist id="store-list">{stores.map(s => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="space-y-1"><span className="block text-xs text-gray-500">年</span>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}</select></label>
            <label className="space-y-1"><span className="block text-xs text-gray-500">月</span>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}</select></label>
          </div>
        </Card>
      )}

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.id ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'report' && <ReportTab store={store} year={year} month={month} onImported={loadStores} />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'mapping' && <MappingTab />}
      {tab === 'variance' && <VarianceTab store={store} year={year} month={month} />}
    </div>
  )
}

// ── 報表 ──
function ReportTab({ store, year, month, onImported }: { store: string; year: number; month: number; onImported: () => void }) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState('')
  const posRef = useRef<HTMLInputElement>(null)
  const invRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!store) { setReport(null); return }
    setLoading(true)
    const res = await fetch(`/api/inv/report?store=${encodeURIComponent(store)}&year=${year}&month=${month}`)
    setReport(res.ok ? await res.json() : null)
    setLoading(false)
  }, [store, year, month])
  useEffect(() => { load() }, [load])

  const uploadPos = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!store.trim()) { setMsg('請先輸入門市'); return }
    setUploading('pos'); setMsg('')
    const fd = new FormData(); fd.append('file', file); fd.append('store', store.trim()); fd.append('year', String(year)); fd.append('month', String(month))
    const res = await fetch('/api/inv/import/pos', { method: 'POST', body: fd })
    setUploading('')
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setMsg(`POS 匯入 ${d.imported} 筆`); onImported(); load() } else setMsg(d.error ?? '匯入失敗')
  }
  const uploadInv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading('inv'); setMsg('')
    const fd = new FormData(); fd.append('file', file); fd.append('year', String(year)); fd.append('month', String(month))
    const res = await fetch('/api/inv/import/inventory', { method: 'POST', body: fd })
    setUploading('')
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setMsg(`進銷存匯入：${(d.stores ?? []).map((s: { store: string; count: number }) => `${s.store}(${s.count})`).join('、')}`); onImported(); load() } else setMsg(d.error ?? '匯入失敗')
  }

  return (
    <div className="space-y-4">
      <input ref={posRef} type="file" hidden accept=".xls" onChange={uploadPos} />
      <input ref={invRef} type="file" hidden accept=".xlsx" onChange={uploadInv} />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => posRef.current?.click()}>{uploading === 'pos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入 POS(.xls)</Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => invRef.current?.click()}>{uploading === 'inv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入進銷存(.xlsx)</Button>
        {msg && <span className="text-sm text-blue-600 self-center">{msg}</span>}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : !report || (report.pos.rows.length === 0 && report.inventory.rows.length === 0) ? <div className="text-center py-10 text-gray-400 text-sm">此門市／月份尚無資料，請先匯入。</div>
        : (<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="營收" value={fmt(report.pos.total_revenue)} tone="green" />
            <Stat icon={<Package className="h-4 w-4" />} label="總杯數" value={fmt(report.pos.total_qty)} />
            <Stat icon={<DollarSign className="h-4 w-4" />} label="進貨支出" value={fmt(report.inventory.purchase_value)} tone="red" />
            <Stat icon={<Package className="h-4 w-4" />} label="期末庫存值" value={fmt(report.inventory.close_value)} />
          </div>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">業績明細（{report.pos.product_count} 項）</h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">產品</th><th className="pr-2 text-right">杯數</th><th className="pr-2 text-right">營收</th></tr></thead>
                <tbody>{report.pos.rows.map((r, i) => <tr key={i} className="border-b last:border-0"><td className="py-1.5 pr-2">{r.product_name || r.product_code}</td><td className="pr-2 text-right tabular-nums">{fmt(r.qty)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.revenue)}</td></tr>)}</tbody></table>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">進銷存明細（{report.inventory.material_count} 項）</h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">期初</th><th className="pr-2 text-right">入庫</th><th className="pr-2 text-right">出庫</th><th className="pr-2 text-right">剩餘</th><th className="pr-2 text-right">進貨額</th></tr></thead>
                <tbody>{report.inventory.rows.map((r, i) => <tr key={i} className="border-b last:border-0"><td className="py-1.5 pr-2">{r.material_name || r.material_code}</td><td className="pr-2 text-gray-400">{r.unit}</td><td className="pr-2 text-right tabular-nums">{fmt(r.open_qty)}</td><td className="pr-2 text-right tabular-nums text-blue-600">{fmt(r.in_total)}</td><td className="pr-2 text-right tabular-nums text-red-500">{fmt(r.out_total)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.close_qty)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.in_value)}</td></tr>)}</tbody></table>
            </div>
          </Card>
        </>)}
    </div>
  )
}

// ── 配方 ──
function RecipesTab() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ id?: string; name: string; note: string; items: RecipeItem[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/inv/recipes')
    if (res.ok) { const d = await res.json(); setRecipes(d.recipes ?? []); setMaterials(d.materials ?? []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing?.name.trim()) return
    setBusy(true)
    const res = await fetch('/api/inv/recipes', { method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setBusy(false)
    if (res.ok) { setEditing(null); load() } else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }
  const remove = async (r: Recipe) => {
    if (!confirm(`刪除配方「${r.name}」？`)) return
    await fetch('/api/inv/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); load()
  }
  const addItem = () => setEditing(e => e ? { ...e, items: [...e.items, { material_code: '', material_name: '', qty_per_cup: 0 }] } : e)
  const setItem = (i: number, patch: Partial<RecipeItem>) => setEditing(e => { if (!e) return e; const items = [...e.items]; items[i] = { ...items[i], ...patch }; return { ...e, items } })
  const pickMaterial = (i: number, code: string) => { const m = materials.find(x => x.code === code); setItem(i, { material_code: code, material_name: m?.name ?? '' }) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">每個成品用多少原料/杯。原料來自已匯入的進銷存。</p>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing({ name: '', note: '', items: [] })}><Plus className="h-4 w-4" />新增配方</Button>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : recipes.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無配方</div>
        : <div className="grid gap-2">{recipes.map(r => (
          <Card key={r.id} className="p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{r.items.length} 種原料：{r.items.map(i => `${i.material_name || i.material_code}×${fmt1(i.qty_per_cup)}`).join('、') || '（未設定）'}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setEditing({ id: r.id, name: r.name, note: r.note, items: r.items.map(i => ({ ...i })) })} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">編輯</button>
              <button onClick={() => remove(r)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          </Card>))}</div>}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{editing.id ? '編輯配方' : '新增配方'}</h3><button onClick={() => setEditing(null)}><X className="h-5 w-5 text-gray-400" /></button></div>
            <label className="block space-y-1"><span className="text-xs text-gray-500">配方名稱</span><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">原料（每杯用量）</span><button onClick={addItem} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">＋原料</button></div>
              {editing.items.length === 0 && <p className="text-xs text-gray-400">尚無原料</p>}
              {editing.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={it.material_code} onChange={e => pickMaterial(i, e.target.value)} className="flex-1 h-9 rounded-md border px-2 text-sm">
                    <option value="">選原料…</option>
                    {materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}{m.unit ? `（${m.unit}）` : ''}</option>)}
                  </select>
                  <Input type="number" value={String(it.qty_per_cup)} onChange={e => setItem(i, { qty_per_cup: Number(e.target.value) || 0 })} placeholder="用量/杯" className="w-24" />
                  <button onClick={() => setEditing(e => e ? { ...e, items: e.items.filter((_, x) => x !== i) } : e)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button><Button size="sm" onClick={save} disabled={busy || !editing.name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 成品對照 ──
function MappingTab() {
  const [products, setProducts] = useState<ProductMap[]>([])
  const [recipes, setRecipes] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/inv/product-map')
    if (res.ok) { const d = await res.json(); setProducts(d.products ?? []); setRecipes(d.recipes ?? []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const setMap = async (p: ProductMap, recipe_id: string) => {
    setProducts(prev => prev.map(x => x.product_code === p.product_code ? { ...x, recipe_id: recipe_id || null } : x))
    await fetch('/api/inv/product-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_code: p.product_code, product_name: p.product_name, recipe_id: recipe_id || null }) })
  }

  const mapped = products.filter(p => p.recipe_id).length
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">把每個 POS 成品綁到一個配方。已綁 {mapped}/{products.length}。</p>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : products.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無 POS 成品，請先於「報表」匯入 POS。</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">成品碼</th><th className="pr-2">名稱</th><th className="pr-2">對照配方</th></tr></thead>
          <tbody>{products.map(p => (
            <tr key={p.product_code} className="border-b last:border-0">
              <td className="py-1.5 pr-2 tabular-nums text-gray-500">{p.product_code}</td>
              <td className="pr-2">{p.product_name}</td>
              <td className="pr-2">
                <select value={p.recipe_id ?? ''} onChange={e => setMap(p, e.target.value)} className={`h-8 rounded-md border px-1.5 text-xs ${p.recipe_id ? '' : 'text-amber-600 border-amber-300'}`}>
                  <option value="">（未對照）</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </td>
            </tr>))}</tbody></table></div>}
    </div>
  )
}

// ── 差異分析 ──
function VarianceTab({ store, year, month }: { store: string; year: number; month: number }) {
  const [rows, setRows] = useState<VarRow[]>([])
  const [unmapped, setUnmapped] = useState<{ product_code: string; product_name: string; qty: number }[]>([])
  const [threshold, setThreshold] = useState(10)
  const [overCount, setOverCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!store) { setRows([]); return }
    setLoading(true)
    const res = await fetch(`/api/inv/variance?store=${encodeURIComponent(store)}&year=${year}&month=${month}`)
    if (res.ok) { const d = await res.json(); setRows(d.rows ?? []); setUnmapped(d.unmapped ?? []); setThreshold(d.threshold ?? 10); setOverCount(d.over_count ?? 0) }
    setLoading(false)
  }, [store, year, month])
  useEffect(() => { load() }, [load])

  const saveThreshold = async (v: number) => {
    setThreshold(v)
    await fetch('/api/inv/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variance_threshold: v }) })
    load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm"><span className="text-gray-500">誤差警示門檻</span>
          <Input type="number" value={String(threshold)} onChange={e => setThreshold(Number(e.target.value) || 0)} onBlur={e => saveThreshold(Number(e.target.value) || 0)} className="w-20" /><span className="text-gray-500">%</span></label>
        {overCount > 0 && <span className="text-sm text-red-600 font-medium">⚠️ {overCount} 項超過門檻</span>}
      </div>
      {unmapped.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          有 {unmapped.length} 個成品尚未對照配方（不計入理論用量）：{unmapped.slice(0, 8).map(u => u.product_name || u.product_code).join('、')}{unmapped.length > 8 ? '…' : ''}
        </div>
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">無資料。請先匯入 POS＋進銷存、建立配方並完成對照。</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">理論用量</th><th className="pr-2 text-right">實際出庫</th><th className="pr-2 text-right">差額</th><th className="pr-2 text-right">誤差%</th><th className="pr-2 text-right">剩餘</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.material_code} className={`border-b last:border-0 ${r.over ? 'bg-red-50' : ''}`}>
              <td className="py-1.5 pr-2">{r.material_name}</td>
              <td className="pr-2 text-gray-400">{r.unit}</td>
              <td className="pr-2 text-right tabular-nums">{fmt1(r.theoretical)}</td>
              <td className="pr-2 text-right tabular-nums">{fmt1(r.actual)}</td>
              <td className={`pr-2 text-right tabular-nums ${r.diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt1(r.diff)}</td>
              <td className={`pr-2 text-right tabular-nums font-medium ${r.over ? 'text-red-600' : ''}`}>{r.pct === null ? '—' : `${fmt1(r.pct)}%`}</td>
              <td className="pr-2 text-right tabular-nums text-gray-500">{fmt1(r.remaining)}</td>
            </tr>))}</tbody></table></div>}
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : 'text-gray-800'
  return (
    <Card className="p-3"><div className="flex items-center gap-1.5 text-xs text-gray-500">{icon}{label}</div><div className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{value}</div></Card>
  )
}
