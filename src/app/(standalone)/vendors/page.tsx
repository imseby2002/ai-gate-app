'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Truck, ArrowLeft, Loader2, AlertCircle, Plus, Trash2, Save, Building2, Link2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')
const SERVICE_LABEL: Record<string, string> = { gas: '瓦斯', ice: '冰塊', '': '一般' }
const PAY_LABEL: Record<string, string> = { postpaid: '後付', prepaid: '預付', '': '—' }

interface Vendor {
  id: string; name: string; service: string; regions: string[]; fill_token: string; active: boolean
  tax_id: string; address: string; phone: string; contact: string; products: string
  pay_terms: string; billing_cycle: string; billing_day: number | null
}
interface Purchase { id: string; purchased_on: string; product: string; qty: number; amount: number; note: string }

export default function VendorsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    fetch('/api/fin/vendors').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() })
      .then(d => { if (d) { setVendors(d.vendors ?? []); setRegions(d.regions ?? []) } setLoading(false) })
  }, [tick])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅出納總務單位可使用廠商資料</p></div>
    </div>
  )
  const selected = vendors.find(v => v.id === sel) ?? null

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Truck className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">廠商資料</h1>
          <p className="text-sm text-gray-500">基本資料、付款結帳、採購紀錄與填報連結</p>
        </div>
        <div className="ml-auto"><Link href="/store-expenses"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />門市費用</Button></Link></div>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : selected ? <VendorDetail vendor={selected} regions={regions} onBack={() => setSel(null)} onSaved={reload} />
        : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋廠商名稱…" className="pl-9" /></div>
              <NewVendorButton onCreated={id => { reload(); setSel(id) }} />
            </div>
            {vendors.filter(v => !q || v.name.toLowerCase().includes(q.toLowerCase())).map(v => (
              <button key={v.id} onClick={() => setSel(v.id)} className="text-left w-full">
                <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="font-medium">{v.name}</span>
                      <span className="text-[11px] px-1.5 rounded bg-gray-100 text-gray-500">{SERVICE_LABEL[v.service] ?? '一般'}</span>
                      {!v.active && <span className="text-xs text-red-400">停用</span>}
                    </div>
                    <div className="text-xs text-gray-400">{v.tax_id ? `統編 ${v.tax_id}・` : ''}{v.products || '（未填產品）'}</div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{PAY_LABEL[v.pay_terms] ?? ''}{v.billing_cycle ? `・${v.billing_cycle}` : ''}</span>
                </Card>
              </button>
            ))}
            {vendors.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">尚無廠商</div>}
          </div>
        )}
    </div>
  )
}

function NewVendorButton({ onCreated }: { onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    const res = await fetch('/api/fin/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '新廠商', service: '' }) })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok && d.id) onCreated(d.id); else alert(d.error ?? '新增失敗')
  }
  return <Button size="sm" className="gap-1.5 shrink-0" onClick={add} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}新增廠商</Button>
}

function VendorDetail({ vendor, regions, onBack, onSaved }: { vendor: Vendor; regions: string[]; onBack: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Vendor>({ ...vendor })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (patch: Partial<Vendor>) => setF(p => ({ ...p, ...patch }))

  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/fin/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    setSaving(false); setMsg(res.ok ? '已儲存' : '儲存失敗'); if (res.ok) onSaved()
  }
  const remove = async () => {
    if (!confirm(`刪除廠商「${f.name}」？`)) return
    await fetch('/api/fin/vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id }) })
    onSaved(); onBack()
  }
  const copyLink = () => { navigator.clipboard?.writeText(`${location.origin}/vendor/${f.fill_token}`); setMsg('已複製填報連結') }
  const toggleRegion = (r: string) => set({ regions: f.regions.includes(r) ? f.regions.filter(x => x !== r) : [...f.regions, r] })

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />返回清單</button>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">基本資料</h3>
          <div className="flex items-center gap-2">{msg && <span className="text-xs text-gray-500">{msg}</span>}
            <button onClick={remove} className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"><Trash2 className="h-4 w-4" />刪除</button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存</Button></div>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          <label className="space-y-1"><span className="text-xs text-gray-500">廠商名稱</span><Input value={f.name} onChange={e => set({ name: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">統編</span><Input value={f.tax_id} onChange={e => set({ tax_id: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">類別</span>
            <select value={f.service} onChange={e => set({ service: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              <option value="">一般</option><option value="gas">瓦斯</option><option value="ice">冰塊</option>
            </select></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">聯絡人</span><Input value={f.contact} onChange={e => set({ contact: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">電話</span><Input value={f.phone} onChange={e => set({ phone: e.target.value })} className="h-9" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">地址</span><Input value={f.address} onChange={e => set({ address: e.target.value })} className="h-9" /></label>
          <label className="space-y-1 md:col-span-3"><span className="text-xs text-gray-500">產品</span><Input value={f.products} onChange={e => set({ products: e.target.value })} className="h-9" placeholder="如：珍珠、糖漿、奶精…" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">付款方式</span>
            <select value={f.pay_terms} onChange={e => set({ pay_terms: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              <option value="">—</option><option value="postpaid">後付</option><option value="prepaid">預付</option>
            </select></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">結帳週期</span><Input value={f.billing_cycle} onChange={e => set({ billing_cycle: e.target.value })} className="h-9" placeholder="如 月結／週結" /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">結帳日（1-31）</span><Input type="number" value={f.billing_day ? String(f.billing_day) : ''} onChange={e => set({ billing_day: Number(e.target.value) || null })} className="h-9" /></label>
        </div>
        {f.service === 'ice' && (
          <div className="space-y-1">
            <span className="text-xs text-gray-500">涵蓋區域（冰塊）</span>
            <div className="flex flex-wrap gap-1">
              {regions.length === 0 && <span className="text-xs text-gray-400">尚無區域</span>}
              {regions.map(r => <button key={r} onClick={() => toggleRegion(r)} className={`text-xs px-2 py-1 rounded border ${f.regions.includes(r) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600'}`}>{r}</button>)}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={f.active} onChange={e => set({ active: e.target.checked })} />啟用</label>
          <button onClick={copyLink} className="flex items-center gap-1 text-primary ml-auto"><Link2 className="h-3.5 w-3.5" />複製廠商填報連結</button>
        </div>
      </Card>

      <PurchaseSection vendorId={f.id} />
    </div>
  )
}

function PurchaseSection({ vendorId }: { vendorId: string }) {
  const [rows, setRows] = useState<Purchase[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ purchased_on: new Date().toISOString().slice(0, 10), product: '', qty: '', amount: '', note: '' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/fin/vendor-purchases?vendor_id=${vendorId}`).then(r => r.ok ? r.json() : { purchases: [], total: 0 }).then(d => { setRows(d.purchases ?? []); setTotal(d.total ?? 0); setLoading(false) })
  }, [vendorId, tick])

  const add = async () => {
    const res = await fetch('/api/fin/vendor-purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, ...f }) })
    if (res.ok) { setAdding(false); setF({ purchased_on: new Date().toISOString().slice(0, 10), product: '', qty: '', amount: '', note: '' }); setTick(t => t + 1) }
    else alert((await res.json().catch(() => ({}))).error ?? '新增失敗')
  }
  const remove = async (id: string) => { await fetch('/api/fin/vendor-purchases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); setTick(t => t + 1) }

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">採購紀錄 <span className="text-xs text-gray-400 font-normal">總額 {fmt(total)}・{rows.length} 筆</span></h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(a => !a)}>{adding ? '取消' : '＋新增紀錄'}</Button>
      </div>
      {adding && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 border rounded-lg p-3 bg-gray-50">
          <Input type="date" value={f.purchased_on} onChange={e => setF({ ...f, purchased_on: e.target.value })} className="h-9" />
          <Input value={f.product} onChange={e => setF({ ...f, product: e.target.value })} placeholder="產品" className="h-9" />
          <Input type="number" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} placeholder="數量" className="h-9" />
          <Input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="金額" className="h-9" />
          <Button size="sm" onClick={add}>儲存</Button>
        </div>
      )}
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <p className="text-xs text-gray-400">尚無採購紀錄</p>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">日期</th><th className="pr-2">產品</th><th className="pr-2 text-right">數量</th><th className="pr-2 text-right">金額</th><th className="pr-2"></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-1.5 pr-2">{r.purchased_on}</td>
              <td className="pr-2">{r.product}</td>
              <td className="pr-2 text-right tabular-nums">{fmt(r.qty)}</td>
              <td className="pr-2 text-right tabular-nums">{fmt(r.amount)}</td>
              <td className="pr-2 text-right"><button onClick={() => remove(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
            </tr>))}</tbody></table></div>}
    </Card>
  )
}
