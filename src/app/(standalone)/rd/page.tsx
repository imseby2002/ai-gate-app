'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import {
  FlaskConical, Upload, Loader2, AlertCircle, Building2, Store,
  Plus, Trash2, Edit3, Search, FileSpreadsheet, X, CheckCircle2,
  Package, BookOpen, Link2, Scale, TrendingUp, DollarSign, ChevronDown, ChevronUp, Info,
  Wrench, Coffee, ShoppingBag, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')
const fmt1 = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('zh-TW')

interface Material {
  code: string
  name: string
  unit: string
  category?: string
  purchase_price?: number // 工廠進貨價
  export_price?: number   // 賣給直營門市價格 (配方門市成本)
  dealer_price?: number   // 賣給經銷商或非直營門市價格
}

interface MaterialPrice {
  material_code: string
  material_name: string
  unit: string
  category?: string
  purchase_price: number // 工廠進貨價
  export_price: number   // 賣給直營門市價格 (配方門市成本)
  dealer_price: number   // 賣給經銷商或非直營門市價格
  updated_at: string
}

interface RecipeItem {
  id?: string
  material_code: string
  material_name: string
  qty_per_cup: number
  unit?: string
  category?: string
  purchase_price?: number // 工廠進貨價
  export_price?: number   // 賣給直營門市價格 (門市配方成本)
  dealer_price?: number   // 賣給經銷商或非直營門市價格
  store_cost?: number     // 門市成本 = 用量 × 直營門市價
  factory_cost?: number   // 工廠成本 = 用量 × 工廠進貨價
  dealer_cost?: number    // 經銷成本 = 用量 × 經銷價
  item_cost?: number      // 相容欄位 (門市成本)
  item_export?: number    // 相容欄位
}

interface Recipe {
  id: string
  name: string
  note: string
  created_at: string
  store_cost?: number     // 門市每杯總成本
  factory_cost?: number   // 工廠每杯總成本
  dealer_cost?: number    // 經銷每杯總成本
  factory_margin?: number // 工廠每杯毛利
  total_cost?: number     // 相容欄位
  items: RecipeItem[]
}

interface ProductMap {
  product_code: string
  product_name: string
  recipe_id: string | null
}

interface VarRow {
  material_code: string
  material_name: string
  unit: string
  theoretical: number
  actual: number
  remaining: number
  diff: number
  pct: number | null
  over: boolean
  price: number
  money_loss: number
}

type RdTab = 'recipes' | 'prices' | 'mapping' | 'variance'

export default function RdPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<RdTab>('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [prices, setPrices] = useState<MaterialPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [expandedRecipes, setExpandedRecipes] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ id?: string; name: string; note: string; items: RecipeItem[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)

  const toggleExpand = (id: string) => {
    setExpandedRecipes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inv/recipes')
      if (res.status === 403) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      setIsAdmin(true)
      if (res.ok) {
        const d = await res.json()
        setRecipes(d.recipes ?? [])
        setMaterials(d.materials ?? [])
        setPrices(d.prices ?? [])
      }
    } catch {
      setIsAdmin(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 匯入檔案 (.xlsx / .xls)
  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setMsg(null)
    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/inv/import/recipes', {
        method: 'POST',
        body: fd,
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ text: `成功匯入 / 更新 ${d.imported} 個配方！`, type: 'success' })
        loadData()
      } else {
        setMsg({ text: d.error ?? '匯入失敗', type: 'error' })
      }
    } catch (err) {
      setMsg({ text: `匯入發生錯誤：${err instanceof Error ? err.message : err}`, type: 'error' })
    }
    setUploading(false)
  }

  // 匯入原料/設備/道具/耗材 標準定價（中央維護）
  const handleUploadPrice = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/inv/import/prices', { method: 'POST', body: fd })
      const d = await res.json()
      if (res.ok) {
        setMsg({ text: `三層標準價匯入 ${d.imported} 筆！配方門市成本已自動重算更新。`, type: 'success' })
        loadData()
      } else {
        setMsg({ text: d.error ?? '匯入失敗', type: 'error' })
      }
    } catch (err) {
      setMsg({ text: `匯入發生錯誤：${err instanceof Error ? err.message : err}`, type: 'error' })
    }
    setUploading(false)
  }

  // 儲存（新增/修改配方）
  const saveRecipe = async () => {
    if (!editing?.name.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/inv/recipes', {
        method: editing.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) {
        setEditing(null)
        setMsg({ text: editing.id ? '配方與門市成本修改成功！' : '新配方建立成功！', type: 'success' })
        loadData()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? '儲存失敗')
      }
    } catch {
      alert('儲存失敗，請檢查網路連線')
    }
    setBusy(false)
  }

  // 刪除配方
  const removeRecipe = async (r: Recipe) => {
    if (!confirm(`確定要刪除配方「${r.name}」嗎？`)) return
    setMsg(null)
    const res = await fetch('/api/inv/recipes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id }),
    })
    if (res.ok) {
      setMsg({ text: `配方「${r.name}」已刪除`, type: 'success' })
      loadData()
    } else {
      alert('刪除失敗')
    }
  }

  // 彈出視窗：新增/修改原料
  const addItem = () =>
    setEditing(e => (e ? { ...e, items: [...e.items, { material_code: '', material_name: '', qty_per_cup: 0, unit: '', export_price: 0, purchase_price: 0, dealer_price: 0 }] } : e))

  const setItem = (i: number, patch: Partial<RecipeItem>) =>
    setEditing(e => {
      if (!e) return e
      const items = [...e.items]
      items[i] = { ...items[i], ...patch }
      return { ...e, items }
    })

  const pickMaterial = (i: number, code: string) => {
    const m = materials.find(x => x.code === code)
    const pr = prices.find(p => p.material_code === code)
    setItem(i, {
      material_code: code,
      material_name: m?.name ?? pr?.material_name ?? code,
      unit: m?.unit || pr?.unit || '',
      category: m?.category || pr?.category || '原料',
      export_price: pr?.export_price ?? m?.export_price ?? 0,     // 賣給直營門市價格 (門市成本)
      purchase_price: pr?.purchase_price ?? m?.purchase_price ?? 0, // 工廠進貨價
      dealer_price: pr?.dealer_price ?? m?.dealer_price ?? 0,     // 經銷商價格
    })
  }

  if (isAdmin === false) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
          <p className="font-semibold text-lg">僅研發單位可存取研發模組</p>
        </div>
      </div>
    )
  }

  // 搜尋過濾
  const filteredRecipes = recipes.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      (r.note && r.note.toLowerCase().includes(q)) ||
      r.items.some(
        i => i.material_name.toLowerCase().includes(q) || i.material_code.toLowerCase().includes(q)
      )
    )
  })

  const TABS: { id: RdTab; label: string; icon: ReactNode }[] = [
    { id: 'recipes', label: '配方與門市成本試算', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'prices', label: '原物料・設備・道具・耗材 定價庫', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'mapping', label: 'POS 成品對照', icon: <Link2 className="h-4 w-4" /> },
    { id: 'variance', label: '使用量檢驗 (差異分析)', icon: <Scale className="h-4 w-4" /> },
  ]

  // 計算當前編輯中配方的每杯門市成本（以賣給直營門市價格計算）與工廠成本（以工廠進貨價計算）
  const currentStoreCost = editing?.items.reduce((sum, it) => {
    const qty = Number(it.qty_per_cup) || 0
    const price = Number(it.export_price) || 0
    return sum + (qty * price)
  }, 0) ?? 0

  const currentFactoryCost = editing?.items.reduce((sum, it) => {
    const qty = Number(it.qty_per_cup) || 0
    const price = Number(it.purchase_price) || 0
    return sum + (qty * price)
  }, 0) ?? 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {/* 頂部標題與跨模組連結 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
            <FlaskConical className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">研發配方與成本中心 (R&D)</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium">三層定價體系</span>
            </div>
            <p className="text-sm text-muted-foreground">配方設計、門市原料成本（以賣給直營門市價計算）、工廠進貨成本與經銷批發價試算</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/rd-ai">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="h-4 w-4 text-indigo-600" />研發討論AI
            </Button>
          </Link>
          <Link href="/office">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              公司入口
            </Button>
          </Link>
          <Link href="/store-reports">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Store className="h-4 w-4" />
              門市報表
            </Button>
          </Link>
          <Link href="/audit">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Scale className="h-4 w-4" />
              原物料稽核
            </Button>
          </Link>
        </div>
      </div>

      {/* 隱藏的檔案上傳 input */}
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".xlsx,.xls"
        onChange={handleUpload}
      />
      <input
        ref={priceRef}
        type="file"
        hidden
        accept=".xlsx"
        onChange={handleUploadPrice}
      />

      {/* 訊息提示 */}
      {msg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 價格體系說明 Banner */}
      <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/40 rounded-xl p-3.5 flex items-start gap-3">
        <Info className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-950 dark:text-purple-200 space-y-1 leading-relaxed">
          <p className="font-semibold">三層價格與品項管理規則：</p>
          <ul className="list-disc list-inside space-y-0.5 text-purple-900/90 dark:text-purple-200/90">
            <li><b>賣給直營門市價格（ĐGX CH）</b>：<b>配方表使用這個價格作為門市飲品成本！</b></li>
            <li><b>工廠進貨價（ĐGN）</b>：工廠/總部的原物料採購進價。兩者相減即為工廠出貨給直營門市的毛利。</li>
            <li><b>賣給經銷商或非直營門市價格（ĐGX Đại lý）</b>：加盟店、經銷通路之出貨價格。</li>
            <li>涵蓋四大品類：<b>原料、設備、道具、耗材</b>，皆由此統一維護。</li>
          </ul>
        </div>
      </div>

      {/* 分頁按鈕列 */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit border flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-background text-purple-600 shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* 配方設計 TAB */}
      {tab === 'recipes' && (
        <div className="space-y-6">
          {/* 工具列：統計卡片 & 操作按鈕 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-xl">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">研發配方總數</p>
                <p className="text-2xl font-bold">
                  {recipes.length} <span className="text-xs font-normal text-muted-foreground">組</span>
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 rounded-xl">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">定價庫已建檔品項</p>
                <p className="text-2xl font-bold">
                  {prices.length} <span className="text-xs font-normal text-muted-foreground">項（原料/設備/道具/耗材）</span>
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">快速操作</p>
                <p className="text-xs text-gray-500">支援匯入配方表與三層定價標準檔</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  title="匯入配方表 Excel (.xlsx)"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  匯入配方
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={uploading}
                  onClick={() => priceRef.current?.click()}
                  title="匯入中央廚房標準價表 (GIÁ XUẤT CHUẨN)"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
                  )}
                  匯入定價
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  onClick={() => setEditing({ name: '', note: '', items: [] })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增配方
                </Button>
              </div>
            </Card>
          </div>

          {/* 搜尋與篩選列 */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜尋配方名稱、備註或原料名稱..."
                className="pl-9"
              />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                清除
              </Button>
            )}
          </div>

          {/* 配方列表 */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : filteredRecipes.length === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <FlaskConical className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                {search ? '沒有符合搜尋條件的配方' : '尚無研發配方，點擊「新增配方」或「匯入檔案」開始建立。'}
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> 匯入配方 (.xlsx / .xls)
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setEditing({ name: '', note: '', items: [] })}
                >
                  <Plus className="h-4 w-4" /> 新增第一個配方
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.map(r => {
                const isExpanded = expandedRecipes.has(r.id)
                const storeCost = r.store_cost ?? r.total_cost ?? 0
                const factoryCost = r.factory_cost ?? 0
                const factoryMargin = r.factory_margin ?? (storeCost - factoryCost)

                return (
                  <Card
                    key={r.id}
                    className="p-5 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow border"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-foreground">{r.name}</h3>
                          </div>
                          {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-purple-600"
                            onClick={() =>
                              setEditing({
                                id: r.id,
                                name: r.name,
                                note: r.note,
                                items: r.items.map(i => ({ ...i })),
                              })
                            }
                            title="編輯配方與成本"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-rose-600"
                            onClick={() => removeRecipe(r)}
                            title="刪除配方"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* 成本試算核心指標：依賣給直營門市價格計算門市成本 */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                        <div>
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 block font-bold">直營門市成本 (每杯)</span>
                          <span className="text-sm font-extrabold text-purple-700 dark:text-purple-300">
                            {fmt(storeCost)} <span className="text-[10px] font-normal">₫</span>
                          </span>
                          <span className="text-[9px] text-muted-foreground block">直營門市出貨價</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">工廠進貨成本 (每杯)</span>
                          <span className="text-sm font-bold text-foreground">
                            {fmt(factoryCost)} <span className="text-[10px] font-normal">₫</span>
                          </span>
                          <span className="text-[9px] text-muted-foreground block">工廠進貨底價</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-bold">工廠出貨毛利 (每杯)</span>
                          <span className={`text-sm font-bold ${factoryMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                            {fmt(factoryMargin)} <span className="text-[10px] font-normal">₫</span>
                          </span>
                          <span className="text-[9px] text-muted-foreground block">門市價 − 工廠價</span>
                        </div>
                      </div>

                      {/* 原料明細標籤與展開按鈕 */}
                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" /> 原料構成（{r.items.length} 項）：
                          </p>
                          {r.items.length > 0 && (
                            <button
                              onClick={() => toggleExpand(r.id)}
                              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                            >
                              {isExpanded ? <>收合明細 <ChevronUp className="h-3 w-3" /></> : <>完整成本明細 <ChevronDown className="h-3 w-3" /></>}
                            </button>
                          )}
                        </div>

                        {r.items.length === 0 ? (
                          <p className="text-xs text-amber-500 italic py-1">（未設定原料成分）</p>
                        ) : isExpanded ? (
                          /* 展開的 BOM 成本計算表格 */
                          <div className="overflow-x-auto rounded-lg border bg-background text-[11px]">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b bg-muted/40 text-muted-foreground">
                                  <th className="py-1.5 px-2 text-left">原料名稱</th>
                                  <th className="px-2 text-right">用量</th>
                                  <th className="px-2 text-right">直營門市價</th>
                                  <th className="px-2 text-right">門市每杯成本</th>
                                  <th className="px-2 text-right">工廠進價</th>
                                  <th className="px-2 text-right">經銷商價</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {r.items.map((it, idx) => (
                                  <tr key={idx} className="hover:bg-muted/20">
                                    <td className="py-1.5 px-2 font-medium">
                                      {it.material_name || it.material_code}
                                      {it.unit ? <span className="text-muted-foreground text-[10px] ml-1">({it.unit})</span> : ''}
                                    </td>
                                    <td className="px-2 text-right tabular-nums">{fmt1(it.qty_per_cup)}</td>
                                    <td className="px-2 text-right tabular-nums font-semibold text-purple-700 dark:text-purple-300">
                                      {fmt(it.export_price || 0)}
                                    </td>
                                    <td className="px-2 text-right tabular-nums font-bold text-purple-700 dark:text-purple-300">
                                      {fmt(it.store_cost ?? it.item_cost ?? 0)}
                                    </td>
                                    <td className="px-2 text-right tabular-nums text-muted-foreground">{fmt(it.purchase_price || 0)}</td>
                                    <td className="px-2 text-right tabular-nums text-muted-foreground">{fmt(it.dealer_price || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          /* 未展開時的標籤預覽 */
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {r.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent text-accent-foreground text-xs"
                              >
                                <span className="font-medium">{it.material_name || it.material_code}</span>
                                <span className="text-purple-600 dark:text-purple-400 font-semibold">
                                  ×{fmt1(it.qty_per_cup)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground/60 text-right pt-2">
                      建立時間：{new Date(r.created_at || Date.now()).toLocaleDateString('zh-TW')}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 原物料・設備・道具・耗材 定價庫 TAB */}
      {tab === 'prices' && (
        <PricesSection
          prices={prices}
          uploading={uploading}
          onUploadClick={() => priceRef.current?.click()}
        />
      )}

      {/* POS 成品對照 TAB */}
      {tab === 'mapping' && <MappingSection />}

      {/* 使用量檢驗 TAB */}
      {tab === 'variance' && <VarianceSection />}

      {/* 編輯 / 新增配方 彈出 Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card text-card-foreground border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" />
                <h3 className="font-bold text-lg">{editing.id ? '修改研發配方與成本' : '新增研發配方（含門市成本試算）'}</h3>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">配方 / 成品名稱 *</span>
                  <Input
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="例如：招牌珍珠奶茶 (L)"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">備註說明</span>
                  <Input
                    value={editing.note}
                    onChange={e => setEditing({ ...editing, note: e.target.value })}
                    placeholder="研發心得或規格說明..."
                  />
                </label>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-purple-600" />
                      原料成分與三層成本試算
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      選擇原料自動帶出直營門市出貨價與工廠進價；<b>門市成本＝用量 × 賣給直營門市價</b>
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5" /> 增加原料
                  </Button>
                </div>

                {editing.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 bg-accent/30 rounded-lg border border-dashed">
                    尚未選擇原料，點擊右上角「增加原料」開始設定。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editing.items.map((it, i) => {
                      const lineStoreCost = (Number(it.qty_per_cup) || 0) * (Number(it.export_price) || 0)
                      return (
                        <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-accent/30 p-2.5 rounded-lg border text-xs">
                          {/* 選擇原料 */}
                          <div className="flex-1 min-w-0">
                            {materials.length > 0 ? (
                              <select
                                value={it.material_code}
                                onChange={e => pickMaterial(i, e.target.value)}
                                className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                <option value="">選擇原料...</option>
                                {materials.map(m => (
                                  <option key={m.code} value={m.code}>
                                    {m.name || m.code} {m.unit ? `(${m.unit})` : ''} [直營門市價:{fmt(m.export_price || 0)} | 工廠進價:{fmt(m.purchase_price || 0)}]
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                value={it.material_name || it.material_code}
                                onChange={e =>
                                  setItem(i, { material_code: e.target.value, material_name: e.target.value })
                                }
                                placeholder="原料代碼或名稱"
                                className="h-8 text-xs"
                              />
                            )}
                          </div>

                          {/* 單位 */}
                          <div className="w-14 shrink-0">
                            <Input
                              value={it.unit || ''}
                              onChange={e => setItem(i, { unit: e.target.value })}
                              placeholder="單位"
                              className="h-8 text-xs text-center"
                            />
                          </div>

                          {/* 每杯用量 */}
                          <div className="w-20 shrink-0">
                            <Input
                              type="number"
                              step="any"
                              value={it.qty_per_cup || ''}
                              onChange={e => setItem(i, { qty_per_cup: Number(e.target.value) || 0 })}
                              placeholder="用量"
                              className="h-8 text-xs"
                              title="每杯用量"
                            />
                          </div>

                          {/* 賣給直營門市價格 (門市成本單價) */}
                          <div className="w-24 shrink-0">
                            <Input
                              type="number"
                              step="any"
                              value={it.export_price ?? ''}
                              onChange={e => setItem(i, { export_price: Number(e.target.value) || 0 })}
                              placeholder="直營門市價"
                              className="h-8 text-xs font-semibold text-purple-700 dark:text-purple-300"
                              title="賣給直營門市價格（計算門市每杯成本）"
                            />
                          </div>

                          {/* 工廠進貨價 */}
                          <div className="w-24 shrink-0">
                            <Input
                              type="number"
                              step="any"
                              value={it.purchase_price ?? ''}
                              onChange={e => setItem(i, { purchase_price: Number(e.target.value) || 0 })}
                              placeholder="工廠進價"
                              className="h-8 text-xs text-muted-foreground"
                              title="工廠採購進價（工廠進貨成本）"
                            />
                          </div>

                          {/* 門市成本小計 */}
                          <div className="w-20 shrink-0 text-right tabular-nums font-bold text-purple-700 dark:text-purple-300">
                            {fmt(lineStoreCost)} ₫
                          </div>

                          {/* 刪除列 */}
                          <button
                            onClick={() =>
                              setEditing(e => (e ? { ...e, items: e.items.filter((_, x) => x !== i) } : e))
                            }
                            className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t bg-muted/20">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">直營門市每杯成本：</span>
                  <span className="text-base font-extrabold text-purple-700 dark:text-purple-400 ml-1">
                    {fmt(currentStoreCost)} ₫
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">工廠每杯進價：</span>
                  <span className="text-sm font-semibold text-foreground ml-1">
                    {fmt(currentFactoryCost)} ₫
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">工廠毛利：</span>
                  <span className={`text-sm font-semibold ml-1 ${currentStoreCost >= currentFactoryCost ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {fmt(currentStoreCost - currentFactoryCost)} ₫
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={saveRecipe}
                  disabled={busy || !editing.name.trim()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  儲存配方與成本
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 子組件：原料・設備・道具・耗材 定價庫 ──
function PricesSection({
  prices,
  uploading,
  onUploadClick,
}: {
  prices: MaterialPrice[]
  uploading: boolean
  onUploadClick: () => void
}) {
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | '原料' | '設備' | '道具' | '耗材'>('all')

  const filtered = prices.filter(p => {
    const matchQ =
      !q.trim() ||
      p.material_code.toLowerCase().includes(q.toLowerCase()) ||
      p.material_name.toLowerCase().includes(q.toLowerCase())
    const matchCat = categoryFilter === 'all' || (p.category || '原料') === categoryFilter
    return matchQ && matchCat
  })

  const CATEGORIES = [
    { id: 'all', label: '全製品項', icon: Layers },
    { id: '原料', label: '原料 (飲品配方)', icon: Coffee },
    { id: '設備', label: '設備機器', icon: Wrench },
    { id: '道具', label: '吧台道具器具', icon: Package },
    { id: '耗材', label: '包裝耗材', icon: ShoppingBag },
  ] as const

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            原物料・設備・道具・耗材 三層定價庫
          </h3>
          <p className="text-xs text-muted-foreground">
            維護全公司各品項的「工廠進貨價」、「賣給直營門市價格（配方門市成本）」與「賣給經銷商或非直營門市價格」。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={uploading}
            onClick={onUploadClick}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-amber-600" />
            )}
            匯入三層標準定價表 (.xlsx)
          </Button>
        </div>
      </div>

      {/* 分類篩選 Tab 按鈕 */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map(c => {
          const Icon = c.icon
          const count = c.id === 'all' ? prices.length : prices.filter(p => (p.category || '原料') === c.id).length
          return (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                categoryFilter === c.id
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜尋品項代碼、名稱..."
            className="pl-9 h-9 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          共 {filtered.length} 項品類定價
        </span>
      </div>

      {prices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
          <p>定價庫尚無標準價資料</p>
          <p className="text-xs text-gray-400">
            點擊上方「匯入三層標準定價表 (.xlsx)」上傳中央廚房進價／售價表（GIÁ XUẤT CHUẨN），系統將自動建立定價庫。
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground text-left">
                <th className="py-2 px-3 font-semibold">品類</th>
                <th className="px-3 font-semibold">品項代碼</th>
                <th className="px-3 font-semibold">品項名稱</th>
                <th className="px-3 font-semibold">單位</th>
                <th className="px-3 text-right font-semibold">工廠進貨價 (ĐGN)</th>
                <th className="px-3 text-right font-semibold text-purple-700 dark:text-purple-300">
                  賣給直營門市價 (門市配方成本)
                </th>
                <th className="px-3 text-right font-semibold">賣給經銷商/非直營門市價</th>
                <th className="px-3 text-right font-semibold">最後更新</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.material_code} className="hover:bg-muted/20">
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border">
                      {p.category || '原料'}
                    </span>
                  </td>
                  <td className="px-3 font-mono font-medium text-foreground">{p.material_code}</td>
                  <td className="px-3 font-medium">{p.material_name}</td>
                  <td className="px-3 text-muted-foreground">{p.unit}</td>
                  <td className="px-3 text-right tabular-nums text-foreground">
                    {fmt(p.purchase_price)} ₫
                  </td>
                  <td className="px-3 text-right tabular-nums font-bold text-purple-700 dark:text-purple-300">
                    {fmt(p.export_price)} ₫
                  </td>
                  <td className="px-3 text-right tabular-nums text-foreground">
                    {fmt(p.dealer_price || 0)} ₫
                  </td>
                  <td className="px-3 text-right text-muted-foreground/70">
                    {new Date(p.updated_at || Date.now()).toLocaleDateString('zh-TW')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── 子組件：POS 成品與研發配方對照 ──
function MappingSection() {
  const [products, setProducts] = useState<ProductMap[]>([])
  const [recipes, setRecipes] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/inv/product-map')
    if (res.ok) {
      const d = await res.json()
      setProducts(d.products ?? [])
      setRecipes(d.recipes ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setMap = async (p: ProductMap, recipe_id: string) => {
    setProducts(prev =>
      prev.map(x => (x.product_code === p.product_code ? { ...x, recipe_id: recipe_id || null } : x))
    )
    await fetch('/api/inv/product-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_code: p.product_code,
        product_name: p.product_name,
        recipe_id: recipe_id || null,
      }),
    })
  }

  const mapped = products.filter(p => p.recipe_id).length

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-600" />
            POS 成品 與 研發配方對照
          </h3>
          <p className="text-xs text-muted-foreground">
            將門市 POS 售出成品綁定至研發配方，用於精確計算實際門市售出時的原料理論消耗量。
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
          已對照：{mapped} / {products.length}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-purple-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
          <p>尚無 POS 成品資料</p>
          <p className="text-xs">請先於「門市報表」匯入 POS 售出資料檔，系統將自動解析出成品品項。</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b bg-muted/40">
                <th className="py-2.5 px-3">POS 成品碼</th>
                <th className="px-3">成品名稱</th>
                <th className="px-3">對照研發配方</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.product_code} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="py-2 px-3 tabular-nums font-mono text-muted-foreground">{p.product_code}</td>
                  <td className="px-3 font-medium">{p.product_name}</td>
                  <td className="px-3">
                    <select
                      value={p.recipe_id ?? ''}
                      onChange={e => setMap(p, e.target.value)}
                      className={`h-9 rounded-md border px-3 text-xs w-full max-w-md ${
                        p.recipe_id
                          ? 'border-input bg-background'
                          : 'text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      <option value="">（未對照配方）</option>
                      {recipes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── 子組件：使用量檢驗（與門市報表串接差異分析） ──
function VarianceSection() {
  const now = new Date()
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [rows, setRows] = useState<VarRow[]>([])
  const [unmapped, setUnmapped] = useState<{ product_code: string; product_name: string; qty: number }[]>([])
  const [threshold, setThreshold] = useState(10)
  const [overCount, setOverCount] = useState(0)
  const [totalLoss, setTotalLoss] = useState(0)
  const [loading, setLoading] = useState(false)
  const [notifying, setNotifying] = useState(false)

  // 載入門市清單
  useEffect(() => {
    fetch('/api/inv/stores')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.stores)) {
          setStores(d.stores)
          if (d.stores.length > 0) setStore(s => s || d.stores[0])
        }
      })
      .catch(() => {})
  }, [])

  // 載入差異分析數據
  const loadVariance = useCallback(async () => {
    if (!store) {
      setRows([])
      return
    }
    setLoading(true)
    const res = await fetch(`/api/inv/variance?store=${encodeURIComponent(store)}&year=${year}&month=${month}`)
    if (res.ok) {
      const d = await res.json()
      setRows(d.rows ?? [])
      setUnmapped(d.unmapped ?? [])
      setThreshold(d.threshold ?? 10)
      setOverCount(d.over_count ?? 0)
      setTotalLoss(d.total_loss ?? 0)
    }
    setLoading(false)
  }, [store, year, month])

  useEffect(() => {
    loadVariance()
  }, [loadVariance])

  const notify = async () => {
    setNotifying(true)
    const res = await fetch('/api/inv/variance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, year, month }),
    })
    setNotifying(false)
    const d = await res.json().catch(() => ({}))
    alert(res.ok ? (d.notified ? `已通知人事（${d.over_count} 項超標）` : '目前無超標項目') : d.error ?? '通知失敗')
  }

  const saveThreshold = async (v: number) => {
    setThreshold(v)
    await fetch('/api/inv/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variance_threshold: v }),
    })
    loadVariance()
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Scale className="h-5 w-5 text-purple-600" />
            配方理論用量 vs 門市實際消耗檢驗
          </h3>
          <p className="text-xs text-muted-foreground">
            串接門市 POS 售出數與進銷存出庫數，實時計算原料耗損誤差，判定使用量是否正常。
          </p>
        </div>

        {/* 門市／年月 選擇 */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            list="rd-store-list"
            value={store}
            onChange={e => setStore(e.target.value)}
            placeholder="門市 (如 YL)"
            className="w-32 h-8 text-xs"
          />
          <datalist id="rd-store-list">
            {stores.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {[now.getFullYear(), now.getFullYear() - 1].map(y => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>

          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 控制與狀態條 */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">誤差警示門檻</span>
          <Input
            type="number"
            value={String(threshold)}
            onChange={e => setThreshold(Number(e.target.value) || 0)}
            onBlur={e => saveThreshold(Number(e.target.value) || 0)}
            className="w-16 h-8 text-xs"
          />
          <span className="text-muted-foreground">%</span>
        </label>

        {rows.length > 0 && (
          overCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1 rounded-md border border-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> 使用量正常 (耗損未超標)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 px-3 py-1 rounded-md border border-rose-300">
              <AlertCircle className="h-3.5 w-3.5" /> 使用量異常 (共 {overCount} 項原料超標)
            </span>
          )
        )}

        {totalLoss > 0 && (
          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            估計金額損失: <b className="text-sm font-bold">{fmt(totalLoss)}</b> 元
          </span>
        )}

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs ml-auto"
          disabled={notifying || overCount === 0}
          onClick={notify}
        >
          {notifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          通知人事處理
        </Button>
      </div>

      {/* 未對照提醒 */}
      {unmapped.length > 0 && (
        <div className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 rounded-lg px-3 py-2">
          Notice: 含有 {unmapped.length} 個 POS 成品尚未對照研發配方（未計入理論用量）。
        </div>
      )}

      {/* 數據列表 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-purple-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm space-y-1">
          <p>此門市該月份無計算資料</p>
          <p className="text-xs text-gray-400">請確定該門市與月份已匯入 POS 售出與進銷存檔案。</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b bg-muted/40">
                <th className="py-2.5 px-3">原料名稱</th>
                <th className="px-3">單位</th>
                <th className="px-3 text-center">使用檢驗</th>
                <th className="px-3 text-right">理論用量 (售出×配方)</th>
                <th className="px-3 text-right">實際出庫</th>
                <th className="px-3 text-right">差額</th>
                <th className="px-3 text-right">誤差 %</th>
                <th className="px-3 text-right">金額損失</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.material_code}
                  className={`border-b last:border-0 hover:bg-muted/20 ${
                    r.over ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''
                  }`}
                >
                  <td className="py-2 px-3 font-medium">{r.material_name}</td>
                  <td className="px-3 text-muted-foreground text-xs">{r.unit}</td>
                  <td className="px-3 text-center">
                    {r.over ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-200">
                        異常超標
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200">
                        正常
                      </span>
                    )}
                  </td>
                  <td className="px-3 text-right tabular-nums">{fmt1(r.theoretical)}</td>
                  <td className="px-3 text-right tabular-nums">{fmt1(r.actual)}</td>
                  <td
                    className={`px-3 text-right tabular-nums ${
                      r.diff > 0 ? 'text-rose-600 font-medium' : 'text-emerald-600'
                    }`}
                  >
                    {fmt1(r.diff)}
                  </td>
                  <td
                    className={`px-3 text-right tabular-nums font-semibold ${
                      r.over ? 'text-rose-600' : 'text-foreground'
                    }`}
                  >
                    {r.pct === null ? '—' : `${fmt1(r.pct)}%`}
                  </td>
                  <td
                    className={`px-3 text-right tabular-nums ${
                      r.money_loss > 0 ? 'text-rose-600 font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {r.price > 0 ? `${fmt(r.money_loss)} 元` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
