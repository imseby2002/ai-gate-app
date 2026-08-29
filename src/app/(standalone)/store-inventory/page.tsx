'use client'

import { useState, useEffect, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ClipboardList, Upload, Download, Loader2, AlertCircle, Store, Save, Bell, ShieldAlert, PackageCheck, History, Boxes, CalendarClock, Trash2, Plus, Ban, PackageMinus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'count' | 'batch' | 'loss' | 'safety' | 'foreman'
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('zh-TW')

interface Material { material_code: string; material_name: string; unit: string; book_qty: number }
interface CountRow { material_code: string; material_name: string; unit: string; book_qty: number; counted: number | '' }
interface OrderRow { material_code: string; material_name: string; unit: string; counted: number; safety: number; full: number; order_qty: number; urgent: boolean }
interface SafetyRow { material_code: string; material_name: string; unit: string; safety_qty: number | ''; full_qty: number | '' }
interface Stocktake { id: string; store: string; taken_on: string; note: string }

export default function StoreInventoryPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('count')
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')

  useEffect(() => {
    fetch('/api/inv/stores').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() })
      .then(d => { if (d) { setStores(d.stores ?? []); setStore(s => s || (d.stores?.[0] ?? '')) } })
  }, [])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅門市單位可使用門市盤點</p></div>
    </div>
  )

  const TABS: [Tab, string, ReactNode][] = [
    ['count', '盤點・訂貨', <ClipboardList key="a" className="h-4 w-4" />],
    ['batch', '原料・批次', <Boxes key="d" className="h-4 w-4" />],
    ['loss', '耗損', <PackageMinus key="e" className="h-4 w-4" />],
    ['safety', '安全庫存', <ShieldAlert key="b" className="h-4 w-4" />],
    ['foreman', '通知設定', <Bell key="c" className="h-4 w-4" />],
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">門市盤點・訂貨</h1>
          <p className="text-sm text-gray-500">每日盤點 → 補到滿倉自動產生訂貨表；低於安全量緊急通知領班</p>
        </div>
        <div className="ml-auto"><Link href="/store-reports"><Button variant="outline" size="sm" className="gap-1.5"><Store className="h-4 w-4" />門市報表</Button></Link></div>
      </div>

      <Card className="p-3">
        <label className="space-y-1 inline-block">
          <span className="block text-xs text-gray-500">門市</span>
          <Input list="inv-store-list" value={store} onChange={e => setStore(e.target.value)} placeholder="門市（如 YL）" className="w-40" />
          <datalist id="inv-store-list">{stores.map(s => <option key={s} value={s} />)}</datalist>
        </label>
      </Card>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === id ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {!store ? <div className="text-center py-10 text-gray-400 text-sm">請先選擇門市（需已匯入進銷存）。</div>
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
    setMsg('解析中…')
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/inv/stocktake/parse', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? '解析失敗'); return }
    const counts = new Map<string, number>((d.items ?? []).map((it: { material_code: string; counted_qty: number }) => [it.material_code, it.counted_qty]))
    setRows(p => {
      const merged = p.map(r => counts.has(r.material_code) ? { ...r, counted: counts.get(r.material_code)! } : r)
      const known = new Set(p.map(r => r.material_code))
      for (const it of (d.items ?? []) as { material_code: string; material_name: string; unit: string; counted_qty: number }[]) {
        if (!known.has(it.material_code)) merged.push({ material_code: it.material_code, material_name: it.material_name, unit: it.unit, book_qty: 0, counted: it.counted_qty })
      }
      return merged
    })
    setMsg(`已帶入 ${d.items?.length ?? 0} 筆實盤數`)
  }

  const save = async () => {
    const items = rows.filter(r => r.counted !== '').map(r => ({ material_code: r.material_code, material_name: r.material_name, unit: r.unit, counted_qty: Number(r.counted) }))
    if (items.length === 0) { setMsg('請至少填一筆實盤數'); return }
    setSaving(true); setMsg('')
    const res = await fetch('/api/inv/stocktake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, items }) })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? '儲存失敗'); return }
    setResult(d); setTick(t => t + 1)
    setMsg(d.urgent_count > 0 ? `已儲存。⚠️ ${d.urgent_count} 項低於安全量${d.notified ? '，已通知領班' : '（未設領班管道）'}` : '已儲存')
  }

  const viewHistory = async (id: string) => {
    const res = await fetch(`/api/inv/stocktake?id=${id}`)
    if (res.ok) { const d = await res.json(); setResult({ id, order: d.order ?? [], urgent_count: (d.order ?? []).filter((o: OrderRow) => o.urgent).length, notified: false }) }
  }
  const resend = async (id: string) => {
    const res = await fetch('/api/inv/stocktake/alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? (d.notified ? `已通知領班（${d.urgent_count} 項）` : '目前無緊急項目或未設領班管道') : (d.error ?? '通知失敗'))
  }

  const orderRows = (result?.order ?? []).filter(o => o.order_qty > 0)

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={uploadFilled} />
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/api/inv/stocktake/xlsx?kind=template&store=${encodeURIComponent(store)}`)}><Download className="h-4 w-4" />下載空白盤點表</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />上傳已填盤點表</Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存盤點並產生訂貨</Button>
        {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">此門市尚無原料資料，請先於「門市報表」匯入進銷存。</div>
        : <Card className="p-4">
          <h3 className="font-semibold mb-2 text-sm">實盤輸入（{rows.length} 項）</h3>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">帳面庫存</th><th className="pr-2 text-right">實盤數量</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.material_code} className="border-b last:border-0">
                  <td className="py-1 pr-2">{r.material_name || r.material_code}</td>
                  <td className="pr-2 text-gray-400">{r.unit}</td>
                  <td className="pr-2 text-right tabular-nums text-gray-400">{fmt(r.book_qty)}</td>
                  <td className="pr-2 text-right"><Input type="number" value={r.counted === '' ? '' : String(r.counted)} onChange={e => setCount(r.material_code, e.target.value)} className="w-24 h-8 text-right" placeholder="—" /></td>
                </tr>))}</tbody></table>
          </div>
        </Card>}

      {result && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">訂貨表（補到滿倉，{orderRows.length} 項）</h3>
            <div className="ml-auto flex gap-2">
              {result.urgent_count > 0 && <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" onClick={() => resend(result.id)}><Bell className="h-4 w-4" />通知領班（{result.urgent_count} 緊急）</Button>}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/api/inv/stocktake/xlsx?kind=order&id=${result.id}`)}><Download className="h-4 w-4" />下載訂貨表</Button>
            </div>
          </div>
          {orderRows.length === 0 ? <p className="text-sm text-gray-400">目前庫存皆已達滿倉，無需訂貨。</p>
            : <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">實盤</th><th className="pr-2 text-right">安全量</th><th className="pr-2 text-right">滿倉量</th><th className="pr-2 text-right">訂貨量</th></tr></thead>
                <tbody>{orderRows.map(o => (
                  <tr key={o.material_code} className={`border-b last:border-0 ${o.urgent ? 'bg-red-50' : ''}`}>
                    <td className="py-1 pr-2">{o.material_name || o.material_code}{o.urgent && <span className="ml-1 text-[11px] text-red-600">緊急</span>}</td>
                    <td className="pr-2 text-gray-400">{o.unit}</td>
                    <td className={`pr-2 text-right tabular-nums ${o.urgent ? 'text-red-600 font-medium' : ''}`}>{fmt(o.counted)}</td>
                    <td className="pr-2 text-right tabular-nums text-gray-400">{fmt(o.safety)}</td>
                    <td className="pr-2 text-right tabular-nums text-gray-400">{fmt(o.full)}</td>
                    <td className="pr-2 text-right tabular-nums font-medium text-blue-600">{fmt(o.order_qty)}</td>
                  </tr>))}</tbody></table>
            </div>}
        </Card>
      )}

      {history.length > 0 && (
        <Card className="p-3">
          <div className="text-sm font-medium flex items-center gap-1.5 mb-2"><History className="h-4 w-4 text-gray-400" />盤點歷史</div>
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
    if (!f.material_code || !f.expiry_date) { setMsg('原料碼與到期日必填'); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/inv/batches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, ...f, qty: f.qty || 0 }),
    })
    setAdding(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? '新增失敗'); return }
    setF({ material_code: '', material_name: '', unit: '', purchase_date: '', expiry_date: '', qty: '' })
    setTick(t => t + 1); setMsg('已新增批次')
  }
  const del = async (id: string) => {
    const res = await fetch('/api/inv/batches', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setTick(t => t + 1)
  }
  const scrap = async (b: Batch) => {
    if (!confirm(`報廢「${b.material_name || b.material_code}」此批次（數量 ${fmt(b.qty)}）？將自動放入耗損並扣庫存。`)) return
    setMsg('')
    const res = await fetch('/api/inv/batches/scrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, reason: 'expired' }) })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? '已報廢並放入耗損' : (d.error ?? '報廢失敗'))
    if (res.ok) setTick(t => t + 1)
  }
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setMsg('匯入中…')
    const fd = new FormData(); fd.append('file', file); fd.append('store', store)
    const res = await fetch('/api/inv/import/batches', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `匯入 ${d.imported} 筆${d.skipped ? `（略過 ${d.skipped} 筆無到期日）` : ''}` : (d.error ?? '匯入失敗'))
    if (res.ok) setTick(t => t + 1)
  }

  // 到期狀態底色：已過期紅、7 天內橘、30 天內黃
  const rowClass = (d: number | null) => d === null ? '' : d < 0 ? 'bg-red-50' : d <= 7 ? 'bg-orange-50' : d <= 30 ? 'bg-amber-50' : ''
  const dLabel = (d: number | null) => d === null ? '—' : d < 0 ? `已過期 ${-d} 天` : d === 0 ? '今天到期' : `${d} 天`

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={upload} />
      <p className="text-xs text-gray-500">每批進貨各自記到期日；到期前依「單位設定」的天數分級通知。到期當天請在此改走「耗損」報廢（下一階段）。</p>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium flex items-center gap-1.5"><Plus className="h-4 w-4 text-primary" />新增進貨批次</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">原料碼*</span><Input value={f.material_code} onChange={e => setF({ ...f, material_code: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">名稱</span><Input value={f.material_name} onChange={e => setF({ ...f, material_name: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">單位</span><Input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">進貨日</span><Input type="date" value={f.purchase_date} onChange={e => setF({ ...f, purchase_date: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">到期日*</span><Input type="date" value={f.expiry_date} onChange={e => setF({ ...f, expiry_date: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">數量</span><Input type="number" value={f.qty === '' ? '' : String(f.qty)} onChange={e => setF({ ...f, qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button size="sm" onClick={add} disabled={adding}>{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}新增</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/api/inv/batches/xlsx?store=${encodeURIComponent(store)}`)}><Download className="h-4 w-4" />下載批次表</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />上傳批次表</Button>
          {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
        </div>
      </Card>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">尚無進貨批次，於上方新增或上傳批次表。</div>
        : <Card className="p-4">
          <div className="text-sm font-medium flex items-center gap-1.5 mb-2"><CalendarClock className="h-4 w-4 text-gray-400" />進貨批次（{rows.length} 筆，依到期日排序）</div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2">進貨日</th><th className="pr-2">到期日</th><th className="pr-2 text-right">數量</th><th className="pr-2 text-right">剩餘</th><th className="pr-2"></th></tr></thead>
              <tbody>{rows.map(b => (
                <tr key={b.id} className={`border-b last:border-0 ${rowClass(b.days_to_expiry)}`}>
                  <td className="py-1 pr-2">{b.material_name || b.material_code}</td>
                  <td className="pr-2 text-gray-400">{b.unit}</td>
                  <td className="pr-2 text-gray-500">{b.purchase_date ?? '—'}</td>
                  <td className="pr-2 font-medium">{b.expiry_date}</td>
                  <td className="pr-2 text-right tabular-nums">{fmt(b.qty)}</td>
                  <td className={`pr-2 text-right tabular-nums ${b.days_to_expiry !== null && b.days_to_expiry <= 7 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{dLabel(b.days_to_expiry)}</td>
                  <td className="pr-2 text-right whitespace-nowrap">
                    <button onClick={() => scrap(b)} title="報廢並放入耗損" className="text-gray-400 hover:text-orange-600 mr-2 align-middle"><Ban className="h-4 w-4 inline" /></button>
                    <button onClick={() => del(b.id)} title="刪除（輸入錯誤）" className="text-gray-300 hover:text-red-500 align-middle"><Trash2 className="h-4 w-4 inline" /></button>
                  </td>
                </tr>))}</tbody></table>
          </div>
        </Card>}
    </div>
  )
}

// ── 耗損（報廢／丟棄，扣庫存） ──
interface Loss { id: string; material_code: string; material_name: string; unit: string; qty: number; reason: string; loss_date: string; batch_id: string | null; note: string }
const REASON_LABEL: Record<string, string> = { expired: '過期', damaged: '損壞', other: '其他' }
const IVT_CANCEL_URL = 'https://ivt.ipos.vn/good-issue/cancel'

function LossTab({ store }: { store: string }) {
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
    if (!f.material_code) { setMsg('原料碼必填'); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/inv/losses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, ...f, qty: f.qty || 0 }) })
    setAdding(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? '新增失敗'); return }
    setF({ material_code: '', material_name: '', unit: '', qty: '', reason: 'damaged', loss_date: '', note: '' })
    setTick(t => t + 1); setMsg('已新增耗損')
  }
  const del = async (id: string) => {
    const res = await fetch('/api/inv/losses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setTick(t => t + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>耗損（過期報廢或丟棄）系統會扣庫存並留存於此；IVT 無耗損上傳功能，請另於 IVT 手動填寫。
          <a href={IVT_CANCEL_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 ml-1 underline font-medium">IVT 耗損填寫<ExternalLink className="h-3 w-3" /></a>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium flex items-center gap-1.5"><Plus className="h-4 w-4 text-primary" />新增耗損（獨立填報；批次過期請於「原料・批次」按報廢）</div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">原料碼*</span><Input value={f.material_code} onChange={e => setF({ ...f, material_code: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">名稱</span><Input value={f.material_name} onChange={e => setF({ ...f, material_name: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">單位</span><Input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">數量</span><Input type="number" value={f.qty === '' ? '' : String(f.qty)} onChange={e => setF({ ...f, qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">原因</span>
            <select value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="damaged">損壞</option><option value="expired">過期</option><option value="other">其他</option>
            </select>
          </label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">日期</span><Input type="date" value={f.loss_date} onChange={e => setF({ ...f, loss_date: e.target.value })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">備註</span><Input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} className="h-8" /></label>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button size="sm" onClick={add} disabled={adding}>{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}新增耗損</Button>
          {msg && <span className="text-sm text-blue-600">{msg}</span>}
        </div>
      </Card>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">尚無耗損紀錄。</div>
        : <Card className="p-4">
          <div className="text-sm font-medium flex items-center gap-1.5 mb-2"><PackageMinus className="h-4 w-4 text-gray-400" />耗損紀錄（{rows.length} 筆）</div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">日期</th><th className="pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">數量</th><th className="pr-2">原因</th><th className="pr-2">來源</th><th className="pr-2">備註</th><th className="pr-2"></th></tr></thead>
              <tbody>{rows.map(l => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-1 pr-2 text-gray-500">{l.loss_date}</td>
                  <td className="pr-2">{l.material_name || l.material_code}</td>
                  <td className="pr-2 text-gray-400">{l.unit}</td>
                  <td className="pr-2 text-right tabular-nums">{fmt(l.qty)}</td>
                  <td className="pr-2">{REASON_LABEL[l.reason] ?? l.reason}</td>
                  <td className="pr-2 text-gray-400">{l.batch_id ? '批次報廢' : '手動'}</td>
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
    setMsg(`帶入 ${add.length} 項原料`)
  }
  const setVal = (code: string, key: 'safety_qty' | 'full_qty', v: string) =>
    setRows(p => p.map(r => r.material_code === code ? { ...r, [key]: v === '' ? '' : Number(v) } : r))

  const save = async () => {
    setSaving(true); setMsg('')
    const payload = rows.map(r => ({ material_code: r.material_code, material_name: r.material_name, unit: r.unit, safety_qty: r.safety_qty || 0, full_qty: r.full_qty || 0 }))
    const res = await fetch('/api/inv/safety', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, rows: payload }) })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `已儲存 ${d.saved ?? 0} 項` : (d.error ?? '儲存失敗'))
  }
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setMsg('匯入中…')
    const fd = new FormData(); fd.append('file', file); fd.append('store', store)
    const res = await fetch('/api/inv/import/safety', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `匯入 ${d.imported} 項` : (d.error ?? '匯入失敗'))
    if (res.ok) setTick(t => t + 1)
  }

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" hidden accept=".xlsx" onChange={upload} />
      <p className="text-xs text-gray-500">安全量＝緊急補貨線（低於就通知領班）；滿倉量＝每日訂貨補到的目標量。</p>
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={seedFromMaterials}><PackageCheck className="h-4 w-4" />帶入原料清單</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />匯入(.xlsx)</Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存</Button>
        {msg && <span className="text-sm text-blue-600 basis-full">{msg}</span>}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">尚無安全庫存設定，點「帶入原料清單」或「匯入」開始。</div>
        : <Card className="p-4">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b sticky top-0 bg-white"><th className="py-2 pr-2">原料</th><th className="pr-2">單位</th><th className="pr-2 text-right">安全量</th><th className="pr-2 text-right">滿倉量</th></tr></thead>
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
    if (!f.material_code || !f.start_date || !f.end_date) { setMsg('原料碼與起訖日必填'); return }
    setAdding(true); setMsg('')
    const res = await fetch('/api/inv/safety/overrides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, ...f, safety_qty: f.safety_qty || 0, full_qty: f.full_qty || 0 }),
    })
    setAdding(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(d.error ?? '新增失敗'); return }
    setF({ material_code: '', label: '', start_date: '', end_date: '', safety_qty: '', full_qty: '' })
    setTick(t => t + 1); setMsg('已新增覆寫')
  }
  const del = async (id: string) => {
    const res = await fetch('/api/inv/safety/overrides', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (res.ok) setTick(t => t + 1)
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm font-medium flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-primary" />節慶覆寫（特定日期區間的安全量／滿倉量）</div>
      <p className="text-xs text-gray-500">在指定日期區間內，該原料改用此處的安全量／滿倉量（盤點・訂貨計算會依盤點日期自動採用）。</p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">原料碼*</span><Input value={f.material_code} onChange={e => setF({ ...f, material_code: e.target.value })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">節慶名</span><Input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} className="h-8" placeholder="如 中秋" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">起始日*</span><Input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">結束日*</span><Input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">安全量</span><Input type="number" value={f.safety_qty === '' ? '' : String(f.safety_qty)} onChange={e => setF({ ...f, safety_qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
        <label className="space-y-1"><span className="block text-[11px] text-gray-500">滿倉量</span><Input type="number" value={f.full_qty === '' ? '' : String(f.full_qty)} onChange={e => setF({ ...f, full_qty: e.target.value === '' ? '' : Number(e.target.value) })} className="h-8" /></label>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <Button size="sm" onClick={add} disabled={adding}>{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}新增覆寫</Button>
        {msg && <span className="text-sm text-blue-600">{msg}</span>}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">原料碼</th><th className="pr-2">節慶</th><th className="pr-2">區間</th><th className="pr-2 text-right">安全量</th><th className="pr-2 text-right">滿倉量</th><th className="pr-2"></th></tr></thead>
            <tbody>{rows.map(o => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="py-1 pr-2">{o.material_code}</td>
                <td className="pr-2">{o.label || '—'}</td>
                <td className="pr-2 text-gray-500">{o.start_date} ~ {o.end_date}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(o.safety_qty)}</td>
                <td className="pr-2 text-right tabular-nums">{fmt(o.full_qty)}</td>
                <td className="pr-2 text-right"><button onClick={() => del(o.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>))}</tbody></table>
        </div>
      )}
    </Card>
  )
}

// ── 通知設定（各角色聯絡管道＋到期通知天數） ──
const ROLES: [string, string, string][] = [
  // [key 前綴, 標題, 說明]
  ['foreman', '領班／門市人員', '低於安全量緊急叫貨、到期前 N 天優先使用'],
  ['mgmt', '管理', '安全量、到期各級皆通知'],
  ['audit', '稽核', '到期前中後段與過期未報廢'],
  ['office', '辦公室', '過期未報廢時通知'],
]
type Contacts = Record<string, string>

function ForemanTab({ store }: { store: string }) {
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
    setMsg(r1.ok && r2.ok ? '已儲存' : '儲存失敗')
  }
  const checkNow = async () => {
    setChecking(true); setMsg('')
    const res = await fetch('/api/inv/expiry/run', { method: 'POST' })
    setChecking(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `已檢查，發送 ${d.notified ?? 0} 則到期通知` : (d.error ?? '檢查失敗'))
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium">{store} 各角色聯絡管道</div>
        <p className="text-xs text-gray-500">低於安全量、原料到期分級提醒會依角色發送到這裡（Telegram chat id／Email，可留空）。</p>
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
        <div className="text-sm font-medium">到期通知天數（單位預設，批次可各自覆寫）</div>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">前 N 天→門市＋管理</span><Input type="number" value={String(remind.staff)} onChange={e => setRemind({ ...remind, staff: Number(e.target.value) || 0 })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">前 N 天→管理＋稽核</span><Input type="number" value={String(remind.audit)} onChange={e => setRemind({ ...remind, audit: Number(e.target.value) || 0 })} className="h-8" /></label>
          <label className="space-y-1"><span className="block text-[11px] text-gray-500">前 N 天→管理＋稽核</span><Input type="number" value={String(remind.mgmt)} onChange={e => setRemind({ ...remind, mgmt: Number(e.target.value) || 0 })} className="h-8" /></label>
        </div>
        <p className="text-[11px] text-gray-400">過期當天若未報廢，另通知管理＋稽核＋辦公室。每日自動檢查一次。</p>
      </Card>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}儲存</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={checkNow} disabled={checking}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}立即檢查到期</Button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </div>
  )
}
