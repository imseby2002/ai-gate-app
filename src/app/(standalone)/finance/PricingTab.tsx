'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Package, Plus, Search, Upload, Download, Trash2, Edit3,
  CheckCircle2, AlertCircle, Loader2, DollarSign,
  Info, X, Save, RefreshCw, Layers, Wrench, Coffee, ShoppingBag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const fmt = (n: number, locale: string) => Math.round(Number(n) || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

export interface MaterialPriceItem {
  id?: string
  material_code: string
  material_name: string
  unit: string
  category: string
  purchase_price: number // 工廠進貨價 (Factory Cost)
  export_price: number   // 賣給直營門市價格 (Store Cost - 配方表以此為基準)
  dealer_price: number   // 賣給經銷商或非直營門市價格 (Dealer Cost)
  updated_at?: string
}

const getCategories = (t: (key: string) => string) => [
  { id: 'all', label: t('catAll'), icon: Layers, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  { id: '原料', label: t('catRaw'), icon: Coffee, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { id: '設備', label: t('catEquipment'), icon: Wrench, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
  { id: '耗材', label: t('catConsumable'), icon: ShoppingBag, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: '道具', label: t('catTool'), icon: Package, color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
]

export default function PricingTab() {
  const t = useTranslations('FinancePage')
  const locale = useLocale()
  const CATEGORIES = getCategories(t)
  const [items, setItems] = useState<MaterialPriceItem[]>([])
  const [counts, setCounts] = useState({ all: 0, raw: 0, equipment: 0, consumable: 0, tool: 0 })
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [uploading, setUploading] = useState(false)

  // 編輯 / 新增 Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MaterialPriceItem | null>(null)
  const [saving, setSaving] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fin/material-prices')
      if (res.ok) {
        const d = await res.json()
        setItems(d.items ?? [])
        setCounts(d.counts ?? { all: 0, raw: 0, equipment: 0, consumable: 0, tool: 0 })
      }
    } catch {
      setMsg({ text: t('loadPricingFailed'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 上傳 Excel 標準價表
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
        setMsg({ text: t('importPricesSuccess', { n: d.imported }), type: 'success' })
        loadData()
      } else {
        setMsg({ text: d.error ?? t('importFailed'), type: 'error' })
      }
    } catch (err) {
      setMsg({ text: t('importErrorWith', { msg: err instanceof Error ? err.message : String(err) }), type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  // 開啟新增 Modal
  const handleOpenAdd = () => {
    setEditingItem({
      material_code: '',
      material_name: '',
      unit: 'kg',
      category: categoryFilter === 'all' ? '原料' : categoryFilter,
      purchase_price: 0,
      export_price: 0,
      dealer_price: 0,
    })
    setModalOpen(true)
  }

  // 開啟編輯 Modal
  const handleOpenEdit = (item: MaterialPriceItem) => {
    setEditingItem({ ...item })
    setModalOpen(true)
  }

  // 儲存品項 (新增或編輯)
  const handleSaveItem = async () => {
    if (!editingItem) return
    if (!editingItem.material_code.trim()) {
      alert(t('enterItemCode'))
      return
    }
    if (!editingItem.material_name.trim()) {
      alert(t('enterItemName'))
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/fin/material-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      })
      if (res.ok) {
        setModalOpen(false)
        setEditingItem(null)
        setMsg({ text: t('itemPriceSaved'), type: 'success' })
        loadData()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || t('saveFailed'))
      }
    } catch {
      alert(t('saveFailedCheckNetwork'))
    } finally {
      setSaving(false)
    }
  }

  // 刪除品項
  const handleDeleteItem = async (item: MaterialPriceItem) => {
    if (!confirm(t('confirmDeleteItem', { name: item.material_name, code: item.material_code }))) return
    try {
      const res = await fetch('/api/fin/material-prices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, material_code: item.material_code }),
      })
      if (res.ok) {
        setMsg({ text: t('itemDeleted', { name: item.material_name }), type: 'success' })
        loadData()
      } else {
        alert(t('deleteFailed'))
      }
    } catch {
      alert(t('deleteFailedCheckNetwork'))
    }
  }

  // 篩選
  const filtered = items.filter(it => {
    const matchCat = categoryFilter === 'all' || (it.category || '原料') === categoryFilter
    if (!matchCat) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return (
      it.material_code.toLowerCase().includes(s) ||
      it.material_name.toLowerCase().includes(s) ||
      (it.unit && it.unit.toLowerCase().includes(s))
    )
  })

  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={handleUploadPrice} />

      {/* 訊息提示 */}
      {msg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 核心說明 Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-indigo-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
        <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1.5 leading-relaxed text-gray-800 dark:text-gray-200">
          <p className="font-bold text-sm text-emerald-900 dark:text-emerald-300">
            {t('bannerTitle')}
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li>
              {t.rich('bannerPurchasePrice', { b: (chunks) => <b>{chunks}</b> })}
            </li>
            <li>
              <span className="font-bold text-purple-700 dark:text-purple-300">
                {t('bannerExportPriceLabel')}
              </span>
              {t.rich('bannerExportPriceDesc', { b: (chunks) => <b>{chunks}</b> })}
            </li>
            <li>
              {t.rich('bannerDealerPrice', { b: (chunks) => <b>{chunks}</b> })}
            </li>
            <li>
              {t.rich('bannerAdjustHint', { b: (chunks) => <b>{chunks}</b> })}
            </li>
          </ul>
        </div>
      </div>

      {/* 統計概覽與操作工具列 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-3.5 flex items-center gap-3 border bg-card/60">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
            <Coffee className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{t('statRawItems')}</p>
            <p className="text-lg font-bold">{counts.raw} <span className="text-xs font-normal text-muted-foreground">{t('itemUnit')}</span></p>
          </div>
        </Card>

        <Card className="p-3.5 flex items-center gap-3 border bg-card/60">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{t('statEquipment')}</p>
            <p className="text-lg font-bold">{counts.equipment} <span className="text-xs font-normal text-muted-foreground">{t('itemUnit')}</span></p>
          </div>
        </Card>

        <Card className="p-3.5 flex items-center gap-3 border bg-card/60">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-xl">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{t('statConsumable')}</p>
            <p className="text-lg font-bold">{counts.consumable} <span className="text-xs font-normal text-muted-foreground">{t('itemUnit')}</span></p>
          </div>
        </Card>

        <Card className="p-3.5 flex items-center gap-3 border bg-card/60">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">{t('statAllItems')}</p>
            <p className="text-lg font-bold">{counts.all} <span className="text-xs font-normal text-muted-foreground">{t('itemUnit')}</span></p>
          </div>
        </Card>
      </div>

      {/* 控制列：分類切換、搜尋與按鈕 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* 品類篩選 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map(c => {
            const Icon = c.icon
            const active = categoryFilter === c.id
            const count =
              c.id === 'all' ? counts.all :
              c.id === '原料' ? counts.raw :
              c.id === '設備' ? counts.equipment :
              c.id === '耗材' ? counts.consumable :
              c.id === '道具' ? counts.tool : 0
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.label} ({count})
              </button>
            )
          })}
        </div>

        {/* 右側按鈕群 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addItem')}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5 text-xs h-8"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t('importStandardPriceTable')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={loadData}
            disabled={loading}
            className="h-8 w-8 p-0"
            title={t('refresh')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 搜尋框 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 font-mono">
          {t('matchCount', { n: filtered.length })}
        </span>
      </div>

      {/* 定價清單表格 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <p className="text-xs">{t('loadingPricingDb')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-3 border rounded-xl bg-card/40">
          <Package className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">{t('noPricingDataFor', { cat: categoryFilter === 'all' ? t('materialWord') : categoryFilter })}</p>
            <p className="text-xs text-gray-400">
              {t('emptyStateHint')}
            </p>
          </div>
          <Button size="sm" onClick={handleOpenAdd} className="gap-1.5 text-xs bg-emerald-600 text-white">
            <Plus className="h-3.5 w-3.5" />{t('addFirstItem')}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground text-left">
                <th className="py-2.5 px-3 font-semibold">{t('colCategory')}</th>
                <th className="px-3 font-semibold">{t('colItemCode')}</th>
                <th className="px-3 font-semibold">{t('colItemName')}</th>
                <th className="px-3 font-semibold text-center">{t('colUnit')}</th>
                <th className="px-3 text-right font-semibold">{t('colPurchasePrice')}</th>
                <th className="px-3 text-right font-semibold text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/20">
                  {t('colExportPrice')}
                  <span className="block text-[10px] font-normal text-purple-600/80">{t('colExportPriceHint')}</span>
                </th>
                <th className="px-3 text-right font-semibold">{t('colDealerPrice')}</th>
                <th className="px-3 text-right font-semibold">{t('colMargin')}</th>
                <th className="py-2.5 px-3 text-center font-semibold">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(it => {
                const margin = it.export_price - it.purchase_price
                const marginPct = it.export_price > 0 ? (margin / it.export_price) * 100 : 0
                return (
                  <tr key={it.material_code} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        it.category === '原料' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        it.category === '設備' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        it.category === '耗材' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {it.category || '原料'}
                      </span>
                    </td>
                    <td className="px-3 font-mono font-medium text-foreground">{it.material_code}</td>
                    <td className="px-3 font-semibold text-gray-900 dark:text-gray-100">{it.material_name}</td>
                    <td className="px-3 text-center text-muted-foreground">{it.unit || '—'}</td>
                    <td className="px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {fmt(it.purchase_price, locale)} ₫
                    </td>
                    <td className="px-3 text-right font-mono tabular-nums font-bold text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-950/10">
                      {fmt(it.export_price, locale)} ₫
                    </td>
                    <td className="px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {fmt(it.dealer_price, locale)} ₫
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      <span className={`font-medium ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {margin >= 0 ? '+' : ''}{fmt(margin, locale)} ₫
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {marginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(it)}
                          className="p-1 rounded hover:bg-muted text-gray-500 hover:text-emerald-600 transition-colors"
                          title={t('editPricing')}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it)}
                          className="p-1 rounded hover:bg-muted text-gray-400 hover:text-rose-600 transition-colors"
                          title={t('deleteItem')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增 / 編輯品項 Modal */}
      {modalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base">
                  {editingItem.id ? t('editMaterialPricing') : t('addMaterialPricingItem')}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{t('categoryRequiredLabel')}</span>
                  <select
                    value={editingItem.category}
                    onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="原料">{t('optRaw')}</option>
                    <option value="設備">{t('optEquipment')}</option>
                    <option value="耗材">{t('optConsumable')}</option>
                    <option value="道具">{t('optTool')}</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{t('unitRequiredLabel')}</span>
                  <input
                    type="text"
                    value={editingItem.unit}
                    onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                    placeholder={t('unitPlaceholder')}
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{t('itemCodeRequiredLabel')}</span>
                  <input
                    type="text"
                    value={editingItem.material_code}
                    onChange={e => setEditingItem({ ...editingItem, material_code: e.target.value })}
                    placeholder={t('itemCodePlaceholder')}
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{t('itemNameRequiredLabel')}</span>
                  <input
                    type="text"
                    value={editingItem.material_name}
                    onChange={e => setEditingItem({ ...editingItem, material_name: e.target.value })}
                    placeholder={t('itemNamePlaceholder')}
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
              </div>

              <div className="border-t pt-3 space-y-3">
                <p className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  {t('threeTierPricingTitle')}
                </p>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {t('purchasePriceModalLabel')}
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      value={editingItem.purchase_price || ''}
                      onChange={e => setEditingItem({ ...editingItem, purchase_price: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-gray-400">₫</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{t('purchasePriceHint')}</span>
                </label>

                <label className="space-y-1 block p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/70">
                  <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center justify-between">
                    <span>{t('exportPriceModalLabel')}</span>
                    <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-300 font-semibold">
                      {t('exportPriceBadge')}
                    </Badge>
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      value={editingItem.export_price || ''}
                      onChange={e => setEditingItem({ ...editingItem, export_price: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full h-9 rounded-md border border-purple-300 bg-background px-3 text-xs font-mono font-bold text-purple-700 dark:text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-purple-500">₫</span>
                  </div>
                  <span className="text-[10px] text-purple-800 dark:text-purple-300 font-medium">
                    {t('exportPriceHint')}
                  </span>
                </label>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {t('dealerPriceModalLabel')}
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      value={editingItem.dealer_price || ''}
                      onChange={e => setEditingItem({ ...editingItem, dealer_price: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-gray-400">₫</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{t('dealerPriceHint')}</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="text-xs"
              >
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveItem}
                disabled={saving}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t('confirmSavePricing')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
