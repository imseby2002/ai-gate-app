'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { Store, Upload, Loader2, AlertCircle, TrendingUp, Package, Building2, DollarSign, BookOpen, Link2, Scale, Plus, Trash2, X, FlaskConical } from 'lucide-react'
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
interface ProductMap { product_code: string; product_name: string; recipe_id: string | null; kind: string }
interface VarRow { material_code: string; material_name: string; unit: string; theoretical: number; actual: number; remaining: number; diff: number; pct: number | null; over: boolean; price: number; money_loss: number }
interface CrossChecks {
  cups_sold: number; cup_used: number | null; cup_diff: number | null
  tea_used: number | null; creamer_used: number | null
  ratio_actual: number | null; ratio_recipe: number | null
  implied_cups_tea: number | null; implied_cups_creamer: number | null; configured: boolean
}
interface InvSettings { variance_threshold: number; cup_code: string; tea_code: string; creamer_code: string; tea_per_cup: number; creamer_per_cup: number }

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
        <div className="ml-auto flex items-center gap-2"><Link href="/rd"><Button variant="outline" size="sm" className="gap-1.5"><FlaskConical className="h-4 w-4 text-purple-600" />研發</Button></Link><Link href="/hr"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />人事管理</Button></Link></div>
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
  const priceRef = useRef<HTMLInputElement>(null)

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
  const uploadPrice = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading('price'); setMsg('')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/inv/import/prices', { method: 'POST', body: fd })
    setUploading('')
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `標準價匯入 ${d.imported} 筆` : (d.error ?? '匯入失敗'))
  }

  return (
    <div className="space-y-4">
      <input ref={posRef} type="file" hidden accept=".xls" onChange={uploadPos} />
      <input ref={invRef} type="file" hidden accept=".xlsx" onChange={uploadInv} />
      <input ref={priceRef} type="file" hidden accept=".xlsx" onChange={uploadPrice} />
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => posRef.current?.click()}>{uploading === 'pos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入 POS(.xls)</Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => invRef.current?.click()}>{uploading === 'inv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入進銷存(.xlsx)</Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => priceRef.current?.click()}>{uploading === 'price' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}匯入標準價(.xlsx)</Button>
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">每個成品用多少原料/杯。可至「研發」進行檔案匯入與完整設計。</p>
        <div className="flex items-center gap-2">
          <Link href="/rd">
            <Button size="sm" variant="outline" className="gap-1.5"><FlaskConical className="h-4 w-4 text-purple-600" />研發配方中心</Button>
          </Link>
          <Button size="sm" className="gap-1.5" onClick={() => setEditing({ name: '', note: '', items: [] })}><Plus className="h-4 w-4" />新增配方</Button>
        </div>
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

  const save = async (p: ProductMap, patch: Partial<ProductMap>) => {
    const next = { ...p, ...patch }
    setProducts(prev => prev.map(x => x.product_code === p.product_code ? next : x))
    await fetch('/api/inv/product-map', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_code: p.product_code, product_name: p.product_name, recipe_id: next.recipe_id || null, kind: next.kind }),
    })
  }

  const mapped = products.filter(p => p.recipe_id).length
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">把每個 POS 成品綁到一個配方，並標「飲料/加料」。已綁 {mapped}/{products.length}。加料(TOPPING)的配方可用<b>負值</b>填「排擠的基底」（如 −茶、−奶精）。</p>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : products.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無 POS 成品，請先於「報表」匯入 POS。</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">成品碼</th><th className="pr-2">名稱</th><th className="pr-2">類別</th><th className="pr-2">對照配方</th></tr></thead>
          <tbody>{products.map(p => (
            <tr key={p.product_code} className="border-b last:border-0">
              <td className="py-1.5 pr-2 tabular-nums text-gray-500">{p.product_code}</td>
              <td className="pr-2">{p.product_name}</td>
              <td className="pr-2">
                <select value={p.kind || ''} onChange={e => save(p, { kind: e.target.value })} className="h-8 rounded-md border px-1.5 text-xs">
                  <option value="">未分類</option>
                  <option value="drink">飲料</option>
                  <option value="topping">加料</option>
                  <option value="other">其他</option>
                </select>
              </td>
              <td className="pr-2">
                <select value={p.recipe_id ?? ''} onChange={e => save(p, { recipe_id: e.target.value || null })} className={`h-8 rounded-md border px-1.5 text-xs ${p.recipe_id ? '' : 'text-amber-600 border-amber-300'}`}>
                  <option value="">（未對照）</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </td>
            </tr>))}</tbody></table></div>}
    </div>
  )
}

// ── 差異分析（智能）──
function VarianceTab({ store, year, month }: { store: string; year: number; month: number }) {
  const [rows, setRows] = useState<VarRow[]>([])
  const [unmapped, setUnmapped] = useState<{ product_code: string; product_name: string; qty: number }[]>([])
  const [cc, setCc] = useState<CrossChecks | null>(null)
  const [threshold, setThreshold] = useState(10)
  const [overCount, setOverCount] = useState(0)
  const [totalLoss, setTotalLoss] = useState(0)
  const [loading, setLoading] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [showCfg, setShowCfg] = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])
  const [cfg, setCfg] = useState<InvSettings>({ variance_threshold: 10, cup_code: '', tea_code: '', creamer_code: '', tea_per_cup: 0, creamer_per_cup: 0 })

  const load = useCallback(async () => {
    if (!store) { setRows([]); return }
    setLoading(true)
    const res = await fetch(`/api/inv/variance?store=${encodeURIComponent(store)}&year=${year}&month=${month}`)
    if (res.ok) { const d = await res.json(); setRows(d.rows ?? []); setUnmapped(d.unmapped ?? []); setThreshold(d.threshold ?? 10); setOverCount(d.over_count ?? 0); setTotalLoss(d.total_loss ?? 0); setCc(d.cross_checks ?? null) }
    setLoading(false)
  }, [store, year, month])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/inv/settings').then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg({ variance_threshold: d.variance_threshold ?? 10, cup_code: d.cup_code ?? '', tea_code: d.tea_code ?? '', creamer_code: d.creamer_code ?? '', tea_per_cup: d.tea_per_cup ?? 0, creamer_per_cup: d.creamer_per_cup ?? 0 }) })
    fetch('/api/inv/recipes').then(r => r.ok ? r.json() : null).then(d => { if (d) setMaterials(d.materials ?? []) })
  }, [])

  const notify = async () => {
    setNotifying(true)
    const res = await fetch('/api/inv/variance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, year, month }) })
    setNotifying(false)
    const d = await res.json().catch(() => ({}))
    alert(res.ok ? (d.notified ? `已通知人事（${d.over_count} 項超標）` : '目前無超標項目') : (d.error ?? '通知失敗'))
  }

  const saveThreshold = async (v: number) => {
    setThreshold(v)
    await fetch('/api/inv/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variance_threshold: v }) })
    load()
  }
  const saveCfg = async () => {
    await fetch('/api/inv/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setShowCfg(false); load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm"><span className="text-gray-500">誤差警示門檻</span>
          <Input type="number" value={String(threshold)} onChange={e => setThreshold(Number(e.target.value) || 0)} onBlur={e => saveThreshold(Number(e.target.value) || 0)} className="w-20" /><span className="text-gray-500">%</span></label>
        {overCount > 0 && <span className="text-sm text-red-600 font-medium">⚠️ {overCount} 項超過門檻</span>}
        {totalLoss > 0 && <span className="text-sm text-red-500">估計金額損失 <b>{fmt(totalLoss)}</b></span>}
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => setShowCfg(v => !v)}>交叉檢核設定</Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={notifying || overCount === 0} onClick={notify}>
          {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}通知人事超標
        </Button>
      </div>

      <p className="text-xs text-gray-400">實耗＝IVT 期初＋叫貨−期末。理論用量含配方負值（加料排擠基底）。</p>

      {showCfg && (
        <Card className="p-3 space-y-2">
          <div className="text-sm font-medium">交叉檢核設定（指定杯子/茶/奶精原料與每杯基準）</div>
          <div className="grid md:grid-cols-3 gap-2 text-xs">
            <label className="space-y-1"><span className="text-gray-500">杯子原料</span>
              <select value={cfg.cup_code} onChange={e => setCfg({ ...cfg, cup_code: e.target.value })} className="w-full h-8 rounded-md border px-1.5"><option value="">—</option>{materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}</option>)}</select></label>
            <label className="space-y-1"><span className="text-gray-500">茶原料</span>
              <select value={cfg.tea_code} onChange={e => setCfg({ ...cfg, tea_code: e.target.value })} className="w-full h-8 rounded-md border px-1.5"><option value="">—</option>{materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}</option>)}</select></label>
            <label className="space-y-1"><span className="text-gray-500">奶精原料</span>
              <select value={cfg.creamer_code} onChange={e => setCfg({ ...cfg, creamer_code: e.target.value })} className="w-full h-8 rounded-md border px-1.5"><option value="">—</option>{materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}</option>)}</select></label>
            <label className="space-y-1"><span className="text-gray-500">每杯茶量（反推用）</span><Input type="number" value={String(cfg.tea_per_cup)} onChange={e => setCfg({ ...cfg, tea_per_cup: Number(e.target.value) || 0 })} className="h-8" /></label>
            <label className="space-y-1"><span className="text-gray-500">每杯奶精量（反推用）</span><Input type="number" value={String(cfg.creamer_per_cup)} onChange={e => setCfg({ ...cfg, creamer_per_cup: Number(e.target.value) || 0 })} className="h-8" /></label>
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={saveCfg}>儲存</Button></div>
        </Card>
      )}

      {cc && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <CcCard label="售出杯數（飲料）" value={fmt(cc.cups_sold)} hint={cc.cups_sold === 0 ? '請到成品對照標「飲料」' : ''} />
          <CcCard label="杯子對帳" value={cc.cup_used === null ? '—' : fmt(cc.cup_used)}
            hint={cc.cup_diff === null ? '未設杯子原料' : `差 ${fmt(cc.cup_diff)}`} tone={cc.cup_diff !== null && Math.abs(cc.cup_diff) > cc.cups_sold * 0.05 ? 'red' : undefined} />
          <CcCard label="茶:奶精 實際" value={cc.ratio_actual === null ? '—' : fmt1(cc.ratio_actual)}
            hint={cc.ratio_recipe === null ? '未設每杯量' : `配方 ${fmt1(cc.ratio_recipe)}`}
            tone={cc.ratio_actual !== null && cc.ratio_recipe !== null && Math.abs(cc.ratio_actual - cc.ratio_recipe) / cc.ratio_recipe > 0.15 ? 'red' : undefined} />
          <CcCard label="反推等效杯數（茶）" value={cc.implied_cups_tea === null ? '—' : fmt(cc.implied_cups_tea)}
            hint={cc.implied_cups_tea === null ? '未設每杯茶量' : `售出 ${fmt(cc.cups_sold)}`}
            tone={cc.implied_cups_tea !== null && cc.cups_sold > 0 && Math.abs(cc.implied_cups_tea - cc.cups_sold) / cc.cups_sold > 0.1 ? 'red' : undefined} />
        </div>
      )}

      {unmapped.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          有 {unmapped.length} 個成品尚未對照配方（不計入理論用量）：{unmapped.slice(0, 8).map(u => u.product_name || u.product_code).join('、')}{unmapped.length > 8 ? '…' : ''}
        </div>
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">無資料。請先匯入 POS＋進銷存、建立配方並完成對照。</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">理論用量</th><th className="pr-2 text-right">實耗</th><th className="pr-2 text-right">差額</th><th className="pr-2 text-right">誤差%</th><th className="pr-2 text-right">金額損失</th><th className="pr-2 text-right">剩餘</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.material_code} className={`border-b last:border-0 ${r.over ? 'bg-red-50' : ''}`}>
              <td className="py-1.5 pr-2">{r.material_name}</td>
              <td className="pr-2 text-gray-400">{r.unit}</td>
              <td className="pr-2 text-right tabular-nums">{fmt1(r.theoretical)}</td>
              <td className="pr-2 text-right tabular-nums">{fmt1(r.actual)}</td>
              <td className={`pr-2 text-right tabular-nums ${r.diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmt1(r.diff)}</td>
              <td className={`pr-2 text-right tabular-nums font-medium ${r.over ? 'text-red-600' : ''}`}>{r.pct === null ? '—' : `${fmt1(r.pct)}%`}</td>
              <td className={`pr-2 text-right tabular-nums ${r.money_loss > 0 ? 'text-red-500' : 'text-gray-400'}`}>{r.price > 0 ? fmt(r.money_loss) : '—'}</td>
              <td className="pr-2 text-right tabular-nums text-gray-500">{fmt1(r.remaining)}</td>
            </tr>))}</tbody></table></div>}
    </div>
  )
}

function CcCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'red' }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${tone === 'red' ? 'text-red-600' : 'text-gray-800'}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
    </Card>
  )
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : 'text-gray-800'
  return (
    <Card className="p-3"><div className="flex items-center gap-1.5 text-xs text-gray-500">{icon}{label}</div><div className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{value}</div></Card>
  )
}
