'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Truck, ArrowLeft, Loader2, AlertCircle, Plus, Trash2, Save, Building2, Link2, Search, FileSpreadsheet, TrendingDown, ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExcelImportModal } from '@/components/common/ExcelImportModal'
import type { ImportColumn } from '@/lib/excel/universal-import'

const fmt = (n: number, locale: string) => Math.round(Number(n) || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

const VENDOR_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'name', label: '廠商名稱', required: true, example: '台灣茶葉供應商', aliases: ['name', '廠商名稱', '廠商'] },
  { key: 'tax_id', label: '統一編號', example: '12345678', aliases: ['tax_id', '統編', '統一編號'] },
  { key: 'service', label: '類別', example: '一般', aliases: ['service', '類別', '服務項目'] },
  { key: 'contact', label: '聯絡人', example: '陳先生', aliases: ['contact', '聯絡人'] },
  { key: 'phone', label: '電話', example: '02-23456789', aliases: ['phone', '電話', '手機'] },
  { key: 'address', label: '地址', example: '台北市大安區...', aliases: ['address', '地址'] },
  { key: 'products', label: '提供產品', example: '茶葉、原物料', aliases: ['products', '產品', '供應品項'] },
  { key: 'pay_terms', label: '付款方式', example: '後付', aliases: ['pay_terms', '付款方式'] },
  { key: 'billing_cycle', label: '結帳週期', example: '月結', aliases: ['billing_cycle', '結帳週期', '週期'] },
  { key: 'billing_day', label: '結帳日', example: 25, aliases: ['billing_day', '結帳日'] },
  { key: 'active', label: '啟用狀態', example: '是', aliases: ['active', '啟用', '狀態'] },
]

const PURCHASE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'purchased_on', label: '採購日期', required: true, example: '2026-03-01', aliases: ['purchased_on', '採購日期', '日期'] },
  { key: 'product', label: '採購品項', required: true, example: '高級錫蘭紅茶', aliases: ['product', '採購品項', '產品', '品項'] },
  { key: 'qty', label: '數量', example: 50, aliases: ['qty', '數量'] },
  { key: 'amount', label: '金額', required: true, example: 25000, aliases: ['amount', '金額', '小計'] },
  { key: 'note', label: '備註', example: '第一批進貨', aliases: ['note', '備註'] },
]

interface Vendor {
  id: string; name: string; service: string; regions: string[]; fill_token: string; active: boolean
  tax_id: string; address: string; phone: string; contact: string; products: string
  pay_terms: string; billing_cycle: string; billing_day: number | null
}
interface Purchase { id: string; purchased_on: string; product: string; qty: number; amount: number; note: string }

export default function VendorsPage() {
  const t = useTranslations('Vendors')
  const SERVICE_LABEL: Record<string, string> = { gas: t('serviceGas'), electric: t('serviceElectric'), water: t('serviceWater'), ice: t('serviceIce'), '': t('serviceGeneral') }
  const PAY_LABEL: Record<string, string> = { postpaid: t('payPostpaid'), prepaid: t('payPrepaid'), '': '—' }
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = () => setTick(x => x + 1)

  useEffect(() => {
    fetch('/api/fin/vendors').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() })
      .then(d => { if (d) { setVendors(d.vendors ?? []); setRegions(d.regions ?? []) } setLoading(false) })
  }, [tick])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">{t('adminOnly')}</p></div>
    </div>
  )
  const selected = vendors.find(v => v.id === sel) ?? null

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Truck className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/finance"><Button variant="outline" size="sm" className="gap-1.5"><Wallet className="h-4 w-4" />{t('finance')}</Button></Link>
          <Link href="/store-expenses"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />{t('storeExpenses')}</Button></Link>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入 / 更新廠商資料"
          description="支援 .xlsx, .xls 與 .csv 檔案。若統編或廠商名稱相符將自動更新，否則新增。"
          columns={VENDOR_IMPORT_COLUMNS}
          templateFilename="廠商資料範本"
          sheetName="廠商名冊"
          onClose={() => setShowImport(false)}
          onSuccess={reload}
          onSubmit={async rows => {
            const res = await fetch('/api/fin/vendors/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rows }),
            })
            return await res.json()
          }}
        />
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : selected ? <VendorDetail vendor={selected} regions={regions} onBack={() => setSel(null)} onSaved={reload} />
        : (
          <div className="space-y-3">
            <PriceCompareBox />
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" /></div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setShowImport(true)}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />{t('bulkImport')}
              </Button>
              <NewVendorButton onCreated={id => { reload(); setSel(id) }} />
            </div>
            {vendors.filter(v => !q || v.name.toLowerCase().includes(q.toLowerCase())).map(v => (
              <button key={v.id} onClick={() => setSel(v.id)} className="text-left w-full">
                <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium">{v.name}</span>
                      <span className="text-[11px] px-1.5 rounded bg-gray-100 text-gray-500">{SERVICE_LABEL[v.service] ?? t('serviceGeneral')}</span>
                      {!v.active && <span className="text-xs text-red-400">{t('inactive')}</span>}
                    </div>
                    <div className="text-xs text-gray-400">{v.tax_id ? t('taxIdPrefix', { taxId: v.tax_id }) : ''}{v.products || t('noProducts')}</div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{PAY_LABEL[v.pay_terms] ?? ''}{v.billing_cycle ? `・${v.billing_cycle}` : ''}</span>
                </Card>
              </button>
            ))}
            {vendors.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">{t('empty')}</div>}
          </div>
        )}
    </div>
  )
}

function NewVendorButton({ onCreated }: { onCreated: (id: string) => void }) {
  const t = useTranslations('Vendors')
  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    const res = await fetch('/api/fin/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: t('newVendorName'), service: '' }) })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok && d.id) onCreated(d.id); else alert(d.error ?? t('createFailed'))
  }
  return <Button size="sm" className="gap-1.5 shrink-0" onClick={add} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t('newVendor')}</Button>
}

// ── 採購比價建議（模糊比對歷史採購紀錄，跨廠商）──
interface CompareResult {
  vendorId: string; vendorName: string; matchCount: number; bestMatchProduct: string
  latest: { product: string; unitPrice: number; qty: number; amount: number; purchasedOn: string }
  minUnitPrice: number; avgUnitPrice: number
}

function PriceCompareBox() {
  const t = useTranslations('Vendors')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CompareResult[] | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const search = async () => {
    if (!query.trim()) return
    setLoading(true); setErr(''); setResults(null)
    try {
      const res = await fetch(`/api/fin/vendor-purchases/compare?q=${encodeURIComponent(query.trim())}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? t('queryFailed'))
      setResults(d.results ?? [])
      setNote(d.note ?? '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-primary" />{t('priceCompareTitle')}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="pt-3 space-y-3">
          <div className="flex gap-2">
            <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder={t('priceComparePlaceholder')} className="flex-1" />
            <Button size="sm" onClick={search} disabled={loading || !query.trim()}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('query')}</Button>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          {results && (
            results.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('priceCompareEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {results.map(r => (
                  <div key={r.vendorId} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{r.vendorName}</div>
                      <div className="text-xs text-muted-foreground truncate">{t('priceCompareLatest', { product: r.latest.product, date: r.latest.purchasedOn, count: r.matchCount })}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold tabular-nums">{fmt(r.latest.unitPrice, locale)}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{t('priceCompareStats', { min: fmt(r.minUnitPrice, locale), avg: fmt(r.avgUnitPrice, locale) })}</div>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{note}</p>
              </div>
            )
          )}
        </div>
      )}
    </Card>
  )
}

function VendorDetail({ vendor, regions, onBack, onSaved }: { vendor: Vendor; regions: string[]; onBack: () => void; onSaved: () => void }) {
  const t = useTranslations('Vendors')
  const [f, setF] = useState<Vendor>({ ...vendor })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (patch: Partial<Vendor>) => setF(p => ({ ...p, ...patch }))

  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/fin/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    setSaving(false); setMsg(res.ok ? t('saved') : t('saveFailed')); if (res.ok) onSaved()
  }
  const remove = async () => {
    if (!confirm(t('confirmDeleteVendor', { name: f.name }))) return
    await fetch('/api/fin/vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id }) })
    onSaved(); onBack()
  }
  const copyLink = () => { navigator.clipboard?.writeText(`${location.origin}/vendor/${f.fill_token}`); setMsg(t('linkCopied')) }
  const toggleRegion = (r: string) => set({ regions: f.regions.includes(r) ? f.regions.filter(x => x !== r) : [...f.regions, r] })

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />{t('backToList')}</button>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">{t('basicInfo')}</h3>
          <div className="flex items-center gap-2">{msg && <span className="text-xs text-gray-500">{msg}</span>}
            <button onClick={remove} className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"><Trash2 className="h-4 w-4" />{t('delete')}</button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('save')}</Button></div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('vendorName')}</span><Input value={f.name} onChange={e => set({ name: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('taxId')}</span><Input value={f.tax_id} onChange={e => set({ tax_id: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('serviceType')}</span>
            <select value={f.service} onChange={e => set({ service: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              <option value="">{t('serviceGeneralVendor')}</option>
              <option value="electric">{t('serviceElectricOption')}</option>
              <option value="water">{t('serviceWaterOption')}</option>
              <option value="gas">{t('serviceGasOption')}</option>
              <option value="ice">{t('serviceIceOption')}</option>
            </select></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('contact')}</span><Input value={f.contact} onChange={e => set({ contact: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('phone')}</span><Input value={f.phone} onChange={e => set({ phone: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('address')}</span><Input value={f.address} onChange={e => set({ address: e.target.value })} className="h-9" /></label>
          <label className="space-y-1 md:col-span-3"><span className="text-xs text-gray-500">{t('products')}</span><Input value={f.products} onChange={e => set({ products: e.target.value })} className="h-9" placeholder={t('productsPlaceholder')} /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('payTerms')}</span>
            <select value={f.pay_terms} onChange={e => set({ pay_terms: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              <option value="">—</option><option value="postpaid">{t('payPostpaid')}</option><option value="prepaid">{t('payPrepaid')}</option>
            </select></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('billingCycle')}</span><Input value={f.billing_cycle} onChange={e => set({ billing_cycle: e.target.value })} className="h-9" placeholder={t('billingCyclePlaceholder')} /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">{t('billingDay')}</span><Input type="number" value={f.billing_day ? String(f.billing_day) : ''} onChange={e => set({ billing_day: Number(e.target.value) || null })} className="h-9" /></label>
        </div>
        {['gas', 'ice'].includes(f.service) && (
          <div className="space-y-1">
            <span className="text-xs text-gray-500">
              {f.service === 'gas' ? t('deliveryRegionGas') : t('deliveryRegionIce')}
            </span>
            <div className="flex flex-wrap gap-1">
              {regions.length === 0 && <span className="text-xs text-gray-400">{t('noRegions')}</span>}
              {regions.map(r => <button key={r} type="button" onClick={() => toggleRegion(r)} className={`text-xs px-2 py-1 rounded border ${f.regions.includes(r) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600'}`}>{r}</button>)}
            </div>
          </div>
        )}
        {['electric', 'water'].includes(f.service) && (
          <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border">
            📌 {f.service === 'electric' ? t('utilityNoticeElectric') : t('utilityNoticeWater')}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={f.active} onChange={e => set({ active: e.target.checked })} />{t('active')}</label>
          <button onClick={copyLink} className="flex items-center gap-1 text-primary ml-auto"><Link2 className="h-3.5 w-3.5" />{t('copyFillLink')}</button>
        </div>
      </Card>

      <PurchaseSection vendorId={f.id} />
    </div>
  )
}

function PurchaseSection({ vendorId }: { vendorId: string }) {
  const t = useTranslations('Vendors')
  const locale = useLocale()
  const [rows, setRows] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [f, setF] = useState({ purchased_on: new Date().toISOString().slice(0, 10), product: '', qty: '', amount: '', note: '' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/fin/vendor-purchases?vendor_id=${vendorId}`).then(r => r.ok ? r.json() : { purchases: [], total: 0 }).then(d => { setRows(d.purchases ?? []); setTotal(d.total ?? 0); setLoading(false) })
  }, [vendorId, tick])

  const add = async () => {
    const res = await fetch('/api/fin/vendor-purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, ...f }) })
    if (res.ok) { setAdding(false); setF({ purchased_on: new Date().toISOString().slice(0, 10), product: '', qty: '', amount: '', note: '' }); setTick(x => x + 1) }
    else alert((await res.json().catch(() => ({}))).error ?? t('createFailed'))
  }
  const remove = async (id: string) => { await fetch('/api/fin/vendor-purchases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); setTick(x => x + 1) }

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm">{t('purchaseRecords')} <span className="text-xs text-gray-400 font-normal">{t('purchaseTotal', { total: fmt(total, locale), count: rows.length })}</span></h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />{t('bulkImportPurchase')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(a => !a)}>{adding ? t('cancel') : t('addRecord')}</Button>
        </div>
      </div>

      {showImport && (
        <ExcelImportModal
          title="批次匯入採購紀錄"
          description="支援 .xlsx, .xls 與 .csv 檔案。請填寫採購日期、採購品項與金額。"
          columns={PURCHASE_IMPORT_COLUMNS}
          templateFilename="採購紀錄範本"
          sheetName="採購清單"
          onClose={() => setShowImport(false)}
          onSuccess={() => setTick(x => x + 1)}
          onSubmit={async rows => {
            const res = await fetch('/api/fin/vendor-purchases/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vendor_id: vendorId, rows }),
            })
            return await res.json()
          }}
        />
      )}
      {adding && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 border rounded-lg p-3 bg-gray-50">
          <Input type="date" value={f.purchased_on} onChange={e => setF({ ...f, purchased_on: e.target.value })} className="h-9" />
          <Input value={f.product} onChange={e => setF({ ...f, product: e.target.value })} placeholder={t('product')} className="h-9" />
          <Input type="number" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} placeholder={t('qty')} className="h-9" />
          <Input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder={t('amount')} className="h-9" />
          <Button size="sm" onClick={add}>{t('save')}</Button>
        </div>
      )}
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <p className="text-xs text-gray-400">{t('noPurchaseRecords')}</p>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">{t('date')}</th><th className="pr-2">{t('product')}</th><th className="pr-2 text-right">{t('qty')}</th><th className="pr-2 text-right">{t('amount')}</th><th className="pr-2"></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-1.5 pr-2">{r.purchased_on}</td>
              <td className="pr-2">{r.product}</td>
              <td className="pr-2 text-right tabular-nums">{fmt(r.qty, locale)}</td>
              <td className="pr-2 text-right tabular-nums">{fmt(r.amount, locale)}</td>
              <td className="pr-2 text-right"><button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
            </tr>))}</tbody></table></div>}
    </Card>
  )
}
