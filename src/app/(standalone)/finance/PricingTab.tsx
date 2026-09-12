'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import {
  Package, Plus, Search, Upload, Download, Trash2, Edit3,
  CheckCircle2, AlertCircle, Loader2, DollarSign,
  Info, X, Save, RefreshCw, Layers, Wrench, Coffee, ShoppingBag
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

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

const CATEGORIES = [
  { id: 'all', label: '全部品項', icon: Layers, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  { id: '原料', label: '原物料', icon: Coffee, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { id: '設備', label: '機器設備', icon: Wrench, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
  { id: '耗材', label: '杯袋耗材', icon: ShoppingBag, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: '道具', label: '吧台道具', icon: Package, color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
]

export default function PricingTab() {
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
      setMsg({ text: '載入物料定價資料失敗', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

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
        setMsg({ text: `成功匯入 ${d.imported} 筆標準定價！研發配方門市成本已同步更新。`, type: 'success' })
        loadData()
      } else {
        setMsg({ text: d.error ?? '匯入失敗', type: 'error' })
      }
    } catch (err) {
      setMsg({ text: `匯入發生錯誤：${err instanceof Error ? err.message : err}`, type: 'error' })
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
      alert('請輸入品項代碼')
      return
    }
    if (!editingItem.material_name.trim()) {
      alert('請輸入品項名稱')
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
        setMsg({ text: '品項定價儲存成功！研發配方門市成本已自動連動。', type: 'success' })
        loadData()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || '儲存失敗')
      }
    } catch {
      alert('儲存失敗，請檢查網路連線')
    } finally {
      setSaving(false)
    }
  }

  // 刪除品項
  const handleDeleteItem = async (item: MaterialPriceItem) => {
    if (!confirm(`確定要刪除「${item.material_name} (${item.material_code})」的定價資料嗎？`)) return
    try {
      const res = await fetch('/api/fin/material-prices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, material_code: item.material_code }),
      })
      if (res.ok) {
        setMsg({ text: `已刪除「${item.material_name}」定價`, type: 'success' })
        loadData()
      } else {
        alert('刪除失敗')
      }
    } catch {
      alert('刪除失敗，請檢查網路連線')
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
            物料三層定價管理規範（原料／設備／耗材／道具）：
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li>
              <b>工廠進貨價 (Đơn giá nhập)</b>：總部/工廠向供應商採購此原料、設備或耗材之進貨單價。
            </li>
            <li>
              <span className="font-bold text-purple-700 dark:text-purple-300">
                賣給直營門市價格 (Đơn giá xuất CH)
              </span>
              ：<b>研發部門【配方】計算每杯飲品門市成本之直接數據源！</b>
              出納在此處更新門市售價，研發配方與門市點單成本即時自動同步重算。
            </li>
            <li>
              <b>賣給非直營門市 (經銷商/加盟店) 價格 (Đơn giá xuất Đại lý)</b>：經銷通路與加盟門市之出貨批發定價。
            </li>
            <li>
              出納同仁可隨時進行<b>單筆價格微調</b>，亦可點擊右上方<b>「匯入標準定價表 (.xlsx)」</b>整批更新全公司物料價目表。
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
            <p className="text-[11px] text-muted-foreground font-medium">原料品項</p>
            <p className="text-lg font-bold">{counts.raw} <span className="text-xs font-normal text-muted-foreground">項</span></p>
          </div>
        </Card>

        <Card className="p-3.5 flex items-center gap-3 border bg-card/60">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">設備機器</p>
            <p className="text-lg font-bold">{counts.equipment} <span className="text-xs font-normal text-muted-foreground">項</span></p>
          </div>
        </Card>

        <Card className="p-3.5 flex items-center gap-3 border bg-card/60">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-xl">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">杯袋耗材</p>
            <p className="text-lg font-bold">{counts.consumable} <span className="text-xs font-normal text-muted-foreground">項</span></p>
          </div>
        </Card>

        <Card className="p-3.5 flex items-center gap-3 border bg-card/60">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">全部建檔品項</p>
            <p className="text-lg font-bold">{counts.all} <span className="text-xs font-normal text-muted-foreground">項</span></p>
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
            新增品項
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5 text-xs h-8"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            匯入標準定價表 (.xlsx)
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={loadData}
            disabled={loading}
            className="h-8 w-8 p-0"
            title="重新整理"
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
            placeholder="搜尋品項代碼 (如 TEA-01)、品項名稱 (如 錫蘭紅茶)..."
            className="pl-9 h-9 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 font-mono">
          符合 {filtered.length} 筆
        </span>
      </div>

      {/* 定價清單表格 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <p className="text-xs">正在載入物料三層定價庫...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-3 border rounded-xl bg-card/40">
          <Package className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">尚無「{categoryFilter === 'all' ? '物料' : categoryFilter}」定價資料</p>
            <p className="text-xs text-gray-400">
              點擊上方「新增品項」手動新增，或點擊「匯入標準定價表 (.xlsx)」整批上傳中央廚房進價／門市價表。
            </p>
          </div>
          <Button size="sm" onClick={handleOpenAdd} className="gap-1.5 text-xs bg-emerald-600 text-white">
            <Plus className="h-3.5 w-3.5" />立即新增第一筆品項
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground text-left">
                <th className="py-2.5 px-3 font-semibold">品類</th>
                <th className="px-3 font-semibold">品項代碼</th>
                <th className="px-3 font-semibold">品項名稱</th>
                <th className="px-3 font-semibold text-center">單位</th>
                <th className="px-3 text-right font-semibold">工廠進貨價 (ĐGN)</th>
                <th className="px-3 text-right font-semibold text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/20">
                  賣給門市價格 (ĐGX CH)
                  <span className="block text-[10px] font-normal text-purple-600/80">📌 配方表成本依據</span>
                </th>
                <th className="px-3 text-right font-semibold">賣給經銷商 (ĐGX Đại lý)</th>
                <th className="px-3 text-right font-semibold">出貨毛利 (門市價 - 進價)</th>
                <th className="py-2.5 px-3 text-center font-semibold">操作</th>
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
                      {fmt(it.purchase_price)} ₫
                    </td>
                    <td className="px-3 text-right font-mono tabular-nums font-bold text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-950/10">
                      {fmt(it.export_price)} ₫
                    </td>
                    <td className="px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {fmt(it.dealer_price)} ₫
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      <span className={`font-medium ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {margin >= 0 ? '+' : ''}{fmt(margin)} ₫
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
                          title="編輯定價"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(it)}
                          className="p-1 rounded hover:bg-muted text-gray-400 hover:text-rose-600 transition-colors"
                          title="刪除品項"
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
                  {editingItem.id ? '編輯物料定價' : '新增物料定價品項'}
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
                  <span className="font-semibold text-gray-700 dark:text-gray-300">品類分類 *</span>
                  <select
                    value={editingItem.category}
                    onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="原料">原物料 (原料)</option>
                    <option value="設備">機器設備 (設備)</option>
                    <option value="耗材">杯袋包材 (耗材)</option>
                    <option value="道具">吧台器具 (道具)</option>
                  </select>
                </label>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">單位 *</span>
                  <input
                    type="text"
                    value={editingItem.unit}
                    onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                    placeholder="如: kg, g, 台, 個, 箱, 包"
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">品項代碼 *</span>
                  <input
                    type="text"
                    value={editingItem.material_code}
                    onChange={e => setEditingItem({ ...editingItem, material_code: e.target.value })}
                    placeholder="如: TEA-001"
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">品項名稱 *</span>
                  <input
                    type="text"
                    value={editingItem.material_name}
                    onChange={e => setEditingItem({ ...editingItem, material_name: e.target.value })}
                    placeholder="如: 特選阿薩姆紅茶"
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
              </div>

              <div className="border-t pt-3 space-y-3">
                <p className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  三層價格設定 (VND / ₫)
                </p>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    1. 工廠進貨價 (Đơn giá nhập)
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
                  <span className="text-[10px] text-gray-400">總部或工廠向原物料供應商進貨的採購成本。</span>
                </label>

                <label className="space-y-1 block p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/70">
                  <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center justify-between">
                    <span>2. 賣給門市價格 (Đơn giá xuất CH) *</span>
                    <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-300 font-semibold">
                      📌 配方表門市成本來源
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
                    研發部門【配方】計算飲品每杯門市成本之直接單價，修改後將即時連動所有配方！
                  </span>
                </label>

                <label className="space-y-1 block">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    3. 賣給非直營門市 / 經銷商價格 (Đơn giá xuất Đại lý)
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
                  <span className="text-[10px] text-gray-400">批發經銷商或加盟門市之物料出貨價。</span>
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
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSaveItem}
                disabled={saving}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                確認儲存定價
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
