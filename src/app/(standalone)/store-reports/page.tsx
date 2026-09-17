'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Store, Upload, Loader2, AlertCircle, TrendingUp, Package, Building2, DollarSign, BookOpen, Link2, Scale, Plus, Trash2, X, FlaskConical, ClipboardList, Calendar, Wrench, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const fmt = (n: number, locale: string) => Math.round(n).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')
const fmt1 = (n: number, locale: string) => (Math.round(n * 10) / 10).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')
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
interface VarRow { material_code: string; material_name: string; unit: string; expected: number; actual: number; recipe_theo: number; remaining: number; diff: number; pct: number | null; over: boolean; price: number; money_loss: number }
interface CrossChecks {
  cups_sold: number; cup_used: number | null; cup_diff: number | null
  tea_used: number | null; creamer_used: number | null
  ratio_actual: number | null; ratio_recipe: number | null
  implied_cups_tea: number | null; implied_cups_creamer: number | null; configured: boolean
}
interface GapInfo { expected: number; actual: number; gap: number; gap_cups: number | null }
interface ToppingRow { material_code: string; material_name: string; servings_expected: number; servings_actual: number; extra_servings: number; tea_disp: number; creamer_disp: number }
interface Possibility {
  configured: boolean; tea: GapInfo | null; creamer: GapInfo | null
  toppings: ToppingRow[]; extra_topping_servings: number
  tea_explained: number; creamer_explained: number
  tea_explained_pct: number | null; creamer_explained_pct: number | null; has_displacement: boolean
}
interface InvSettings { variance_threshold: number; cup_code: string; tea_code: string; creamer_code: string; tea_per_cup: number; creamer_per_cup: number }

export default function StoreReportsPage() {
  const t = useTranslations('StoreReports')
  const now = new Date()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('report')
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [lockedStore, setLockedStore] = useState<string | null>(null)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const loadStores = useCallback(async () => {
    const res = await fetch('/api/inv/stores')
    if (res.status === 403) { setIsAdmin(false); return }
    setIsAdmin(true)
    const d = await res.json()
    if (d.locked_store) {
      setLockedStore(d.locked_store)
      setStores([d.locked_store])
      setStore(d.locked_store)
    } else {
      setStores(d.stores ?? [])
      setStore(s => s || (d.stores?.[0] ?? ''))
    }
  }, [])
  useEffect(() => { loadStores() }, [loadStores])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('adminOnly')}</p></div>
    </div>
  )

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'report', label: t('tabReport'), icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'recipes', label: t('tabRecipes'), icon: <BookOpen className="h-4 w-4" /> },
    { id: 'mapping', label: t('tabMapping'), icon: <Link2 className="h-4 w-4" /> },
    { id: 'variance', label: t('tabVariance'), icon: <Scale className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Store className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/store-inventory">
              <ClipboardList className="h-4 w-4 text-blue-600" />{t('inventory')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/store-bills">
              <Receipt className="h-4 w-4 text-emerald-600" />{t('bills')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/repair">
              <Wrench className="h-4 w-4 text-amber-600" />{t('repair')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/shift">
              <Calendar className="h-4 w-4 text-indigo-600" />{t('shift')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/pos">
              <Store className="h-4 w-4 text-orange-600" />{t('pos')}
            </Link>
          </Button>
        </div>
      </div>

      {/* 門市 / 年月（報表與差異用） */}
      {(tab === 'report' || tab === 'variance') && (
        <Card className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="block text-xs text-gray-500">{t('storeCode')}</span>
                {lockedStore && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    🔒 {t('lockedNoSwitch')}
                  </span>
                )}
              </div>
              <Input
                list={lockedStore ? undefined : "store-list"}
                value={store}
                disabled={!!lockedStore}
                onChange={e => setStore(e.target.value)}
                placeholder={t('storePlaceholder')}
                className="w-44 disabled:bg-muted/50 disabled:cursor-not-allowed font-semibold"
              />
              {!lockedStore && <datalist id="store-list">{stores.map(s => <option key={s} value={s} />)}</datalist>}
            </label>
            <label className="space-y-1"><span className="block text-xs text-gray-500">{t('year')}</span>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}</select></label>
            <label className="space-y-1"><span className="block text-xs text-gray-500">{t('month')}</span>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border px-2 text-sm">{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}</select></label>
          </div>
        </Card>
      )}

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'report' && <ReportTab store={store} year={year} month={month} onImported={loadStores} />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'mapping' && <MappingTab />}
      {tab === 'variance' && <VarianceTab store={store} year={year} month={month} onGoToMapping={() => setTab('mapping')} />}
    </div>
  )
}

// ── 報表 ──
function ReportTab({ store, year, month, onImported }: { store: string; year: number; month: number; onImported: () => void }) {
  const t = useTranslations('StoreReports')
  const locale = useLocale()
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
    if (!store.trim()) { setMsg(t('enterStoreFirst')); return }
    setUploading('pos'); setMsg('')
    const fd = new FormData(); fd.append('file', file); fd.append('store', store.trim()); fd.append('year', String(year)); fd.append('month', String(month))
    const res = await fetch('/api/inv/import/pos', { method: 'POST', body: fd })
    setUploading('')
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setMsg(t('posImported', { n: d.imported })); onImported(); load() } else setMsg(d.error ?? t('importFailed'))
  }
  const uploadInv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading('inv'); setMsg('')
    const fd = new FormData(); fd.append('file', file); fd.append('year', String(year)); fd.append('month', String(month))
    const res = await fetch('/api/inv/import/inventory', { method: 'POST', body: fd })
    setUploading('')
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setMsg(t('invImported', { list: (d.stores ?? []).map((s: { store: string; count: number }) => `${s.store}(${s.count})`).join('、') })); onImported(); load() } else setMsg(d.error ?? t('importFailed'))
  }
  return (
    <div className="space-y-4">
      <input ref={posRef} type="file" hidden accept=".xls" onChange={uploadPos} />
      <input ref={invRef} type="file" hidden accept=".xlsx" onChange={uploadInv} />
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => posRef.current?.click()}>{uploading === 'pos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{t('importPos')}</Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!!uploading} onClick={() => invRef.current?.click()}>{uploading === 'inv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{t('importInv')}</Button>
        <span className="text-xs text-gray-400">{t('standardPriceNote')}</span>
        {msg && <span className="text-sm text-blue-600 self-center">{msg}</span>}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : !report || (report.pos.rows.length === 0 && report.inventory.rows.length === 0) ? <div className="text-center py-10 text-gray-400 text-sm">{t('noDataYet')}</div>
        : (<>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={<TrendingUp className="h-4 w-4" />} label={t('revenue')} value={fmt(report.pos.total_revenue, locale)} tone="green" />
            <Stat icon={<Package className="h-4 w-4" />} label={t('totalCups')} value={fmt(report.pos.total_qty, locale)} />
            <Stat icon={<DollarSign className="h-4 w-4" />} label={t('purchaseExpense')} value={fmt(report.inventory.purchase_value, locale)} tone="red" />
            <Stat icon={<Package className="h-4 w-4" />} label={t('closingInventoryValue')} value={fmt(report.inventory.close_value, locale)} />
          </div>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">{t('salesDetail', { n: report.pos.product_count })}</h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('product')}</th><th className="pr-2 text-right">{t('cups')}</th><th className="pr-2 text-right">{t('revenue')}</th></tr></thead>
                <tbody>{report.pos.rows.map((r, i) => <tr key={i} className="border-b last:border-0"><td className="py-1.5 pr-2">{r.product_name || r.product_code}</td><td className="pr-2 text-right tabular-nums">{fmt(r.qty, locale)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.revenue, locale)}</td></tr>)}</tbody></table>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">{t('inventoryDetail', { n: report.inventory.material_count })}</h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2 text-right">{t('opening')}</th><th className="pr-2 text-right">{t('stockIn')}</th><th className="pr-2 text-right">{t('stockOut')}</th><th className="pr-2 text-right">{t('remaining')}</th><th className="pr-2 text-right">{t('purchaseValue')}</th></tr></thead>
                <tbody>{report.inventory.rows.map((r, i) => <tr key={i} className="border-b last:border-0"><td className="py-1.5 pr-2">{r.material_name || r.material_code}</td><td className="pr-2 text-gray-400">{r.unit}</td><td className="pr-2 text-right tabular-nums">{fmt(r.open_qty, locale)}</td><td className="pr-2 text-right tabular-nums text-blue-600">{fmt(r.in_total, locale)}</td><td className="pr-2 text-right tabular-nums text-red-500">{fmt(r.out_total, locale)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.close_qty, locale)}</td><td className="pr-2 text-right tabular-nums">{fmt(r.in_value, locale)}</td></tr>)}</tbody></table>
            </div>
          </Card>
        </>)}
    </div>
  )
}

// ── 配方 ──
function RecipesTab() {
  const t = useTranslations('StoreReports')
  const locale = useLocale()
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
    if (res.ok) { setEditing(null); load() } else alert((await res.json().catch(() => ({}))).error ?? t('saveFailed'))
  }
  const remove = async (r: Recipe) => {
    if (!confirm(t('confirmDeleteRecipe', { name: r.name }))) return
    await fetch('/api/inv/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); load()
  }
  const addItem = () => setEditing(e => e ? { ...e, items: [...e.items, { material_code: '', material_name: '', qty_per_cup: 0 }] } : e)
  const setItem = (i: number, patch: Partial<RecipeItem>) => setEditing(e => { if (!e) return e; const items = [...e.items]; items[i] = { ...items[i], ...patch }; return { ...e, items } })
  const pickMaterial = (i: number, code: string) => { const m = materials.find(x => x.code === code); setItem(i, { material_code: code, material_name: m?.name ?? '' }) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setEditing({ name: '', note: '', items: [] })}><Plus className="h-4 w-4" />{t('newRecipe')}</Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : recipes.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">{t('noRecipes')}</div>
        : <div className="grid gap-2">{recipes.map(r => (
          <Card key={r.id} className="p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{t('materialCount', { n: r.items.length, list: r.items.map(i => `${i.material_name || i.material_code}×${fmt1(i.qty_per_cup, locale)}`).join('、') || t('notSet') })}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setEditing({ id: r.id, name: r.name, note: r.note, items: r.items.map(i => ({ ...i })) })} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">{t('edit')}</button>
              <button onClick={() => remove(r)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          </Card>))}</div>}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{editing.id ? t('editRecipe') : t('newRecipe')}</h3><button onClick={() => setEditing(null)}><X className="h-5 w-5 text-gray-400" /></button></div>
            <label className="block space-y-1"><span className="text-xs text-gray-500">{t('recipeName')}</span><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{t('materialsPerCup')}</span><button onClick={addItem} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">{t('addMaterial')}</button></div>
              {editing.items.length === 0 && <p className="text-xs text-gray-400">{t('noMaterials')}</p>}
              {editing.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={it.material_code} onChange={e => pickMaterial(i, e.target.value)} className="flex-1 h-9 rounded-md border px-2 text-sm">
                    <option value="">{t('selectMaterial')}</option>
                    {materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}{m.unit ? `（${m.unit}）` : ''}</option>)}
                  </select>
                  <Input type="number" value={String(it.qty_per_cup)} onChange={e => setItem(i, { qty_per_cup: Number(e.target.value) || 0 })} placeholder={t('qtyPerCup')} className="w-24" />
                  <button onClick={() => setEditing(e => e ? { ...e, items: e.items.filter((_, x) => x !== i) } : e)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setEditing(null)}>{t('cancel')}</Button><Button size="sm" onClick={save} disabled={busy || !editing.name.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 成品對照 ──
function MappingTab() {
  const t = useTranslations('StoreReports')
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
      <p className="text-sm text-gray-500">{t('mappingDesc', { mapped, total: products.length })}</p>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : products.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">{t('noProductsYet')}</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">{t('productCode')}</th><th className="pr-2">{t('name')}</th><th className="pr-2">{t('category')}</th><th className="pr-2">{t('mappedRecipe')}</th></tr></thead>
          <tbody>{products.map(p => (
            <tr key={p.product_code} className="border-b last:border-0">
              <td className="py-1.5 pr-2 tabular-nums text-gray-500">{p.product_code}</td>
              <td className="pr-2">{p.product_name}</td>
              <td className="pr-2">
                <select value={p.kind || ''} onChange={e => save(p, { kind: e.target.value })} className="h-8 rounded-md border px-1.5 text-xs">
                  <option value="">{t('unclassified')}</option>
                  <option value="drink">{t('drink')}</option>
                  <option value="topping">{t('topping')}</option>
                  <option value="other">{t('other')}</option>
                </select>
              </td>
              <td className="pr-2">
                <select value={p.recipe_id ?? ''} onChange={e => save(p, { recipe_id: e.target.value || null })} className={`h-8 rounded-md border px-1.5 text-xs ${p.recipe_id ? '' : 'text-amber-600 border-amber-300'}`}>
                  <option value="">{t('notMapped')}</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </td>
            </tr>))}</tbody></table></div>}
    </div>
  )
}

// ── 差異分析（智能）──
function VarianceTab({ store, year, month, onGoToMapping }: { store: string; year: number; month: number; onGoToMapping?: () => void }) {
  const t = useTranslations('StoreReports')
  const locale = useLocale()
  const [rows, setRows] = useState<VarRow[]>([])
  const [unmapped, setUnmapped] = useState<{ product_code: string; product_name: string; qty: number }[]>([])
  const [cc, setCc] = useState<CrossChecks | null>(null)
  const [poss, setPoss] = useState<Possibility | null>(null)
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
    if (res.ok) { const d = await res.json(); setRows(d.rows ?? []); setUnmapped(d.unmapped ?? []); setThreshold(d.threshold ?? 10); setOverCount(d.over_count ?? 0); setTotalLoss(d.total_loss ?? 0); setCc(d.cross_checks ?? null); setPoss(d.possibility ?? null) }
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
    alert(res.ok ? (d.notified ? t('notifiedHr', { n: d.over_count }) : t('noOverItems')) : (d.error ?? t('notifyFailed')))
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
        <label className="flex items-center gap-2 text-sm"><span className="text-gray-500">{t('varianceThresholdLabel')}</span>
          <Input type="number" value={String(threshold)} onChange={e => setThreshold(Number(e.target.value) || 0)} onBlur={e => saveThreshold(Number(e.target.value) || 0)} className="w-20" /><span className="text-gray-500">%</span></label>

        {rows.length > 0 && (
          overCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              ✅ {t('usageNormal')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-rose-700 font-medium bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
              ⚠️ {t('usageAbnormal', { n: overCount })}
            </span>
          )
        )}

        {totalLoss > 0 && <span className="text-sm text-red-500">{t('estimatedLossLabel')} <b>{fmt(totalLoss, locale)}</b></span>}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowCfg(v => !v)}>{t('crossCheckSettings')}</Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={notifying || overCount === 0} onClick={notify}>
            {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{t('notifyHrOver')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500">🔍 {t('auditPurposeNote')}</p>
      <p className="text-xs text-gray-400">{t('varianceFootnote')}</p>

      {showCfg && (
        <Card className="p-3 space-y-2">
          <div className="text-sm font-medium">{t('crossCheckSettingsTitle')}</div>
          <div className="grid md:grid-cols-3 gap-2 text-xs">
            <label className="space-y-1"><span className="text-gray-500">{t('cupMaterial')}</span>
              <select value={cfg.cup_code} onChange={e => setCfg({ ...cfg, cup_code: e.target.value })} className="w-full h-8 rounded-md border px-1.5"><option value="">—</option>{materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}</option>)}</select></label>
            <label className="space-y-1"><span className="text-gray-500">{t('teaMaterial')}</span>
              <select value={cfg.tea_code} onChange={e => setCfg({ ...cfg, tea_code: e.target.value })} className="w-full h-8 rounded-md border px-1.5"><option value="">—</option>{materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}</option>)}</select></label>
            <label className="space-y-1"><span className="text-gray-500">{t('creamerMaterial')}</span>
              <select value={cfg.creamer_code} onChange={e => setCfg({ ...cfg, creamer_code: e.target.value })} className="w-full h-8 rounded-md border px-1.5"><option value="">—</option>{materials.map(m => <option key={m.code} value={m.code}>{m.name || m.code}</option>)}</select></label>
            <label className="space-y-1"><span className="text-gray-500">{t('teaPerCupReverse')}</span><Input type="number" value={String(cfg.tea_per_cup)} onChange={e => setCfg({ ...cfg, tea_per_cup: Number(e.target.value) || 0 })} className="h-8" /></label>
            <label className="space-y-1"><span className="text-gray-500">{t('creamerPerCupReverse')}</span><Input type="number" value={String(cfg.creamer_per_cup)} onChange={e => setCfg({ ...cfg, creamer_per_cup: Number(e.target.value) || 0 })} className="h-8" /></label>
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={saveCfg}>{t('save')}</Button></div>
        </Card>
      )}

      {cc && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <CcCard label={t('cupsSoldDrinks')} value={fmt(cc.cups_sold, locale)} hint={cc.cups_sold === 0 ? t('markAsDrinkHint') : ''} />
          <CcCard label={t('cupReconciliation')} value={cc.cup_used === null ? '—' : fmt(cc.cup_used, locale)}
            hint={cc.cup_diff === null ? t('cupMaterialNotSet') : t('diffHint', { amount: fmt(cc.cup_diff, locale) })} tone={cc.cup_diff !== null && Math.abs(cc.cup_diff) > cc.cups_sold * 0.05 ? 'red' : undefined} />
          <CcCard label={t('teaCreamerActualRatio')} value={cc.ratio_actual === null ? '—' : fmt1(cc.ratio_actual, locale)}
            hint={cc.ratio_recipe === null ? t('perCupNotSet') : t('recipeHint', { ratio: fmt1(cc.ratio_recipe, locale) })}
            tone={cc.ratio_actual !== null && cc.ratio_recipe !== null && Math.abs(cc.ratio_actual - cc.ratio_recipe) / cc.ratio_recipe > 0.15 ? 'red' : undefined} />
          <CcCard label={t('impliedCupsTea')} value={cc.implied_cups_tea === null ? '—' : fmt(cc.implied_cups_tea, locale)}
            hint={cc.implied_cups_tea === null ? t('teaPerCupNotSet') : t('soldHint', { amount: fmt(cc.cups_sold, locale) })}
            tone={cc.implied_cups_tea !== null && cc.cups_sold > 0 && Math.abs(cc.implied_cups_tea - cc.cups_sold) / cc.cups_sold > 0.1 ? 'red' : undefined} />
        </div>
      )}

      {poss && poss.configured && (poss.tea || poss.creamer) && (
        <Card className="p-3 space-y-2">
          <div className="text-sm font-medium flex items-center gap-1.5"><Scale className="h-4 w-4 text-indigo-500" />{t('displacementAnalysisTitle')}</div>
          <p className="text-[11px] text-gray-400">{t('displacementAnalysisDesc')}</p>
          <div className="grid md:grid-cols-2 gap-2">
            {poss.tea && <GapCard label={t('tea')} info={poss.tea} explainedPct={poss.tea_explained_pct} explained={poss.tea_explained} />}
            {poss.creamer && <GapCard label={t('creamer')} info={poss.creamer} explainedPct={poss.creamer_explained_pct} explained={poss.creamer_explained} />}
          </div>

          {poss.toppings.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-600">{t('toppingServingsTitle')}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-gray-400 border-b"><th className="py-1 pr-2">{t('topping')}</th><th className="pr-2 text-right">{t('expectedServings')}</th><th className="pr-2 text-right">{t('actualServings')}</th><th className="pr-2 text-right">{t('extraServings')}</th><th className="pr-2 text-right">{t('teaDisplacedPerServing')}</th></tr></thead>
                  <tbody>{poss.toppings.map(tp => (
                    <tr key={tp.material_code} className="border-b last:border-0">
                      <td className="py-1 pr-2">{tp.material_name}</td>
                      <td className="pr-2 text-right tabular-nums">{fmt(tp.servings_expected, locale)}</td>
                      <td className="pr-2 text-right tabular-nums">{fmt(tp.servings_actual, locale)}</td>
                      <td className={`pr-2 text-right tabular-nums font-medium ${tp.extra_servings > 0 ? 'text-indigo-600' : tp.extra_servings < 0 ? 'text-red-500' : 'text-gray-400'}`}>{tp.extra_servings > 0 ? '+' : ''}{fmt(tp.extra_servings, locale)}</td>
                      <td className="pr-2 text-right tabular-nums text-gray-400">{tp.tea_disp ? fmt1(tp.tea_disp, locale) : '—'}</td>
                    </tr>))}</tbody>
                </table>
              </div>
              <div className="text-[11px] text-gray-500">
                {t('extraToppingEstimate', { n: fmt(poss.extra_topping_servings, locale) })}
                {poss.has_displacement
                  ? t('displacementExplained', { tea: fmt1(poss.tea_explained, locale), creamerPart: poss.creamer_explained > 0.001 ? t('creamerExplainedPart', { amount: fmt1(poss.creamer_explained, locale) }) : '' })
                  : t('displacementNotConfigured')}
              </div>
            </div>
          )}
        </Card>
      )}

      {unmapped.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span>{t('unmappedProducts', { n: unmapped.length, list: unmapped.slice(0, 8).map(u => u.product_name || u.product_code).join('、'), ellipsis: unmapped.length > 8 ? '…' : '' })}</span>
          {onGoToMapping && <button onClick={onGoToMapping} className="text-amber-800 underline font-medium shrink-0">{t('goToMapping')}</button>}
        </div>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">{t('varianceNoData')}</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2 text-center">{t('usageStatus')}</th><th className="pr-2 text-right">{t('expectedPos')}</th><th className="pr-2 text-right">{t('actualUsage')}</th><th className="pr-2 text-right text-gray-400">{t('recipeTheoretical')}</th><th className="pr-2 text-right">{t('difference')}</th><th className="pr-2 text-right">{t('errorPct')}</th><th className="pr-2 text-right">{t('moneyLoss')}</th><th className="pr-2 text-right">{t('remaining')}</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.material_code} className={`border-b last:border-0 ${r.over ? 'bg-red-50/60' : ''}`}>
              <td className="py-1.5 pr-2 font-medium">{r.material_name}</td>
              <td className="pr-2 text-gray-400">{r.unit}</td>
              <td className="pr-2 text-center">
                {r.over ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">{t('abnormalOver')}</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">{t('normal')}</span>
                )}
              </td>
              <td className="pr-2 text-right tabular-nums">{fmt1(r.expected, locale)}</td>
              <td className="pr-2 text-right tabular-nums">{fmt1(r.actual, locale)}</td>
              <td className="pr-2 text-right tabular-nums text-gray-400">{r.recipe_theo ? fmt1(r.recipe_theo, locale) : '—'}</td>
              <td className={`pr-2 text-right tabular-nums ${r.diff > 0 ? 'text-red-500 font-medium' : 'text-emerald-600'}`}>{fmt1(r.diff, locale)}</td>
              <td className={`pr-2 text-right tabular-nums font-semibold ${r.over ? 'text-red-600' : 'text-gray-700'}`}>{r.pct === null ? '—' : `${fmt1(r.pct, locale)}%`}</td>
              <td className={`pr-2 text-right tabular-nums ${r.money_loss > 0 ? 'text-red-500' : 'text-gray-400'}`}>{r.price > 0 ? fmt(r.money_loss, locale) : '—'}</td>
              <td className="pr-2 text-right tabular-nums text-gray-500">{fmt1(r.remaining, locale)}</td>
            </tr>))}</tbody></table></div>}
    </div>
  )
}

function GapCard({ label, info, explainedPct, explained }: { label: string; info: GapInfo; explainedPct?: number | null; explained?: number }) {
  const t = useTranslations('StoreReports')
  const locale = useLocale()
  const less = info.gap > 0 // 實際少用
  const pct = explainedPct ?? null
  const unexplained = less && explained !== undefined ? Math.max(0, info.gap - explained) : null
  return (
    <div className="rounded-lg border p-3 space-y-0.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-gray-500">{t('expectedActual', { expected: fmt1(info.expected, locale), actual: fmt1(info.actual, locale) })}</div>
      <div className={`text-sm font-semibold tabular-nums ${less ? 'text-indigo-600' : info.gap < 0 ? 'text-red-600' : 'text-gray-600'}`}>
        {less ? t('underused') : info.gap < 0 ? t('overused') : t('onPar')} {fmt1(Math.abs(info.gap), locale)}
        {info.gap_cups !== null && Math.abs(info.gap_cups) >= 1 && <span className="text-gray-400 font-normal">{t('approxCups', { n: fmt(Math.abs(info.gap_cups), locale) })}</span>}
      </div>
      {less && pct !== null ? (
        <div className={`text-[11px] ${pct >= 70 ? 'text-emerald-600' : pct >= 30 ? 'text-amber-600' : 'text-red-500'}`}>
          {t('displacementExplainsAbout')} <b>{fmt(pct, locale)}%</b>
          {unexplained !== null && unexplained > 0.001 ? <>{t('unexplainedRemaining', { amount: fmt1(unexplained, locale), suffix: pct < 30 ? t('suspectedShortage') : '' })}</> : t('mostlyExplained')}
        </div>
      ) : (
        <div className="text-[11px] text-gray-400">
          {less ? t('normalDisplacementRange') : info.gap < 0 ? t('checkWasteOrShortage') : t('matchesExpected')}
        </div>
      )}
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
