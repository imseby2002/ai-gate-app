'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, CheckCircle2, Minus, Plus, RotateCcw, ShoppingBag, Store, Trash2, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { KioskLangSwitcher } from '@/components/pos/KioskLangSwitcher'
import { PosItemCard } from '@/components/pos/PosItemCard'
import { FtItemDialog } from '@/components/ft-kiosk/FtItemDialog'
import { FtPhoneKeypad } from '@/components/ft-kiosk/FtPhoneKeypad'
import { formatVnd, isValidVnPhone, pickText, resolveSelection } from '@/lib/ft-kiosk/cart'
import type {
  FtDineOption,
  FtItem,
  FtMemberStatus,
  FtMenu,
  FtOrderResult,
  FtSelection,
} from '@/lib/ft-kiosk/types'

const KEY_STORAGE = 'ft_kiosk_key'
const DEFAULT_LOCALE = 'vi'
const IDLE_MS = 120_000
const DONE_SECONDS = 30

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
] as const

type Step = 'welcome' | 'menu' | 'cart' | 'member' | 'pay' | 'done'

interface CartEntry {
  key: string
  selection: FtSelection
}

function KioskInner() {
  const t = useTranslations('FtKiosk')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [deviceKey, setDeviceKey] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [menu, setMenu] = useState<FtMenu | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState<Step>('welcome')
  const [dineOption, setDineOption] = useState<FtDineOption>('dine_in')
  const [activeCat, setActiveCat] = useState('')
  const [picking, setPicking] = useState<FtItem | null>(null)
  const [cart, setCart] = useState<CartEntry[]>([])
  const [phone, setPhone] = useState('')
  const [member, setMember] = useState<FtMemberStatus | null>(null)
  const [memberPhone, setMemberPhone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FtOrderResult | null>(null)
  const [countdown, setCountdown] = useState(DONE_SECONDS)
  const lastActivity = useRef(Date.now())

  const errorText = useCallback(
    (code: string) => {
      const key = `errors.${code}` as Parameters<typeof t>[0]
      return t.has(key) ? t(key) : t('errors.UNKNOWN')
    },
    [t]
  )

  const loadMenu = useCallback(async (key: string) => {
    setLoadError('')
    try {
      const res = await fetch('/api/pos/ft/menu', { headers: { 'x-device-key': key }, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'UNKNOWN')
      setMenu(data as FtMenu)
      setActiveCat(c => c || (data as FtMenu).categories[0]?.id || '')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'UNKNOWN')
    }
  }, [])

  useEffect(() => {
    const key = searchParams.get('key') || localStorage.getItem(KEY_STORAGE) || ''
    if (key) {
      localStorage.setItem(KEY_STORAGE, key)
      setDeviceKey(key)
      loadMenu(key)
    }
  }, [searchParams, loadMenu])

  const switchLocale = useCallback(
    async (code: string) => {
      if (code === locale) return
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: code }),
      })
      startTransition(() => router.refresh())
    },
    [locale, router]
  )

  const reset = useCallback(() => {
    setStep('welcome')
    setCart([])
    setPicking(null)
    setPhone('')
    setMember(null)
    setMemberPhone(null)
    setError('')
    setResult(null)
    setActiveCat(menu?.categories[0]?.id ?? '')
    switchLocale(DEFAULT_LOCALE)
    if (deviceKey) loadMenu(deviceKey)
  }, [menu, deviceKey, loadMenu, switchLocale])

  // 客人離開沒結帳：閒置一段時間自動回首頁
  useEffect(() => {
    const touch = () => { lastActivity.current = Date.now() }
    window.addEventListener('pointerdown', touch)
    const timer = setInterval(() => {
      if (step !== 'welcome' && step !== 'done' && Date.now() - lastActivity.current > IDLE_MS) reset()
    }, 5000)
    return () => {
      window.removeEventListener('pointerdown', touch)
      clearInterval(timer)
    }
  }, [step, reset])

  useEffect(() => {
    if (step !== 'done') return
    setCountdown(DONE_SECONDS)
    const timer = setInterval(() => setCountdown(s => s - 1), 1000)
    return () => clearInterval(timer)
  }, [step])

  useEffect(() => {
    if (step === 'done' && countdown <= 0) reset()
  }, [step, countdown, reset])

  const lines = useMemo(() => {
    if (!menu) return []
    return cart.flatMap(entry => {
      const r = resolveSelection(menu.categories, entry.selection)
      if ('error' in r) return []
      const name = pickText(r.item.translations, locale, r.item.item_name).name
      const detail = [
        r.child ? pickText(r.child.translations, locale, r.child.item_name).name : null,
        ...r.options.map(o => pickText(o.translations, locale, o.item_name).name),
      ].filter(Boolean).join(' · ')
      return [{ key: entry.key, name, detail, qty: r.qty, lineTotal: r.lineTotal }]
    })
  }, [cart, menu, locale])

  const total = lines.reduce((s, l) => s + l.lineTotal, 0)
  const count = lines.reduce((s, l) => s + l.qty, 0)

  function addToCart(sel: FtSelection) {
    setCart(c => [...c, { key: crypto.randomUUID(), selection: sel }])
    setPicking(null)
  }

  function changeQty(key: string, delta: number) {
    setCart(c =>
      c.flatMap(e => {
        if (e.key !== key) return [e]
        const qty = e.selection.qty + delta
        return qty < 1 ? [] : [{ ...e, selection: { ...e.selection, qty: Math.min(50, qty) } }]
      })
    )
  }

  async function lookupMember() {
    if (!isValidVnPhone(phone)) {
      setError(t('errors.PHONE_INVALID'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/pos/ft/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-key': deviceKey },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'UNKNOWN')
      setMember(data.status)
      if (data.status === 'member') setMemberPhone(data.phone)
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : 'UNKNOWN'))
    } finally {
      setBusy(false)
    }
  }

  function skipMember() {
    setMemberPhone(null)
    setStep('pay')
  }

  async function placeOrder() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/pos/ft/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-key': deviceKey },
        body: JSON.stringify({ selections: cart.map(c => c.selection), phone: memberPhone, dineOption }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'UNKNOWN')
      setResult(data as FtOrderResult)
      setStep('done')
    } catch (e) {
      setError(errorText(e instanceof Error ? e.message : 'UNKNOWN'))
    } finally {
      setBusy(false)
    }
  }

  // ── 設定 device key ─────────────────────────────────
  if (!deviceKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-100 p-6">
        <Card className="w-full max-w-md space-y-4 border-0 p-8 shadow-xl">
          <h1 className="text-2xl font-bold">{t('setupTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('setupDesc')}</p>
          <Input value={setupKey} onChange={e => setSetupKey(e.target.value)} placeholder="device_key" className="font-mono" />
          <Button
            className="w-full"
            size="lg"
            disabled={!setupKey.trim()}
            onClick={() => {
              const k = setupKey.trim()
              localStorage.setItem(KEY_STORAGE, k)
              setDeviceKey(k)
              loadMenu(k)
            }}
          >
            {t('setupStart')}
          </Button>
        </Card>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-stone-100 p-6 text-center">
        {loadError ? (
          <>
            <p className="text-lg">{t('loadFailed')}</p>
            <p className="font-mono text-sm text-stone-500">{loadError}</p>
            <Button onClick={() => loadMenu(deviceKey)}>{t('retry')}</Button>
          </>
        ) : (
          <p className="text-lg">{t('loading')}</p>
        )}
      </div>
    )
  }

  // ── 首頁：選語言、內用/外帶 ───────────────────────────
  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-emerald-800 via-emerald-700 to-teal-600 p-8 text-white">
        <div className="flex w-full justify-center gap-3 pt-4">
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchLocale(l.code)}
              className={`rounded-full px-5 py-3 text-lg font-medium transition ${locale === l.code ? 'bg-white text-emerald-800' : 'bg-white/15 hover:bg-white/25'}`}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xl uppercase tracking-[0.3em] text-white/70">{t('welcome')}</p>
          <h1 className="mt-3 text-5xl font-bold sm:text-6xl">{menu.storeName}</h1>
          <p className="mt-6 text-2xl text-white/80">{t('chooseDine')}</p>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-2 gap-6 pb-8">
          {(
            [
              { id: 'dine_in' as const, icon: Utensils, label: t('dineIn') },
              { id: 'takeaway' as const, icon: ShoppingBag, label: t('takeaway') },
            ]
          ).map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setDineOption(o.id)
                setStep('menu')
              }}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-4 rounded-3xl bg-white text-emerald-800 shadow-2xl transition active:scale-[0.97]"
            >
              <o.icon className="h-20 w-20" />
              <span className="text-3xl font-bold">{o.label}</span>
            </button>
          ))}
        </div>
        {menu.mock && <p className="text-sm text-white/60">{t('demo')}</p>}
      </div>
    )
  }

  // ── 取餐號碼 ─────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-emerald-700 p-8 text-center text-white">
        <CheckCircle2 className="h-24 w-24" />
        <h1 className="text-4xl font-bold">{t('doneTitle')}</h1>
        <div className="rounded-3xl bg-white px-12 py-8 text-emerald-800">
          <p className="text-lg">{t('doneOrderNo')}</p>
          <p className="font-mono text-6xl font-bold tracking-widest">{result.orderNo}</p>
        </div>
        <p className="text-3xl font-semibold">{formatVnd(result.amount)}</p>
        <p className="max-w-xl text-2xl">{t('donePayAtCounter')}</p>
        <Button size="lg" variant="secondary" className="mt-4 h-14 px-10 text-lg" onClick={reset}>
          {t('doneBack', { s: Math.max(countdown, 0) })}
        </Button>
      </div>
    )
  }

  const header = (title: string, onBack?: () => void) => (
    <header className="flex shrink-0 items-center gap-3 bg-emerald-800 px-5 py-4 text-white shadow">
      {onBack && (
        <button type="button" onClick={onBack} aria-label={t('back')} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
          <ArrowLeft className="h-6 w-6" />
        </button>
      )}
      <div className="flex-1">
        <p className="text-sm text-white/70">{menu.storeName} · {dineOption === 'dine_in' ? t('dineIn') : t('takeaway')}</p>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <KioskLangSwitcher currentLocale={locale} />
      <button type="button" onClick={reset} className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm">
        <RotateCcw className="h-4 w-4" /> {t('startOver')}
      </button>
    </header>
  )

  const errorBar = error && <p className="shrink-0 bg-rose-100 px-5 py-3 text-center text-lg text-rose-800">{error}</p>

  // ── 菜單 ─────────────────────────────────────────────
  if (step === 'menu') {
    const cat = menu.categories.find(c => c.id === activeCat) ?? menu.categories[0]
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">
        {header(t('menuTitle'))}
        <div className="flex min-h-0 flex-1">
          <nav className="w-40 shrink-0 overflow-y-auto bg-white sm:w-48">
            {menu.categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={`block w-full border-b px-4 py-6 text-left text-lg font-semibold transition ${cat?.id === c.id ? 'border-l-8 border-l-emerald-600 bg-emerald-50 text-emerald-800' : 'text-stone-600'}`}
              >
                {pickText(c.translations, locale, c.category_name).name}
              </button>
            ))}
          </nav>
          <main className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {(cat?.items ?? []).map(item => {
                const text = pickText(item.translations, locale, item.item_name, item.description)
                const prices = (item.childs ?? []).map(c => c.list_price)
                const price = prices.length ? Math.min(...prices) : item.list_price
                return (
                  <PosItemCard
                    key={item.id}
                    name={text.name}
                    description={text.description}
                    priceLabel={(prices.length > 1 ? t('from') + ' ' : '') + formatVnd(price)}
                    imageUrl={item.thumbnail}
                    onClick={() => setPicking(item)}
                  />
                )
              })}
            </div>
            {(cat?.items.length ?? 0) === 0 && <p className="py-20 text-center text-stone-500">{t('emptyMenu')}</p>}
          </main>
        </div>
        <footer className="flex shrink-0 items-center gap-4 border-t bg-white px-5 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-7 w-7 text-emerald-700" />
            {t('itemCount', { n: count })}
          </div>
          <p className="flex-1 text-right text-2xl font-bold">{formatVnd(total)}</p>
          <Button className="h-16 rounded-2xl bg-emerald-700 px-10 text-xl hover:bg-emerald-800" disabled={count === 0} onClick={() => setStep('cart')}>
            {t('viewCart')}
          </Button>
        </footer>
        {picking && <FtItemDialog item={picking} onClose={() => setPicking(null)} onAdd={addToCart} />}
      </div>
    )
  }

  // ── 購物車 ───────────────────────────────────────────
  if (step === 'cart') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">
        {header(t('cartTitle'), () => setStep('menu'))}
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 overflow-y-auto p-5">
          {lines.length === 0 && <p className="py-20 text-center text-lg text-stone-500">{t('emptyCart')}</p>}
          {lines.map(l => (
            <div key={l.key} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold">{l.name}</p>
                {l.detail && <p className="text-stone-500">{l.detail}</p>}
                <p className="mt-1 text-lg font-bold text-emerald-700">{formatVnd(l.lineTotal)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={() => changeQty(l.key, -1)} aria-label="-">
                  {l.qty === 1 ? <Trash2 className="h-5 w-5 text-rose-600" /> : <Minus className="h-5 w-5" />}
                </Button>
                <span className="w-8 text-center text-xl font-bold">{l.qty}</span>
                <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={() => changeQty(l.key, 1)} aria-label="+">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
        </main>
        <footer className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 p-5">
          <div className="flex justify-between text-2xl font-bold">
            <span>{t('total')}</span>
            <span>{formatVnd(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-16 rounded-2xl text-xl" onClick={() => setStep('menu')}>{t('continueOrdering')}</Button>
            <Button className="h-16 rounded-2xl bg-emerald-700 text-xl hover:bg-emerald-800" disabled={lines.length === 0} onClick={() => { setError(''); setStep('member') }}>
              {t('checkout')}
            </Button>
          </div>
        </footer>
      </div>
    )
  }

  // ── 會員電話（可略過）────────────────────────────────
  if (step === 'member') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">
        {header(t('memberTitle'), () => setStep('cart'))}
        {errorBar}
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 overflow-y-auto p-5">
          <p className="text-center text-xl text-stone-600">{t('memberDesc')}</p>
          {member === 'member' ? (
            <div className="space-y-5 rounded-3xl bg-white p-6 text-center shadow">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
              <p className="text-2xl font-bold">{t('memberYes')}</p>
              <p className="font-mono text-xl">{phone.replace(/^(\d{3})\d{4}(\d{3})$/, '$1****$2')}</p>
              <Button className="h-16 w-full rounded-2xl bg-emerald-700 text-xl hover:bg-emerald-800" onClick={() => setStep('pay')}>
                {t('next')}
              </Button>
              <button type="button" className="text-stone-500 underline" onClick={() => { setMember(null); setMemberPhone(null); setPhone('') }}>
                {t('memberChange')}
              </button>
            </div>
          ) : member === 'not_member' ? (
            <div className="space-y-4 rounded-3xl bg-white p-6 text-center shadow">
              <p className="text-2xl font-bold">{t('memberNo')}</p>
              <p className="text-lg text-stone-500">{t('memberNoDesc')}</p>
              <Button className="h-16 w-full rounded-2xl bg-emerald-700 text-xl hover:bg-emerald-800" onClick={skipMember}>
                {t('memberContinueNoPoints')}
              </Button>
              <Button variant="outline" className="h-14 w-full rounded-2xl text-lg" onClick={() => { setMember(null); setPhone('') }}>
                {t('memberRetry')}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex h-20 items-center justify-center rounded-2xl bg-white font-mono text-4xl tracking-widest shadow-inner">
                {phone || <span className="text-2xl tracking-normal text-stone-300">0xxx xxx xxx</span>}
              </div>
              <FtPhoneKeypad value={phone} onChange={v => { setPhone(v); setError('') }} clearLabel={t('clear')} />
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-16 rounded-2xl text-xl" onClick={skipMember}>{t('memberSkip')}</Button>
                <Button className="h-16 rounded-2xl bg-emerald-700 text-xl hover:bg-emerald-800" disabled={busy || phone.length < 10} onClick={lookupMember}>
                  {busy ? t('memberChecking') : t('memberConfirm')}
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    )
  }

  // ── 付款（目前只有櫃台付款）──────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">
      {header(t('payTitle'), () => setStep('member'))}
      {errorBar}
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex items-center gap-4 rounded-3xl border-4 border-emerald-600 bg-white p-6">
          <Store className="h-14 w-14 shrink-0 text-emerald-700" />
          <div className="flex-1">
            <p className="text-2xl font-bold">{t('payCounter')}</p>
            <p className="text-lg text-stone-500">{t('payCounterDesc')}</p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="space-y-2 rounded-3xl bg-white p-6">
          {lines.map(l => (
            <div key={l.key} className="flex justify-between gap-4 text-lg">
              <span>{l.name} ×{l.qty}{l.detail && <span className="block text-sm text-stone-500">{l.detail}</span>}</span>
              <span className="shrink-0">{formatVnd(l.lineTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-3 text-2xl font-bold">
            <span>{t('total')}</span>
            <span>{formatVnd(total)}</span>
          </div>
          <p className="text-stone-500">
            {memberPhone ? t('payMember', { phone: memberPhone.replace(/^(\d{3})\d{4}(\d{3})$/, '$1****$2') }) : t('payGuest')}
          </p>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-3xl shrink-0 p-5">
        <Button className="h-20 w-full rounded-2xl bg-emerald-700 text-2xl hover:bg-emerald-800" disabled={busy || lines.length === 0} onClick={placeOrder}>
          {busy ? t('placing') : t('placeOrder')}
        </Button>
      </footer>
    </div>
  )
}

export default function FtKioskPage() {
  const t = useTranslations('FtKiosk')
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">{t('loading')}</div>}>
      <KioskInner />
    </Suspense>
  )
}
