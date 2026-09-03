'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { PosCategory, PosItem } from '@/lib/pos/types'
import type { PosTranslations } from '@/lib/pos/i18n'
import { DEFAULT_MODIFIER_GROUPS } from '@/lib/pos/types'
import { Loader2, Sparkles, Upload, FileSpreadsheet, UtensilsCrossed } from 'lucide-react'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const POS_MENU_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: '商品名稱', required: true, example: '珍珠奶茶', aliases: ['name', '品名', '商品名稱', '品項'] },
  { key: 'category', label: '商品分類', required: true, example: '經典茶飲', aliases: ['category', '分類', '類別', 'category_name'] },
  { key: 'price', label: '售價(元)', required: true, example: 60, aliases: ['price', '價格', '售價', '單價'] },
  { key: 'description', label: '商品描述', example: '濃郁奶香搭配現煮波霸珍珠', aliases: ['description', '描述', '商品描述', '說明'] },
  { key: 'barcode', label: '條碼', example: '4710001', aliases: ['barcode', '條碼'] },
]

interface Store { id: string; name: string; slug: string }

const LOCALES = [
  { code: 'zh-TW', label: '繁中' },
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
] as const

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(0)}`
}

export default function PosMenuPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [categories, setCategories] = useState<PosCategory[]>([])
  const [items, setItems] = useState<PosItem[]>([])
  const [revision, setRevision] = useState(1)
  const [showImport, setShowImport] = useState(false)
  const [catName, setCatName] = useState('')
  const [catScope, setCatScope] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCat, setItemCat] = useState('')
  const [itemScope, setItemScope] = useState('')
  const [itemImage, setItemImage] = useState('')
  const [newUploading, setNewUploading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTranslations, setEditTranslations] = useState<PosTranslations>({})
  const [editDesc, setEditDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const [translating, setTranslating] = useState(false)

  const load = useCallback(async () => {
    const q = storeFilter !== 'all' ? `?store_id=${storeFilter}` : ''
    const res = await fetch(`/api/pos/menu${q}`)
    const d = await res.json()
    setStores(d.stores ?? [])
    setCategories(d.categories ?? [])
    setItems(d.items ?? [])
    setRevision(d.revision ?? 1)
  }, [storeFilter])

  useEffect(() => { load() }, [load])

  const scopeLabel = (storeId: string | null) => {
    if (!storeId) return '全域'
    return stores.find(s => s.id === storeId)?.name ?? '門市'
  }

  async function addCategory() {
    if (!catName.trim()) return
    await fetch('/api/pos/menu/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: catName, store_id: catScope || null }),
    })
    setCatName('')
    load()
  }

  async function addItem() {
    if (!itemName.trim() || !itemCat) return
    await fetch('/api/pos/menu/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: itemCat,
        name: itemName,
        description: itemDesc,
        price_cents: Math.round(Number(itemPrice || 0) * 100),
        store_id: itemScope || null,
        image_url: itemImage || null,
        modifiers: DEFAULT_MODIFIER_GROUPS,
      }),
    })
    setItemName('')
    setItemDesc('')
    setItemPrice('')
    setItemImage('')
    load()
  }

  async function uploadToStorage(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/pos/menu/upload', { method: 'POST', body: fd })
    const d = await res.json()
    return d.url ?? null
  }

  async function uploadNewImage(file: File) {
    setNewUploading(true)
    try {
      const url = await uploadToStorage(file)
      if (url) setItemImage(url)
    } finally {
      setNewUploading(false)
    }
  }

  async function uploadImage(itemId: string, file: File) {
    setUploading(true)
    try {
      const url = await uploadToStorage(file)
      if (url) {
        await fetch('/api/pos/menu/items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: itemId, image_url: url }),
        })
        load()
      }
    } finally {
      setUploading(false)
    }
  }

  function startEdit(item: PosItem) {
    setEditId(item.id)
    setEditTranslations((item.translations as PosTranslations) ?? {})
    setEditDesc(item.description ?? '')
  }

  async function autoTranslate() {
    const item = items.find(i => i.id === editId)
    if (!item) return
    setTranslating(true)
    try {
      const res = await fetch('/api/pos/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, description: editDesc || item.description }),
      })
      const d = await res.json()
      if (d.translations) setEditTranslations(d.translations)
    } finally {
      setTranslating(false)
    }
  }

  async function saveEdit() {
    if (!editId) return
    await fetch('/api/pos/menu/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId,
        description: editDesc,
        translations: editTranslations,
      }),
    })
    setEditId(null)
    load()
  }

  async function toggleItem(id: string, is_active: boolean) {
    await fetch('/api/pos/menu/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    })
    load()
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><UtensilsCrossed className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">菜單編輯</h1>
            <p className="text-sm text-muted-foreground">上傳圖片、多語系名稱與描述，Kiosk 依語言顯示</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">版本 {revision}</Badge>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />批次匯入菜單 (Excel/CSV)
          </Button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入 / 更新 POS 菜單"
          description="支援 .xlsx, .xls 與 .csv 檔案。若分類不存在將自動建立，若品項名稱相符將自動更新，否則新增。"
          columns={POS_MENU_IMPORT_COLUMNS}
          templateFilename="POS菜單範本"
          sheetName="菜單品項"
          onClose={() => setShowImport(false)}
          onSuccess={load}
          onSubmit={async rows => {
            const res = await fetch('/api/pos/menu/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={storeFilter === 'all' ? 'default' : 'outline'} onClick={() => setStoreFilter('all')}>全部</Button>
        {stores.map(s => (
          <Button key={s.id} size="sm" variant={storeFilter === s.id ? 'default' : 'outline'} onClick={() => setStoreFilter(s.id)}>{s.name}</Button>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <p className="font-medium">新增分類</p>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" value={catName} onChange={e => setCatName(e.target.value)} placeholder="分類名稱" />
          <select className="h-9 rounded-md border px-2 text-sm" value={catScope} onChange={e => setCatScope(e.target.value)}>
            <option value="">全域</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name} 專屬</option>)}
          </select>
          <Button onClick={addCategory} disabled={!catName.trim()}>新增</Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <p className="font-medium">新增品項</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="h-9 rounded-md border px-2 text-sm" value={itemCat} onChange={e => setItemCat(e.target.value)}>
            <option value="">選擇分類</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({scopeLabel(c.store_id)})</option>
            ))}
          </select>
          <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="品名（主語言）" />
          <Input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="價格（元）" />
          <select className="h-9 rounded-md border px-2 text-sm" value={itemScope} onChange={e => setItemScope(e.target.value)}>
            <option value="">全域</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Textarea className="sm:col-span-2" value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="描述（選填）" rows={2} />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
            {itemImage ? (
              <Image src={itemImage} alt="預覽" fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Upload className="h-5 w-5" />
              </div>
            )}
          </div>
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadNewImage(f) }}
            />
            <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent">
              {newUploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              {itemImage ? '更換圖片' : '上傳圖片（選填）'}
            </span>
          </label>
          {itemImage && (
            <Button size="sm" variant="ghost" onClick={() => setItemImage('')}>移除</Button>
          )}
        </div>
        <Button onClick={addItem} disabled={!itemName.trim() || !itemCat || newUploading}>新增品項</Button>
      </Card>

      <div className="space-y-4">
        {categories.map(cat => (
          <Card key={cat.id} className="overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3">
              <h2 className="font-semibold">{cat.name}</h2>
              <Badge variant="outline" className="mt-1">{scopeLabel(cat.store_id)}</Badge>
            </div>
            <div className="divide-y">
              {items.filter(i => i.category_id === cat.id).map(item => (
                <div key={item.id} className={`p-4 ${!item.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {item.image_url ? (
                        <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl font-bold text-muted-foreground">{item.name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                      <p className="mt-1 text-orange-600 font-medium">{fmt(item.price_cents)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(item.id, f) }} />
                          <span className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
                            <Upload className="mr-1 h-3 w-3" />圖片
                          </span>
                        </label>
                        <Button size="sm" variant="outline" onClick={() => startEdit(item)}>多語系</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleItem(item.id, !item.is_active)}>
                          {item.is_active ? '停用' : '啟用'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {editId === item.id && (
                    <div className="mt-4 space-y-3 rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">多語系內容</p>
                        <Button size="sm" variant="secondary" onClick={autoTranslate} disabled={translating}>
                          {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                          AI 翻譯
                        </Button>
                      </div>
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="主描述（繁中）" rows={2} />
                      {LOCALES.map(loc => (
                        <div key={loc.code} className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder={`${loc.label} 名稱`}
                            value={editTranslations[loc.code]?.name ?? ''}
                            onChange={e => setEditTranslations(prev => ({
                              ...prev,
                              [loc.code]: { ...prev[loc.code], name: e.target.value },
                            }))}
                          />
                          <Input
                            placeholder={`${loc.label} 描述`}
                            value={editTranslations[loc.code]?.description ?? ''}
                            onChange={e => setEditTranslations(prev => ({
                              ...prev,
                              [loc.code]: { ...prev[loc.code], description: e.target.value },
                            }))}
                          />
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>儲存</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>取消</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
