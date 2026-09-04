'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Plus, Trash2, X, Wrench, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Equip {
  id: string; store: string; category: string; name: string; brand_model: string
  serial_no: string; purchase_date: string | null; warranty_until: string | null
  location: string; status: string; note: string; warranty_days: number | null
}

const STATUS_LABEL: Record<string, string> = { active: '使用中', repairing: '維修中', scrapped: '已報廢' }
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  repairing: 'bg-amber-100 text-amber-700',
  scrapped: 'bg-gray-200 text-gray-600',
}

// 保固顯示：已過期(紅) / 30天內到期(琥珀) / 正常(綠)
function warrantyBadge(days: number | null, until: string | null) {
  if (until == null || days == null) return <span className="text-muted-foreground">—</span>
  let cls = 'bg-emerald-100 text-emerald-700'
  let txt = until
  if (days < 0) { cls = 'bg-red-100 text-red-700'; txt = `${until}（已過保 ${-days} 天）` }
  else if (days <= 30) { cls = 'bg-amber-100 text-amber-700'; txt = `${until}（剩 ${days} 天）` }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{txt}</span>
}

const blank = (): Partial<Equip> => ({
  store: '', category: '', name: '', brand_model: '', serial_no: '',
  purchase_date: '', warranty_until: '', location: '', status: 'active', note: '',
})

export default function RepairPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [items, setItems] = useState<Equip[]>([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Partial<Equip> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (store) sp.set('store', store)
    if (status) sp.set('status', status)
    const res = await fetch('/api/repair/equipment?' + sp.toString())
    if (res.status === 403) { setAllowed(false); setLoading(false); return }
    setAllowed(true)
    const j = await res.json().catch(() => ({}))
    setItems(j.items ?? [])
    setLoading(false)
  }, [store, status])
  useEffect(() => { load() }, [load])

  const stores = Array.from(new Set(items.map(i => i.store).filter(Boolean))).sort()

  async function save() {
    if (!editing) return
    if (!String(editing.name ?? '').trim()) { setErr('設備名稱必填'); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const res = await fetch('/api/repair/equipment', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
    })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setErr(j.error || '儲存失敗'); return }
    setEditing(null); load()
  }

  async function del(id: string) {
    if (!confirm('確定刪除這筆設備？')) return
    await fetch('/api/repair/equipment', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    load()
  }

  if (allowed === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅維修單位可使用</p></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Wrench className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">設備資產台帳</h1>
          <p className="text-sm text-muted-foreground">設備清單、保固到期追蹤</p>
        </div>
        <div className="ml-auto"><Link href="/office"><Button variant="outline" size="sm">返回</Button></Link></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={store} onChange={e => setStore(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">全部門市</option>
          {stores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">全部狀態</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blank()) }}><Plus className="h-4 w-4" />新增設備</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">尚無設備資料</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">設備名稱</th>
                <th className="px-3 py-2 font-medium">門市</th>
                <th className="px-3 py-2 font-medium">類別</th>
                <th className="px-3 py-2 font-medium">品牌型號</th>
                <th className="px-3 py-2 font-medium">序號</th>
                <th className="px-3 py-2 font-medium">保固到期</th>
                <th className="px-3 py-2 font-medium">狀態</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{i.name}{i.location && <span className="ml-1 text-xs text-muted-foreground">@{i.location}</span>}</td>
                  <td className="px-3 py-2">{i.store || '—'}</td>
                  <td className="px-3 py-2">{i.category || '—'}</td>
                  <td className="px-3 py-2">{i.brand_model || '—'}</td>
                  <td className="px-3 py-2">{i.serial_no || '—'}</td>
                  <td className="px-3 py-2">{warrantyBadge(i.warranty_days, i.warranty_until)}</td>
                  <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[i.status] ?? ''}`}>{STATUS_LABEL[i.status] ?? i.status}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setErr(''); setEditing({ ...i, purchase_date: i.purchase_date ?? '', warranty_until: i.warranty_until ?? '' }) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => del(i.id)} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing.id ? '編輯設備' : '新增設備'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm">設備名稱 *<Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">門市<Input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">類別<Input value={editing.category ?? ''} onChange={e => setEditing({ ...editing, category: e.target.value })} className="mt-1" placeholder="製冰機/封口機…" /></label>
              <label className="text-sm">品牌型號<Input value={editing.brand_model ?? ''} onChange={e => setEditing({ ...editing, brand_model: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">序號/財產編號<Input value={editing.serial_no ?? ''} onChange={e => setEditing({ ...editing, serial_no: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">購入日<Input type="date" value={editing.purchase_date ?? ''} onChange={e => setEditing({ ...editing, purchase_date: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">保固到期日<Input type="date" value={editing.warranty_until ?? ''} onChange={e => setEditing({ ...editing, warranty_until: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">擺放位置<Input value={editing.location ?? ''} onChange={e => setEditing({ ...editing, location: e.target.value })} className="mt-1" /></label>
              <label className="text-sm">狀態
                <select value={editing.status ?? 'active'} onChange={e => setEditing({ ...editing, status: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm">備註<Input value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} className="mt-1" /></label>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}儲存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
