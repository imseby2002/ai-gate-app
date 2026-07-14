'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ShoppingBag, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { KioskLangSwitcher } from '@/components/pos/KioskLangSwitcher'
import { PosItemCard } from '@/components/pos/PosItemCard'
import { localizeCategory, localizeItem } from '@/lib/pos/i18n'
import {
  calcLineTotal,
  calcCartTotal,
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

function modLabel(t: ReturnType<typeof useTranslations>, id: string, fallback: string) {
  const key = `modifiers.${id}` as Parameters<typeof t>[0]
  const v = t(key)
  return v === key ? fallback : v
}

function KioskInner() {
  const t = useTranslations('Pos')
  const locale = useLocale()
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

  const orderTypes = useMemo(
    () =>
      ([
        { id: 'dine_in' as const, label: t('orderType.dine_in') },
        { id: 'takeout' as const, label: t('orderType.takeout') },
        { id: 'delivery' as const, label: t('orderType.delivery') },
      ]),
    [t]
  )

  const locCategories = useMemo(
    () => categories.map(c => localizeCategory(c, locale)),
    [categories, locale]
  )

  const locItems = useMemo(
    () => items.map(i => localizeItem(i, locale)),
    [items, locale]
  )

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
      if (data.changed) applyMenu(data)
      else if (cached) {
        applyMenu({ ...cached, categories: cached.categories as PosCategory[], items: cached.items as PosItem[] })
      }
      await flushOrderQueue(key)
      setPending(loadQueue().length)
    } catch {
      setOnline(false)
      if (cached) {
        applyMenu({ ...cached, categories: cached.categories as PosCategory[], items: cached.items as PosItem[] })
        setMsg(t('offlineMenu'))
      }
      setPending(loadQueue().length)
    }
  }, [applyMenu, t])

  useEffect(() => {
    const saved = localStorage.getItem('pos_locale')
    if (saved && saved !== locale) {
      fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: saved }),
      }).then(() => window.location.reload())
    }
  }, [locale])

  useEffect(() => {
    const key = searchParams.get('key') || localStorage.getItem(KEY_STORAGE) || ''
    if (key) {
      setDeviceKey(key)
      localStorage.setItem(KEY_STORAGE, key)
      pullMenu(key)
    }
  }, [searchParams, pullMenu])

  useEffect(() => {
    if (!deviceKey) return
    const timer = setInterval(() => pullMenu(deviceKey), 30000)
    window.addEventListener('online', () => pullMenu(deviceKey))
    return () => clearInterval(timer)
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
      if (group.max === 1) return { ...prev, [group.id]: [optionId] }
      if (cur.includes(optionId)) return { ...prev, [group.id]: cur.filter(x => x !== optionId) }
      if (cur.length >= group.max) return prev
      return { ...prev, [group.id]: [...cur, optionId] }
    })
  }

  function confirmPick() {
    if (!pickItem) return
    const display = localizeItem(pickItem, locale)
    const modifiers: PosCartModifier[] = []
    for (const g of pickItem.modifiers ?? []) {
      for (const oid of pickMods[g.id] ?? []) {
        const opt = g.options.find(o => o.id === oid)
        if (opt) {
          modifiers.push({
            groupId: g.id,
            groupLabel: modLabel(t, g.id, g.label),
            optionId: opt.id,
            optionLabel: modLabel(t, opt.id, opt.label),
            priceDelta: opt.priceDelta,
          })
        }
      }
    }
    setCart(c => [
      ...c,
      {
        itemId: pickItem.id,
        name: display.displayName,
        unitPriceCents: pickItem.price_cents,
        qty,
        modifiers,
        lineTotalCents: calcLineTotal(pickItem.price_cents, qty, modifiers),
      },
    ])
    setPickItem(null)
  }

  function onScan(val: string) {
    const hit = items.find(i => i.barcode === val.trim())
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
      setMsg(t('orderSent'))
      try {
        await fetch('http://localhost:3002/print/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: payload, store: storeName }),
        })
      } catch { /* no bridge */ }
      setCart([])
      setNote('')
    } catch {
      queueOrder(clientId, payload)
      setOnline(false)
      setPending(loadQueue().length)
      setMsg(t('orderQueued'))
      setCart([])
    } finally {
      setSubmitting(false)
    }
  }

  if (!deviceKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 p-6">
        <Card className="w-full max-w-md space-y-4 border-0 p-8 shadow-xl">
          <h1 className="text-2xl font-bold">{t('setupTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('setupDesc')}</p>
          <Input value={setupKey} onChange={e => setSetupKey(e.target.value)} placeholder="device_key" className="font-mono" />
          <Button className="w-full" size="lg" onClick={saveKey} disabled={!setupKey.trim()}>{t('setupStart')}</Button>
        </Card>
      </div>
    )
  }

  const catItems = locItems.filter(i => i.category_id === activeCat)
  const total = calcCartTotal(cart)
  const pickDisplay = pickItem ? localizeItem(pickItem, locale) : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-stone-100 to-stone-200">
      <header className="relative shrink-0 overflow-hidden bg-gradient-to-r from-orange-600 via-amber-500 to-rose-500 px-4 py-4 text-white shadow-lg">
        <div className="relative flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-white/80">{t('welcome')}</p>
            <h1 className="text-2xl font-bold">{storeName || t('title')}</h1>
          </div>
          <KioskLangSwitcher currentLocale={locale} />
          <Badge variant="secondary" className="gap-1 border-0 bg-white/20 text-white">
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? t('online') : t('offline')}
          </Badge>
          {pending > 0 && <Badge className="bg-white text-orange-700">{t('pending', { n: pending })}</Badge>}
        </div>
        <input ref={scanRef} className="sr-only" onKeyDown={e => { if (e.key === 'Enter') onScan((e.target as HTMLInputElement).value) }} aria-label="scan" />
        <Button size="sm" variant="secondary" className="relative mt-2" onClick={() => scanRef.current?.focus()}>{t('scan')}</Button>
      </header>

      {msg && <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">{msg}</p>}

      <div className="flex min-h-0 flex-1">
        <aside className="w-32 shrink-0 overflow-y-auto border-r bg-white/80 backdrop-blur sm:w-36">
          {locCategories.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              className={`block w-full border-b px-3 py-4 text-left text-sm font-medium transition ${activeCat === c.id ? 'bg-orange-500 text-white' : 'hover:bg-orange-50'}`}
            >
              {c.displayName}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {catItems.map(item => (
              <PosItemCard
                key={item.id}
                name={item.displayName}
                description={item.displayDescription}
                priceLabel={fmt(item.price_cents)}
                imageUrl={item.image_url}
                onClick={() => openPick(item)}
              />
            ))}
          </div>
          {catItems.length === 0 && (
            <p className="py-20 text-center text-muted-foreground">{t('emptyMenu')}</p>
          )}
        </main>

        <aside className="flex w-80 shrink-0 flex-col border-l bg-white shadow-xl">
          <div className="flex gap-1 border-b p-2">
            {orderTypes.map(ot => (
              <Button key={ot.id} size="sm" variant={orderType === ot.id ? 'default' : 'outline'} className="flex-1 text-xs" onClick={() => setOrderType(ot.id)}>
                {ot.label}
              </Button>
            ))}
          </div>
          {orderType === 'dine_in' && (
            <Input className="mx-2 mt-2 h-9" value={tableLabel} onChange={e => setTableLabel(e.target.value)} placeholder={t('tableNo')} />
          )}
          <ul className="flex-1 space-y-2 overflow-y-auto p-3">
            {cart.length === 0 && (
              <li className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 opacity-30" />
                <span className="text-sm">{t('cartEmpty')}</span>
              </li>
            )}
            {cart.map((line, i) => (
              <li key={i} className="rounded-lg bg-stone-50 p-2 text-sm">
                <div className="flex justify-between font-medium">
                  <span>{line.name} ×{line.qty}</span>
                  <span>{fmt(line.lineTotalCents)}</span>
                </div>
                {line.modifiers.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{line.modifiers.map(m => m.optionLabel).join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t bg-stone-50 p-4">
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('note')} className="h-9 bg-white" />
            <div className="flex items-center justify-between text-xl font-bold">
              <span>{t('total')}</span>
              <span className="text-orange-600">{fmt(total)}</span>
            </div>
            <Button className="h-12 w-full text-base" size="lg" disabled={cart.length === 0 || submitting} onClick={submit}>
              {submitting ? t('submitting') : t('confirm')}
            </Button>
          </div>
        </aside>
      </div>

      {pickItem && pickDisplay && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-0 sm:rounded-3xl">
            {pickItem.image_url && (
              <div className="relative h-48 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pickItem.image_url} alt={pickDisplay.displayName} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="space-y-4 p-5">
              <div>
                <h2 className="text-xl font-bold">{pickDisplay.displayName}</h2>
                {pickDisplay.displayDescription && (
                  <p className="mt-1 text-sm text-muted-foreground">{pickDisplay.displayDescription}</p>
                )}
                <p className="mt-2 text-2xl font-bold text-orange-600">{fmt(pickItem.price_cents)}</p>
              </div>
              {(pickItem.modifiers ?? []).map(g => (
                <div key={g.id}>
                  <p className="mb-2 text-sm font-semibold">{modLabel(t, g.id, g.label)}{g.required && ' *'}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map(o => {
                      const sel = (pickMods[g.id] ?? []).includes(o.id)
                      return (
                        <Button key={o.id} size="sm" variant={sel ? 'default' : 'outline'} onClick={() => toggleMod(g, o.id)}>
                          {modLabel(t, o.id, o.label)}{o.priceDelta > 0 ? ` +${fmt(o.priceDelta)}` : ''}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{t('qty')}</span>
                <Button size="icon" variant="outline" onClick={() => setQty(q => Math.max(1, q - 1))}>−</Button>
                <span className="w-8 text-center text-lg font-bold">{qty}</span>
                <Button size="icon" variant="outline" onClick={() => setQty(q => q + 1)}>+</Button>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setPickItem(null)}>{t('cancel')}</Button>
                <Button className="flex-1" onClick={confirmPick}>{t('addToCart')}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function PosKioskPage() {
  const t = useTranslations('Pos')
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">{t('loading')}</div>}>
      <KioskInner />
    </Suspense>
  )
}
