'use client'

import { useState, useEffect, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { ClipboardList, Upload, Download, Loader2, AlertCircle, Store, Save, Bell, ShieldAlert, PackageCheck, History, Boxes, CalendarClock, Trash2, Plus, Ban, PackageMinus, ExternalLink, Wrench, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'count' | 'batch' | 'loss' | 'safety' | 'foreman'
const fmt = (n: number, locale: string) => (Math.round(n * 100) / 100).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')
const IVT_STOCKTAKING_URL = 'https://ivt.ipos.vn/stock/stock-taking'
const IVT_ORDER_URL = 'https://ivt.ipos.vn/order/purchase-order-internal'

interface Material { material_code: string; material_name: string; unit: string; book_qty: number }
interface CountRow { material_code: string; material_name: string; unit: string; book_qty: number; counted: number | '' }
interface OrderRow { material_code: string; material_name: string; unit: string; counted: number; safety: number; full: number; order_qty: number; urgent: boolean }
interface SafetyRow { material_code: string; material_name: string; unit: string; safety_qty: number | ''; full_qty: number | '' }
interface Stocktake { id: string; store: string; taken_on: string; note: string }

export default function StoreInventoryPage() {
  const t = useTranslations('StoreInventory')
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('count')
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [lockedStore, setLockedStore] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/inv/stores').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() })
      .then(d => {
        if (d) {
          if (d.locked_store) {
            setLockedStore(d.locked_store)
            setStores([d.locked_store])
            setStore(d.locked_store)
          } else {
            setStores(d.stores ?? [])
            setStore(s => s || (d.stores?.[0] ?? ''))
          }
        }
      })
  }, [])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('adminOnly')}</p></div>
    </div>
  )

  const TABS: [Tab, string, ReactNode][] = [
    ['count', t('tabCount'), <ClipboardList key="a" className="h-4 w-4" />],
    ['batch', t('tabBatch'), <Boxes key="d" className="h-4 w-4" />],
    ['loss', t('tabLoss'), <PackageMinus key="e" className="h-4 w-4" />],
    ['safety', t('tabSafety'), <ShieldAlert key="b" className="h-4 w-4" />],
    ['foreman', t('tabForeman'), <Bell key="c" className="h-4 w-4" />],
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Link href="/store-reports"><Button variant="outline" size="sm" className="gap-1.5"><Store className="h-4 w-4" />{t('storeReports')}</Button></Link>
          <Link href="/store-bills"><Button variant="outline" size="sm" className="gap-1.5"><Receipt className="h-4 w-4 text-emerald-600" />{t('bills')}</Button></Link>
          <Link href="/repair"><Button variant="outline" size="sm" className="gap-1.5"><Wrench className="h-4 w-4 text-amber-600" />{t('repair')}</Button></Link>
        </div>
      </div>

      <Card className="p-3">
        <label className="space-y-1 inline-block">
          <div className="flex items-center gap-2">
            <span className="block text-xs text-gray-500">{t('storeCode')}</span>
            {lockedStore && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                🔒 {t('lockedOtherStores')}
              </span>
            )}
          </div>
          <Input
            list={lockedStore ? undefined : "inv-store-list"}
            value={store}
            disabled={!!lockedStore}
            onChange={e => setStore(e.target.value)}
            placeholder={t('storePlaceholder')}
            className="w-48 disabled:bg-muted/50 disabled:cursor-not-allowed font-semibold"
          />
          {!lockedStore && <datalist id="inv-store-list">{stores.map(s => <option key={s} value={s} />)}</datalist>}
        </label>
      </Card>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {!store ? <div className="text-center py-10 text-gray-400 text-sm">{t('selectStoreFirst')}</div>
        : tab === 'count' ? <CountTab store={store} />
        : tab === 'batch' ? <BatchTab store={store} />
        : tab === 'loss' ? <LossTab store={store} />
        : tab === 'safety' ? <SafetyTab store={store} />
        : <ForemanTab store={store} />}
    </div>
  )
}

// ── 盤點・訂貨 ──
function CountTab({ store }: { store: string }) {
  const t = useTranslations('StoreInventory')
  const locale = useLocale()
  const [rows, setRows] = useState<CountRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [result, setResult] = useState<{ id: string; order: OrderRow[]; urgent_count: number; notified: boolean } | null>(null)
  const [history, setHistory] = useState<Stocktake[]>([])
  const [tick, setTick] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRows([]); setResult(null); setMsg('')
    setLoading(true)
    fetch(`/api/inv/materials?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { materials: [] }).then((d: { materials: Material[] }) => {
      setRows((d.materials ?? []).map(m => ({ ...m, counted: '' })))
      setLoading(false)
    })
    fetch(`/api/inv/stocktake?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { stocktakes: [] }).then(d => setHistory(d.stocktakes ?? []))
  }, [store, tick])

  const setCount = (code: string, v: string) => setRows(p => p.map(r => r.material_code === code ? { ...r, counted: v === '' ? '' : Number(v) } : r))

  const uploadFilled = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setMsg(t('parsing'))
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/inv/stocktake/parse', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('parseFailed')); return }
    const counts = new Map<string, number>((d.items ?? []).map((it: { material_code: string; counted_qty: number }) => [it.material_code, it.counted_qty]))
    setRows(p => {
      const merged = p.map(r => counts.has(r.material_code) ? { ...r, counted: counts.get(r.material_code)! } : r)
      const known = new Set(p.map(r => r.material_code))
      for (const it of (d.items ?? []) as { material_code: string; material_name: string; unit: string; counted_qty: number }[]) {
        if (!known.has(it.material_code)) merged.push({ material_code: it.material_code, material_name: it.material_name, unit: it.unit, book_qty: 0, counted: it.counted_qty })
      }
      return merged
    })
    setMsg(t('countsLoaded', { n: d.items?.length ?? 0 }))
  }

  const save = async () => {
    const items = rows.filter(r => r.counted !== '').map(r => ({ material_code: r.material_code, material_name: r.material_name, unit: r.unit, counted_qty: Number(r.counted) }))
    if (items.length === 0) { setMsg(t('fillAtLeastOneCount')); return }
    setSaving(true); setMsg('')
    const res = await fetch('/api/inv/stocktake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, items }) })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('saveFailed')); return }
    setResult(d); setTick(x => x + 1)
    setMsg(d.urgent_count > 0 ? t('savedWithUrgent', { n: d.urgent_count, notified: d.notified ? t('notifiedForeman') : t('noForemanChannel') }) : t('saved'))
  }

  const viewHistory = async (id: string) => {
    const res = await fetch(`/api/inv/stocktake?id=${id}`)
    if (res.ok) { const d = await res.json(); setResult({ id, order: d.order ?? [], urgent_count: (d.order ?? []).filter((o: OrderRow) => o.urgent).length, notified: false }) }
  }
  const resend = async (id: string) => {
    const res = await fetch('/api/inv/stocktake/alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? (d.notified ? t('notifiedForemanCount', { n: d.urgent_count }) : t('noUrgentOrNoChannel')) : (d.error ?? t('notifyFailed')))
  }

  const orderRows = (result?.order ?? []).filter(o => o.order_qty > 0)

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={uploadFilled} />
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/api/inv/stocktake/xlsx?kind=template&store=${encodeURIComponent(store)}`)}><Download className="h-4 w-4" />{t('downloadBlankSheet')}</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{t('uploadFilledSheet')}</Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('saveAndGenerateOrder')}</Button>
        {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">{t('noMaterialData')}</div>
        : <Card className="p-4">
          <h3 className="font-semibold mb-2 text-sm">{t('countInput', { n: rows.length })}</h3>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2 text-right">{t('bookStock')}</th><th className="pr-2 text-right">{t('countedQty')}</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.material_code} className="border-b last:border-0">
                  <td className="py-1 pr-2">{r.material_name || r.material_code}</td>
                  <td className="pr-2 text-gray-400">{r.unit}</td>
                  <td className="pr-2 text-right tabular-nums text-gray-400">{fmt(r.book_qty, locale)}</td>
                  <td className="pr-2 text-right"><Input type="number" value={r.counted === '' ? '' : String(r.counted)} onChange={e => setCount(r.material_code, e.target.value)} className="w-24 h-8 text-right" placeholder="—" /></td>
                </tr>))}</tbody></table>
          </div>
        </Card>}

      {result && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">{t('orderSheetTitle', { n: orderRows.length })}</h3>
            <div className="ml-auto flex gap-2">
              {result.urgent_count > 0 && <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" onClick={() => resend(result.id)}><Bell className="h-4 w-4" />{t('notifyForemanCount', { n: result.urgent_count })}</Button>}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/api/inv/stocktake/xlsx?kind=order&id=${result.id}`)}><Download className="h-4 w-4" />{t('downloadOrderSheet')}</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 p-2 text-xs">
            <span className="font-medium text-sky-800">{t('ivtImportFile')}</span>
            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => window.open(`/api/inv/stocktake/xlsx?kind=ivt-count&id=${result.id}`)}><Download className="h-3.5 w-3.5" />{t('ivtCount')}</Button>
            <a href={IVT_STOCKTAKING_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 underline">{t('uploadToIvtCount')}<ExternalLink className="h-3 w-3" /></a>
            <span className="text-sky-300">|</span>
            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => window.open(`/api/inv/stocktake/xlsx?kind=ivt-order&id=${result.id}`)}><Download className="h-3.5 w-3.5" />{t('ivtOrder')}</Button>
            <a href={IVT_ORDER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 underline">{t('uploadToIvtOrder')}<ExternalLink className="h-3 w-3" /></a>
          </div>
          {orderRows.length === 0 ? <p className="text-sm text-gray-400">{t('noOrderNeeded')}</p>
            : <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2 text-right">{t('countedQty')}</th><th className="pr-2 text-right">{t('safetyQty')}</th><th className="pr-2 text-right">{t('fullQty')}</th><th className="pr-2 text-right">{t('orderQty')}</th></tr></thead>
                <tbody>{orderRows.map(o => (
                  <tr key={o.material_code} className={`border-b last:border-0 ${o.urgent ? 'bg-red-50' : ''}`}>
                    <td className="py-1 pr-2">{o.material_name || o.material_code}{o.urgent && <span className="ml-1 text-[11px] text-red-600">{t('urgent')}</span>}</td>
                    <td className="pr-2 text-gray-400">{o.unit}</td>
                    <td className={`pr-2 text-right tabular-nums ${o.urgent ? 'text-red-600 font-medium' : ''}`}>{fmt(o.counted, locale)}</td>
                    <td className="pr-2 text-right tabular-nums text-gray-400">{fmt(o.safety, locale)}</td>
                    <td className="pr-2 text-right tabular-nums text-gray-400">{fmt(o.full, locale)}</td>
                    <td className="pr-2 text-right tabular-nums font-medium text-blue-600">{fmt(o.order_qty, locale)}</td>
                  </tr>))}</tbody></table>
            </div>}
        </Card>
      )}

      {history.length > 0 && (
        <Card className="p-3">
          <div className="text-sm font-medium flex items-center gap-1.5 mb-2"><History className="h-4 w-4 text-gray-400" />{t('countHistory')}</div>
          <div className="flex flex-wrap gap-2">
            {history.map(h => (
              <button key={h.id} onClick={() => viewHistory(h.id)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">{h.taken_on}</button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── 原料・批次（進貨批次＋到期） ──
interface Batch {
  id: string; material_code: string; material_name: string; unit: string
  purchase_date: string | null; expiry_date: string; qty: number
  remind_staff: number | null; remind_audit: number | null; remind_mgmt: number | null
  status: string; days_to_expiry: number | null; note: string
}

function BatchTab({ store }: { store: string }) {
  const t = useTranslations('StoreInventory')
  const locale = useLocale()
  const [rows, setRows] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  // 單筆新增表單
  const [f, setF] = useState({ material_code: '', material_name: '', unit: '', purchase_date: '', expiry_date: '', qty: '' as number | '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setLoading(true); setMsg('')
    fetch(`/api/inv/batches?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { rows: [] })
      .then((d: { rows: Batch[] }) => { setRows(d.rows ?? []); setLoading(false) })
  }, [store, tick])

  const add = async () => {
    if (!f.material_code || !f.expiry_date) { setMsg(t('materialAndExpiryRequired')); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/inv/batches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, ...f, qty: f.qty || 0 }),
    })
    setAdding(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('createFailed')); return }
    setF({ material_code: '', material_name: '', unit: '', purchase_date: '', expiry_date: '', qty: '' })
    setTick(x => x + 1); setMsg(t('batchAdded'))
  }
  const del = async (id: string) => {
    const res = await fetch('/api/inv/batches', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setTick(x => x + 1)
  }
  const scrap = async (b: Batch) => {
    if (!confirm(t('confirmScrap', { name: b.material_name || b.material_code, qty: fmt(b.qty, locale) }))) return
    setMsg('')
    const res = await fetch('/api/inv/batches/scrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, reason: 'expired' }) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? t('scrappedAndLogged') : (d.error ?? t('scrapFailed')))
    if (res.ok) setTick(x => x + 1)
  }
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setMsg(t('importing'))
    const fd = new FormData(); fd.append('file', file); fd.append('store', store)
    const res = await fetch('/api/inv/import/batches', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? t('importedCount', { n: d.imported, skipped: d.skipped ? t('skippedNoExpiry', { n: d.skipped }) : '' }) : (d.error ?? t('importFailed')))
    if (res.ok) setTick(x => x + 1)
  }

  // 到期狀態底色：已過期紅、7 天內橘、30 天內黃
  const rowClass = (d: number | null) => d === null ? '' : d < 0 ? 'bg-red-50' : d <= 7 ? 'bg-orange-50' : d <= 30 ? 'bg-amber-50' : ''
  const dLabel = (d: number | null) => d === null ? '—' : d < 0 ? t('expiredDaysAgo', { n: -d }) : d === 0 ? t('expiresToday') : t('daysCount', { n: d })

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={upload} />
      <p className="text-xs text-gray-500">{t('batchDesc')}</p>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium flex items-center gap-1.5"><Plus className="h-4 w-4 text-primary" />{t('newBatch')}</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('materialCodeRequired')}</span><Input value={f.material_code} onChange={e => setF({ ...f, material_code: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('name')}</span><Input value={f.material_name} onChange={e => setF({ ...f, material_name: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('unit')}</span><Input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('purchaseDate')}</span><Input type="date" value={f.purchase_date} onChange={e => setF({ ...f, purchase_date: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('expiryDateRequired')}</span><Input type="date" value={f.expiry_date} onChange={e => setF({ ...f, expiry_date: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('qty')}</span><Input type="number" value={f.qty === '' ? '' : String(f.qty)} onChange={e => setF({ ...f, qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button size="sm" onClick={add} disabled={adding}>{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('add')}</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/api/inv/batches/xlsx?store=${encodeURIComponent(store)}`)}><Download className="h-4 w-4" />{t('downloadBatchSheet')}</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{t('uploadBatchSheet')}</Button>
          {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
        </div>
      </Card>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">{t('noBatchesYet')}</div>
        : <Card className="p-4">
          <div className="text-sm font-medium flex items-center gap-1.5 mb-2"><CalendarClock className="h-4 w-4 text-gray-400" />{t('batchesTitle', { n: rows.length })}</div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2">{t('purchaseDate')}</th><th className="pr-2">{t('expiryDate')}</th><th className="pr-2 text-right">{t('qty')}</th><th className="pr-2 text-right">{t('remaining')}</th><th className="pr-2"></th></tr></thead>
              <tbody>{rows.map(b => (
                <tr key={b.id} className={`border-b last:border-0 ${rowClass(b.days_to_expiry)}`}>
                  <td className="py-1 pr-2">{b.material_name || b.material_code}</td>
                  <td className="pr-2 text-gray-400">{b.unit}</td>
                  <td className="pr-2 text-gray-500">{b.purchase_date ?? '—'}</td>
                  <td className="pr-2 font-medium">{b.expiry_date}</td>
                  <td className="pr-2 text-right tabular-nums">{fmt(b.qty, locale)}</td>
                  <td className={`pr-2 text-right tabular-nums ${b.days_to_expiry !== null && b.days_to_expiry <= 7 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{dLabel(b.days_to_expiry)}</td>
                  <td className="pr-2 text-right whitespace-nowrap">
                    <button onClick={() => scrap(b)} title={t('scrapAndLog')} className="text-gray-400 hover:text-orange-600 mr-2 align-middle"><Ban className="h-4 w-4 inline" /></button>
                    <button onClick={() => del(b.id)} title={t('deleteWrongEntry')} className="text-gray-300 hover:text-red-500 align-middle"><Trash2 className="h-4 w-4 inline" /></button>
                  </td>
                </tr>))}</tbody></table>
          </div>
        </Card>}
    </div>
  )
}

// ── 耗損（報廢／丟棄，扣庫存） ──
interface Loss { id: string; material_code: string; material_name: string; unit: string; qty: number; reason: string; loss_date: string; batch_id: string | null; note: string }
const IVT_CANCEL_URL = 'https://ivt.ipos.vn/good-issue/cancel'

function LossTab({ store }: { store: string }) {
  const t = useTranslations('StoreInventory')
  const locale = useLocale()
  const REASON_LABEL: Record<string, string> = { expired: t('reasonExpired'), damaged: t('reasonDamaged'), other: t('reasonOther') }
  const [rows, setRows] = useState<Loss[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  const [f, setF] = useState({ material_code: '', material_name: '', unit: '', qty: '' as number | '', reason: 'damaged', loss_date: '', note: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/inv/losses?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { rows: [] })
      .then((d: { rows: Loss[] }) => { setRows(d.rows ?? []); setLoading(false) })
  }, [store, tick])

  const add = async () => {
    if (!f.material_code) { setMsg(t('materialRequired')); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/inv/losses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, ...f, qty: f.qty || 0 }) })
    setAdding(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('createFailed')); return }
    setF({ material_code: '', material_name: '', unit: '', qty: '', reason: 'damaged', loss_date: '', note: '' })
    setTick(x => x + 1); setMsg(t('lossAdded'))
  }
  const del = async (id: string) => {
    const res = await fetch('/api/inv/losses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setTick(x => x + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>{t('lossNotice')}
          <a href={IVT_CANCEL_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 ml-1 underline font-medium">{t('ivtLossEntry')}<ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium flex items-center gap-1.5"><Plus className="h-4 w-4 text-primary" />{t('newLoss')}</div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('materialCodeRequired')}</span><Input value={f.material_code} onChange={e => setF({ ...f, material_code: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('name')}</span><Input value={f.material_name} onChange={e => setF({ ...f, material_name: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('unit')}</span><Input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('qty')}</span><Input type="number" value={f.qty === '' ? '' : String(f.qty)} onChange={e => setF({ ...f, qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('reason')}</span>
            <select value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="damaged">{t('reasonDamaged')}</option><option value="expired">{t('reasonExpired')}</option><option value="other">{t('reasonOther')}</option>
            </select>
          </label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('date')}</span><Input type="date" value={f.loss_date} onChange={e => setF({ ...f, loss_date: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('note')}</span><Input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} className="h-8" /></label>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button size="sm" onClick={add} disabled={adding}>{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('addLoss')}</Button>
          {msg && <span className="text-sm text-blue-600">{msg}</span>}
        </div>
      </Card>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">{t('noLossRecords')}</div>
        : <Card className="p-4">
          <div className="text-sm font-medium flex items-center gap-1.5 mb-2"><PackageMinus className="h-4 w-4 text-gray-400" />{t('lossRecordsTitle', { n: rows.length })}</div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('date')}</th><th className="pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2 text-right">{t('qty')}</th><th className="pr-2">{t('reason')}</th><th className="pr-2">{t('source')}</th><th className="pr-2">{t('note')}</th><th className="pr-2"></th></tr></thead>
              <tbody>{rows.map(l => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-1 pr-2 text-gray-500">{l.loss_date}</td>
                  <td className="pr-2">{l.material_name || l.material_code}</td>
                  <td className="pr-2 text-gray-400">{l.unit}</td>
                  <td className="pr-2 text-right tabular-nums">{fmt(l.qty, locale)}</td>
                  <td className="pr-2">{REASON_LABEL[l.reason] ?? l.reason}</td>
                  <td className="pr-2 text-gray-400">{l.batch_id ? t('sourceBatchScrap') : t('sourceManual')}</td>
                  <td className="pr-2 text-gray-500">{l.note}</td>
                  <td className="pr-2 text-right"><button onClick={() => del(l.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
                </tr>))}</tbody></table>
          </div>
        </Card>}
    </div>
  )
}

// ── 安全庫存 ──
function SafetyTab({ store }: { store: string }) {
  const t = useTranslations('StoreInventory')
  const [rows, setRows] = useState<SafetyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true); setMsg('')
    fetch(`/api/inv/safety?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { rows: [] }).then((d: { rows: { material_code: string; material_name: string; unit: string; safety_qty: number; full_qty: number }[] }) => {
      setRows((d.rows ?? []).map(r => ({ ...r })))
      setLoading(false)
    })
  }, [store, tick])

  const seedFromMaterials = async () => {
    const res = await fetch(`/api/inv/materials?store=${encodeURIComponent(store)}`)
    const d = await res.json().catch(() => ({ materials: [] }))
    const existing = new Set(rows.map(r => r.material_code))
    const add = (d.materials ?? []).filter((m: Material) => !existing.has(m.material_code))
      .map((m: Material) => ({ material_code: m.material_code, material_name: m.material_name, unit: m.unit, safety_qty: '' as const, full_qty: '' as const }))
    setRows(p => [...p, ...add])
    setMsg(t('materialsLoaded', { n: add.length }))
  }
  const setVal = (code: string, key: 'safety_qty' | 'full_qty', v: string) =>
    setRows(p => p.map(r => r.material_code === code ? { ...r, [key]: v === '' ? '' : Number(v) } : r))

  const save = async () => {
    setSaving(true); setMsg('')
    const payload = rows.map(r => ({ material_code: r.material_code, material_name: r.material_name, unit: r.unit, safety_qty: r.safety_qty || 0, full_qty: r.full_qty || 0 }))
    const res = await fetch('/api/inv/safety', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, rows: payload }) })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? t('savedCount', { n: d.saved ?? 0 }) : (d.error ?? t('saveFailed')))
  }
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setMsg(t('importing'))
    const fd = new FormData(); fd.append('file', file); fd.append('store', store)
    const res = await fetch('/api/inv/import/safety', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? t('importedCountSimple', { n: d.imported }) : (d.error ?? t('importFailed')))
    if (res.ok) setTick(x => x + 1)
  }

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={upload} />
      <p className="text-xs text-gray-500">{t('safetyDesc')}</p>
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={seedFromMaterials}><PackageCheck className="h-4 w-4" />{t('loadMaterialList')}</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{t('importXlsx')}</Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('save')}</Button>
        {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">{t('noSafetySettings')}</div>
        : <Card className="p-4">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">{t('material')}</th><th className="pr-2">{t('unit')}</th><th className="pr-2 text-right">{t('safetyQty')}</th><th className="pr-2 text-right">{t('fullQty')}</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.material_code} className="border-b last:border-0">
                  <td className="py-1 pr-2">{r.material_name || r.material_code}</td>
                  <td className="pr-2 text-gray-400">{r.unit}</td>
                  <td className="pr-2 text-right"><Input type="number" value={r.safety_qty === '' ? '' : String(r.safety_qty)} onChange={e => setVal(r.material_code, 'safety_qty', e.target.value)} className="w-24 h-8 text-right" placeholder="—" /></td>
                  <td className="pr-2 text-right"><Input type="number" value={r.full_qty === '' ? '' : String(r.full_qty)} onChange={e => setVal(r.material_code, 'full_qty', e.target.value)} className="w-24 h-8 text-right" placeholder="—" /></td>
                </tr>))}</tbody></table>
          </div>
        </Card>}

      <OverridesCard store={store} />
    </div>
  )
}

// ── 節慶／日期區間覆寫（可變安全量・滿倉量） ──
interface Override { id: string; material_code: string; label: string; start_date: string; end_date: string; safety_qty: number; full_qty: number }

function OverridesCard({ store }: { store: string }) {
  const t = useTranslations('StoreInventory')
  const locale = useLocale()
  const [rows, setRows] = useState<Override[]>([])
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  const [f, setF] = useState({ material_code: '', label: '', start_date: '', end_date: '', safety_qty: '' as number | '', full_qty: '' as number | '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch(`/api/inv/safety/overrides?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : { rows: [] })
      .then((d: { rows: Override[] }) => setRows(d.rows ?? []))
  }, [store, tick])

  const add = async () => {
    if (!f.material_code || !f.start_date || !f.end_date) { setMsg(t('materialAndDateRangeRequired')); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/inv/safety/overrides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, ...f, safety_qty: f.safety_qty || 0, full_qty: f.full_qty || 0 }),
    })
    setAdding(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? t('createFailed')); return }
    setF({ material_code: '', label: '', start_date: '', end_date: '', safety_qty: '', full_qty: '' })
    setTick(x => x + 1); setMsg(t('overrideAdded'))
  }
  const del = async (id: string) => {
    const res = await fetch('/api/inv/safety/overrides', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setTick(x => x + 1)
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm font-medium flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-primary" />{t('overridesTitle')}</div>
      <p className="text-xs text-gray-500">{t('overridesDesc')}</p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('materialCodeRequired')}</span><Input value={f.material_code} onChange={e => setF({ ...f, material_code: e.target.value })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('festivalName')}</span><Input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} className="h-8" placeholder={t('festivalPlaceholder')} /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('startDateRequired')}</span><Input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('endDateRequired')}</span><Input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('safetyQty')}</span><Input type="number" value={f.safety_qty === '' ? '' : String(f.safety_qty)} onChange={e => setF({ ...f, safety_qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('fullQty')}</span><Input type="number" value={f.full_qty === '' ? '' : String(f.full_qty)} onChange={e => setF({ ...f, full_qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Button size="sm" onClick={add} disabled={adding}>{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('addOverride')}</Button>
        {msg && <span className="text-sm text-blue-600">{msg}</span>}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">{t('materialCode')}</th><th className="pr-2">{t('festival')}</th><th className="pr-2">{t('dateRange')}</th><th className="pr-2 text-right">{t('safetyQty')}</th><th className="pr-2 text-right">{t('fullQty')}</th><th className="pr-2"></th></tr></thead>
            <tbody>{rows.map(o => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="py-1 pr-2">{o.material_code}</td>
                <td className="pr-2">{o.label || '—'}</td>
                <td className="pr-2 text-gray-500">{o.start_date} ~ {o.end_date}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(o.safety_qty, locale)}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(o.full_qty, locale)}</td>
                <td className="pr-2 text-right"><button onClick={() => del(o.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>))}</tbody></table>
        </div>
      )}
    </Card>
  )
}

// ── 通知設定（各角色聯絡管道＋到期通知天數） ──
const ROLE_KEYS: string[] = ['foreman', 'mgmt', 'audit', 'office']
type Contacts = Record<string, string>

function ForemanTab({ store }: { store: string }) {
  const t = useTranslations('StoreInventory')
  const ROLES: [string, string, string][] = ROLE_KEYS.map(key => [key, t(`role_${key}`), t(`role_${key}_desc`)])
  const [c, setC] = useState<Contacts>({})
  const [remind, setRemind] = useState({ staff: 7, audit: 3, mgmt: 1 })
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setMsg('')
    fetch(`/api/inv/store-contacts?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : {}).then(d => setC(d ?? {}))
    fetch('/api/inv/settings').then(r => r.ok ? r.json() : null).then(d => { if (d) setRemind({ staff: d.expiry_remind_staff ?? 7, audit: d.expiry_remind_audit ?? 3, mgmt: d.expiry_remind_mgmt ?? 1 }) })
  }, [store])

  const set = (k: string, v: string) => setC(p => ({ ...p, [k]: v }))
  const save = async () => {
    setSaving(true); setMsg('')
    const [r1, r2] = await Promise.all([
      fetch('/api/inv/store-contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, ...c }) }),
      fetch('/api/inv/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiry_remind_staff: remind.staff, expiry_remind_audit: remind.audit, expiry_remind_mgmt: remind.mgmt }) }),
    ])
    setSaving(false)
    setMsg(r1.ok && r2.ok ? t('saved') : t('saveFailed'))
  }
  const checkNow = async () => {
    setChecking(true); setMsg('')
    const res = await fetch('/api/inv/expiry/run', { method: 'POST' })
    setChecking(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? t('expiryChecked', { n: d.notified ?? 0 }) : (d.error ?? t('checkFailed')))
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium">{t('roleContactsTitle', { store })}</div>
        <p className="text-xs text-gray-500">{t('roleContactsDesc')}</p>
        <div className="space-y-3">
          {ROLES.map(([key, label, desc]) => (
            <div key={key} className="grid grid-cols-1 md:grid-cols-[10rem_1fr_1fr] gap-2 items-center">
              <div><div className="text-sm font-medium">{label}</div><div className="text-[11px] text-gray-400">{desc}</div></div>
              <Input placeholder="Telegram chat id" value={c[`${key}_telegram`] ?? ''} onChange={e => set(`${key}_telegram`, e.target.value)} className="h-8" />
              <Input placeholder="Email" value={c[`${key}_email`] ?? ''} onChange={e => set(`${key}_email`, e.target.value)} className="h-8" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium">{t('expiryRemindTitle')}</div>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('remindStaffLabel')}</span><Input type="number" value={String(remind.staff)} onChange={e => setRemind({ ...remind, staff: Number(e.target.value) || 0 })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('remindAuditLabel')}</span><Input type="number" value={String(remind.audit)} onChange={e => setRemind({ ...remind, audit: Number(e.target.value) || 0 })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">{t('remindMgmtLabel')}</span><Input type="number" value={String(remind.mgmt)} onChange={e => setRemind({ ...remind, mgmt: Number(e.target.value) || 0 })} className="h-8" /></label>
        </div>
        <p className="text-[11px] text-gray-400">{t('expiryRemindFootnote')}</p>
      </Card>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('save')}</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={checkNow} disabled={checking}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}{t('checkExpiryNow')}</Button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </div>
  )
}
