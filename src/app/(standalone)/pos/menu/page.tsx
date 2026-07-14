'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { PosCategory, PosItem } from '@/lib/pos/types'
import { DEFAULT_MODIFIER_GROUPS } from '@/lib/pos/types'

interface Store { id: string; name: string; slug: string }

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(0)}`
}

export default function PosMenuPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [categories, setCategories] = useState<PosCategory[]>([])
  const [items, setItems] = useState<PosItem[]>([])
  const [revision, setRevision] = useState(1)
  const [catName, setCatName] = useState('')
  const [catScope, setCatScope] = useState<string>('')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCat, setItemCat] = useState('')
  const [itemScope, setItemScope] = useState('')

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
        price_cents: Math.round(Number(itemPrice || 0) * 100),
        store_id: itemScope || null,
        modifiers: DEFAULT_MODIFIER_GROUPS,
      }),
    })
    setItemName('')
    setItemPrice('')
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
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">菜單編輯</h1>
        <Badge variant="secondary">版本 {revision}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        全域品項同步至所有門市；指定門市的品項僅該店可見。每次儲存會 bump 版本，終端自動拉取。
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={storeFilter === 'all' ? 'default' : 'outline'} onClick={() => setStoreFilter('all')}>全部</Button>
        {stores.map(s => (
          <Button key={s.id} size="sm" variant={storeFilter === s.id ? 'default' : 'outline'} onClick={() => setStoreFilter(s.id)}>
            {s.name}
          </Button>
        ))}
      </div>

      <Card className="space-y-2 p-4">
        <p className="text-sm font-medium">新增分類</p>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" value={catName} onChange={e => setCatName(e.target.value)} placeholder="分類名稱" />
          <select className="h-9 rounded-md border px-2 text-sm" value={catScope} onChange={e => setCatScope(e.target.value)}>
            <option value="">全域（所有門市）</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name} 專屬</option>)}
          </select>
          <Button onClick={addCategory} disabled={!catName.trim()}>新增</Button>
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <p className="text-sm font-medium">新增品項</p>
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border px-2 text-sm" value={itemCat} onChange={e => setItemCat(e.target.value)}>
            <option value="">選擇分類</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({scopeLabel(c.store_id)})</option>
            ))}
          </select>
          <Input className="max-w-[8rem]" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="品名" />
          <Input className="max-w-[5rem]" type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="元" />
          <select className="h-9 rounded-md border px-2 text-sm" value={itemScope} onChange={e => setItemScope(e.target.value)}>
            <option value="">全域</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button onClick={addItem} disabled={!itemName.trim() || !itemCat}>新增</Button>
        </div>
        <p className="text-xs text-muted-foreground">新品項預設含甜度、冰塊、加料選項，可於後續版本細部編輯。</p>
      </Card>

      <div className="space-y-4">
        {categories.map(cat => (
          <Card key={cat.id} className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-semibold">{cat.name}</h2>
              <Badge variant="outline">{scopeLabel(cat.store_id)}</Badge>
            </div>
            <div className="space-y-1">
              {items.filter(i => i.category_id === cat.id).map(item => (
                <div key={item.id} className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${!item.is_active ? 'opacity-50' : ''}`}>
                  <span>{item.name} · {fmt(item.price_cents)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{scopeLabel(item.store_id)}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => toggleItem(item.id, !item.is_active)}>
                      {item.is_active ? '停用' : '啟用'}
                    </Button>
                  </div>
                </div>
              ))}
              {items.filter(i => i.category_id === cat.id).length === 0 && (
                <p className="text-xs text-muted-foreground">尚無品項</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
