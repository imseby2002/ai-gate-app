'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  calcLineTotal,
  calcCartTotal,
  POS_ORDER_TYPES,
  type PosCartLine,
  type PosCartModifier,
  type PosCategory,
  type PosItem,
  type PosModifierGroup,
  type PosOrderType,
} from '@/lib/pos/types'
import {
  flushOrderQueue,
  loadCachedMenu,
  loadQueue,
  pushOrder,
  queueOrder,
  syncMenu,
} from '@/lib/pos/offline'

const KEY_STORAGE = 'pos_device_key'

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(0)}`
}

function uuid() {
  return crypto.randomUUID()
}

function KioskInner() {
  const searchParams = useSearchParams()
  const [deviceKey, setDeviceKey] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [storeName, setStoreName] = useState('')
  const [categories, setCategories] = useState<PosCategory[]>([])
  const [items, setItems] = useState<PosItem[]>([])
  const [revision, setRevision] = useState(0)
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [activeCat, setActiveCat] = useState<string>('')
  const [cart, setCart] = useState<PosCartLine[]>([])
  const [orderType, setOrderType] = useState<PosOrderType>('dine_in')
  const [tableLabel, setTableLabel] = useState('')
  const [note, setNote] = useState('')
  const [pickItem, setPickItem] = useState<PosItem | null>(null)
  const [pickMods, setPickMods] = useState<Record<string, string[]>>({})
  const [qty, setQty] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)

  const applyMenu = useCallback((data: { categories: PosCategory[]; items: PosItem[]; revision: number; store_name?: string }) => {
    setCategories(data.categories)
    setItems(data.items as PosItem[])
    setRevision(data.revision)
    if (data.store_name) setStoreName(data.store_name)
    if (data.categories[0]) setActiveCat(c => c || data.categories[0].id)
  }, [])

  const pullMenu = useCallback(async (key: string) => {
    const cached = loadCachedMenu()
    const since = cached?.revision ?? 0
    try {
      const data = await syncMenu(key, since)
      setOnline(true)
      if (data.changed) {
        applyMenu(data)
      } else if (cached) {
        applyMenu({ ...cached, categories: cached.categories as PosCategory[], items: cached.items as PosItem[] })
      }
      await flushOrderQueue(key)
      setPending(loadQueue().length)
    } catch {
      setOnline(false)
      if (cached) {
        applyMenu({ ...cached, categories: cached.categories as PosCategory[], items: cached.items as PosItem[] })
        setMsg('離線模式：使用本機菜單快取')
      }
      setPending(loadQueue().length)
    }
  }, [applyMenu])

  useEffect(() => {
    const fromUrl = searchParams.get('key') || ''
    const stored = localStorage.getItem(KEY_STORAGE) || ''
    const key = fromUrl || stored
    if (key) {
      setDeviceKey(key)
      localStorage.setItem(KEY_STORAGE, key)
      pullMenu(key)
    }
  }, [searchParams, pullMenu])

  useEffect(() => {
    if (!deviceKey) return
    const t = setInterval(() => pullMenu(deviceKey), 30000)
    const onOnline = () => pullMenu(deviceKey)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', onOnline)
    }
  }, [deviceKey, pullMenu])

  function saveKey() {
    if (!setupKey.trim()) return
    localStorage.setItem(KEY_STORAGE, setupKey.trim())
    setDeviceKey(setupKey.trim())
    pullMenu(setupKey.trim())
  }

  function openPick(item: PosItem) {
    setPickItem(item)
    setQty(1)
    const init: Record<string, string[]> = {}
    for (const g of item.modifiers ?? []) {
      if (g.required && g.options[0]) init[g.id] = [g.options[0].id]
    }
    setPickMods(init)
  }

  function toggleMod(group: PosModifierGroup, optionId: string) {
    setPickMods(prev => {
      const cur = prev[group.id] ?? []
      const exists = cur.includes(optionId)
      if (group.max === 1) return { ...prev, [group.id]: [optionId] }
      if (exists) return { ...prev, [group.id]: cur.filter(x => x !== optionId) }
      if (cur.length >= group.max) return prev
      return { ...prev, [group.id]: [...cur, optionId] }
    })
  }

  function confirmPick() {
    if (!pickItem) return
    const modifiers: PosCartModifier[] = []
    for (const g of pickItem.modifiers ?? []) {
      for (const oid of pickMods[g.id] ?? []) {
        const opt = g.options.find(o => o.id === oid)
        if (opt) modifiers.push({ groupId: g.id, groupLabel: g.label, optionId: opt.id, optionLabel: opt.label, priceDelta: opt.priceDelta })
      }
    }
    const line: PosCartLine = {
      itemId: pickItem.id,
      name: pickItem.name,
      unitPriceCents: pickItem.price_cents,
      qty,
      modifiers,
      lineTotalCents: calcLineTotal(pickItem.price_cents, qty, modifiers),
    }
    setCart(c => [...c, line])
    setPickItem(null)
  }

  function onScan(val: string) {
    const code = val.trim()
    if (!code) return
    const hit = items.find(i => i.barcode === code)
    if (hit) openPick(hit)
    if (scanRef.current) scanRef.current.value = ''
  }

  async function submit() {
    if (!deviceKey || cart.length === 0) return
    setSubmitting(true)
    setMsg('')
    const clientId = uuid()
    const payload = {
      client_id: clientId,
      order_type: orderType,
      table_label: orderType === 'dine_in' ? tableLabel : null,
      items: cart,
      note,
    }

    try {
      await pushOrder(deviceKey, payload)
      setOnline(true)
      setMsg('訂單已送出')
      try {
        await fetch('http://localhost:3002/print/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: payload, store: storeName }),
        })
      } catch { /* bridge 未啟動 */ }
      setCart([])
      setNote('')
    } catch {
      queueOrder(clientId, payload)
      setOnline(false)
      setPending(loadQueue().length)
      setMsg('離線：訂單已暫存，連線後自動上傳')
      setCart([])
    } finally {
      setSubmitting(false)
    }
  }

  if (!deviceKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md space-y-4 p-6">
          <h1 className="text-xl font-bold">點單終端設定</h1>
          <p className="text-sm text-muted-foreground">輸入門市 device_key</p>
          <Input value={setupKey} onChange={e => setSetupKey(e.target.value)} placeholder="device_key" className="font-mono text-sm" />
          <Button className="w-full" onClick={saveKey} disabled={!setupKey.trim()}>開始點單</Button>
        </Card>
      </div>
    )
  }

  const catItems = items.filter(i => i.category_id === activeCat)
  const total = calcCartTotal(cart)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <span className="font-bold">{storeName || '點單'}</span>
        <Badge variant={online ? 'success' : 'destructive'}>{online ? '連線' : '離線'}</Badge>
        {pending > 0 && <Badge variant="secondary">待上傳 {pending}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">菜單 v{revision}</span>
        <input ref={scanRef} className="sr-only" onKeyDown={e => { if (e.key === 'Enter') onScan((e.target as HTMLInputElement).value) }} aria-label="掃碼" />
        <Button size="sm" variant="outline" onClick={() => scanRef.current?.focus()}>掃碼</Button>
      </header>

      {msg && <p className="bg-primary/10 px-4 py-1 text-center text-sm">{msg}</p>}

      <div className="flex min-h-0 flex-1">
        <aside className="w-28 shrink-0 overflow-y-auto border-r bg-muted/30">
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={`block w-full px-2 py-3 text-left text-sm ${activeCat === c.id ? 'bg-primary text-primary-foreground' : ''}`}>
              {c.name}
            </button>
          ))}
        </aside>

        <main className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4">
          {catItems.map(item => (
            <button key={item.id} onClick={() => openPick(item)} className="rounded-xl border bg-card p-4 text-left shadow-sm active:scale-95">
              <p className="font-semibold">{item.name}</p>
              <p className="text-lg text-primary">{fmt(item.price_cents)}</p>
            </button>
          ))}
        </main>

        <aside className="flex w-72 shrink-0 flex-col border-l">
          <div className="flex gap-1 border-b p-2">
            {POS_ORDER_TYPES.map(t => (
              <Button key={t.id} size="sm" variant={orderType === t.id ? 'default' : 'outline'} onClick={() => setOrderType(t.id)} className="flex-1 text-xs">{t.label}</Button>
            ))}
          </div>
          {orderType === 'dine_in' && <Input className="m-2 h-8" value={tableLabel} onChange={e => setTableLabel(e.target.value)} placeholder="桌號" />}
          <ul className="flex-1 overflow-y-auto p-2 text-sm">
            {cart.map((line, i) => (
              <li key={i} className="mb-2 border-b pb-1">
                <div className="flex justify-between"><span>{line.name} ×{line.qty}</span><span>{fmt(line.lineTotalCents)}</span></div>
                {line.modifiers.length > 0 && <p className="text-[10px] text-muted-foreground">{line.modifiers.map(m => m.optionLabel).join('、')}</p>}
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t p-3">
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="備註" className="h-8 text-xs" />
            <div className="flex items-center justify-between text-lg font-bold"><span>合計</span><span>{fmt(total)}</span></div>
            <Button className="w-full" size="lg" disabled={cart.length === 0 || submitting} onClick={submit}>{submitting ? '送出中…' : '確認下單'}</Button>
          </div>
        </aside>
      </div>

      {pickItem && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center">
          <Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl">
            <h2 className="text-lg font-bold">{pickItem.name}</h2>
            <p className="mb-3 text-primary">{fmt(pickItem.price_cents)}</p>
            {(pickItem.modifiers ?? []).map(g => (
              <div key={g.id} className="mb-3">
                <p className="mb-1 text-sm font-medium">{g.label}{g.required && ' *'}</p>
                <div className="flex flex-wrap gap-1">
                  {g.options.map(o => {
                    const sel = (pickMods[g.id] ?? []).includes(o.id)
                    return (
                      <Button key={o.id} size="sm" variant={sel ? 'default' : 'outline'} onClick={() => toggleMod(g, o.id)}>
                        {o.label}{o.priceDelta > 0 ? ` +${fmt(o.priceDelta)}` : ''}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm">數量</span>
              <Button size="sm" variant="outline" onClick={() => setQty(q => Math.max(1, q - 1))}>−</Button>
              <span>{qty}</span>
              <Button size="sm" variant="outline" onClick={() => setQty(q => q + 1)}>+</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPickItem(null)}>取消</Button>
              <Button className="flex-1" onClick={confirmPick}>加入</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function PosKioskPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">載入中…</div>}>
      <KioskInner />
    </Suspense>
  )
}
