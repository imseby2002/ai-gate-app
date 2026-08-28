'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  FlaskConical, Upload, Loader2, AlertCircle, Building2, Store,
  Plus, Trash2, Edit3, Search, FileSpreadsheet, X, CheckCircle2,
  Package, BookOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const fmt1 = (n: number) => (Math.round(n * 100) / 100).toLocaleString('zh-TW')

interface Material {
  code: string
  name: string
  unit: string
}

interface RecipeItem {
  id?: string
  material_code: string
  material_name: string
  qty_per_cup: number
}

interface Recipe {
  id: string
  name: string
  note: string
  created_at: string
  items: RecipeItem[]
}

export default function RdPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<{ id?: string; name: string; note: string; items: RecipeItem[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)

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

  // 匯入原料標準價（中央維護，非每月、非門市）
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
      setMsg(res.ok ? { text: `標準價匯入 ${d.imported} 筆！`, type: 'success' } : { text: d.error ?? '匯入失敗', type: 'error' })
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
        setMsg({ text: editing.id ? '配方修改成功！' : '新配方建立成功！', type: 'success' })
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
    setEditing(e => (e ? { ...e, items: [...e.items, { material_code: '', material_name: '', qty_per_cup: 0 }] } : e))

  const setItem = (i: number, patch: Partial<RecipeItem>) =>
    setEditing(e => {
      if (!e) return e
      const items = [...e.items]
      items[i] = { ...items[i], ...patch }
      return { ...e, items }
    })

  const pickMaterial = (i: number, code: string) => {
    const m = materials.find(x => x.code === code)
    setItem(i, { material_code: code, material_name: m?.name ?? code })
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {/* 頂部標題與跨模組連結 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
            <FlaskConical className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">研發配方中心 (R&D)</h1>
            <p className="text-sm text-muted-foreground">配方設計、檔案匯入、原料用量標準維護</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/rd-recipes">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="h-4 w-4 text-purple-600" />配方成本
            </Button>
          </Link>
          <Link href="/rd-ai">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="h-4 w-4 text-indigo-600" />研發討論AI
            </Button>
          </Link>
          <Link href="/work">
            <Button variant="outline" size="sm">
              WORK 列表
            </Button>
          </Link>
          <Link href="/store-reports">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Store className="h-4 w-4" />
              門市報表
            </Button>
          </Link>
          <Link href="/hr">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              人事管理
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

      {/* 工具列：統計卡片 & 操作按鈕 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-xl">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">研發配方總數</p>
            <p className="text-2xl font-bold">{recipes.length} <span className="text-xs font-normal text-muted-foreground">組</span></p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">已引用原料品項</p>
            <p className="text-2xl font-bold">{materials.length} <span className="text-xs font-normal text-muted-foreground">項</span></p>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">快速操作</p>
            <p className="text-xs text-gray-500">配方與原料標準價由此中央維護（非每月、非門市）</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              )}
              匯入配方
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={uploading}
              onClick={() => priceRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-amber-600" />
              )}
              匯入標準價
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              onClick={() => setEditing({ name: '', note: '', items: [] })}
            >
              <Plus className="h-4 w-4" />
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
          {filteredRecipes.map(r => (
            <Card key={r.id} className="p-5 flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{r.name}</h3>
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
                      title="編輯配方"
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

                {/* 原料明細標籤與表格 */}
                <div className="pt-2 border-t space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> 每杯標準用量（{r.items.length} 種原料）：
                  </p>

                  {r.items.length === 0 ? (
                    <p className="text-xs text-amber-500 italic py-1">（未設定原料成分）</p>
                  ) : (
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
                更新時間：{new Date(r.created_at || Date.now()).toLocaleDateString('zh-TW')}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 編輯 / 新增配方 彈出 Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card text-card-foreground border rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" />
                <h3 className="font-bold text-lg">{editing.id ? '修改配方' : '新增研發配方'}</h3>
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
                <Textarea
                  value={editing.note}
                  onChange={e => setEditing({ ...editing, note: e.target.value })}
                  placeholder="可寫入研發心得、甜度冰量標準或說明..."
                  rows={2}
                />
              </label>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-purple-600" />
                    配方原料成分（每杯用量）
                  </span>
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
                    {editing.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 bg-accent/40 p-2 rounded-lg border">
                        {/* 選擇原料 */}
                        <div className="flex-1 min-w-0">
                          {materials.length > 0 ? (
                            <select
                              value={it.material_code}
                              onChange={e => pickMaterial(i, e.target.value)}
                              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">選擇原料...</option>
                              {materials.map(m => (
                                <option key={m.code} value={m.code}>
                                  {m.name || m.code} {m.unit ? `(${m.unit})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              value={it.material_name || it.material_code}
                              onChange={e =>
                                setItem(i, { material_code: e.target.value, material_name: e.target.value })
                              }
                              placeholder="輸入原料名稱或代碼"
                              className="h-9"
                            />
                          )}
                        </div>

                        {/* 每杯用量 */}
                        <div className="w-32 shrink-0">
                          <Input
                            type="number"
                            step="any"
                            value={it.qty_per_cup || ''}
                            onChange={e => setItem(i, { qty_per_cup: Number(e.target.value) || 0 })}
                            placeholder="每杯用量"
                            className="h-9"
                          />
                        </div>

                        {/* 刪除列 */}
                        <button
                          onClick={() =>
                            setEditing(e => (e ? { ...e, items: e.items.filter((_, x) => x !== i) } : e))
                          }
                          className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
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
                儲存配方
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
