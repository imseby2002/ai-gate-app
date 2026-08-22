'use client'

import { useState, useEffect, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ClipboardList, Upload, Download, Loader2, AlertCircle, Store, Save, Bell, ShieldAlert, PackageCheck, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'count' | 'safety' | 'foreman'
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
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅管理者可使用門市盤點</p></div>
    </div>
  )

  const TABS: [Tab, string, ReactNode][] = [
    ['count', '盤點・訂貨', <ClipboardList key="a" className="h-4 w-4" />],
    ['safety', '安全庫存', <ShieldAlert key="b" className="h-4 w-4" />],
    ['foreman', '領班設定', <Bell key="c" className="h-4 w-4" />],
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
    </div>
  )
}

// ── 領班設定 ──
function ForemanTab({ store }: { store: string }) {
  const [tg, setTg] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setMsg('')
    fetch(`/api/inv/store-contacts?store=${encodeURIComponent(store)}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { setTg(d.foreman_telegram ?? ''); setEmail(d.foreman_email ?? '') } })
  }, [store])

  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch('/api/inv/store-contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store, foreman_telegram: tg, foreman_email: email }) })
    setSaving(false)
    setMsg(res.ok ? '已儲存' : '儲存失敗')
  }

  return (
    <Card className="p-4 space-y-3 max-w-md">
      <div className="text-sm font-medium">{store} 領班聯絡管道</div>
      <p className="text-xs text-gray-500">盤點時若有原料低於安全量，會發緊急通知到這裡。</p>
      <label className="block space-y-1"><span className="text-xs text-gray-500">Telegram chat id</span><Input value={tg} onChange={e => setTg(e.target.value)} /></label>
      <label className="block space-y-1"><span className="text-xs text-gray-500">Email</span><Input value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}</Button>
        {msg && <span className="text-sm text-gray-500">{msg}</span>}
      </div>
    </Card>
  )
}
