'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Plus, Trash2, X, Wrench, Pencil, ClipboardList, Boxes } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ─────────────────────────── 共用 ───────────────────────────
const selCls = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm'

interface Equip {
  id: string; store: string; category: string; name: string; brand_model: string
  serial_no: string; purchase_date: string | null; warranty_until: string | null
  location: string; status: string; note: string; warranty_days: number | null
}

const EQ_STATUS_LABEL: Record<string, string> = { active: '使用中', repairing: '維修中', scrapped: '已報廢' }
const EQ_STATUS_CLASS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700', repairing: 'bg-amber-100 text-amber-700', scrapped: 'bg-gray-200 text-gray-600',
}

function warrantyBadge(days: number | null, until: string | null) {
  if (until == null || days == null) return <span className="text-muted-foreground">—</span>
  let cls = 'bg-emerald-100 text-emerald-700'; let txt = until
  if (days < 0) { cls = 'bg-red-100 text-red-700'; txt = `${until}（已過保 ${-days} 天）` }
  else if (days <= 30) { cls = 'bg-amber-100 text-amber-700'; txt = `${until}（剩 ${days} 天）` }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{txt}</span>
}

// ─────────────────────────── 頁面 ───────────────────────────
type Tab = 'orders' | 'equipment'

export default function RepairPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('orders')

  useEffect(() => {
    fetch('/api/repair/orders').then(r => setAllowed(r.status !== 403))
  }, [])

  if (allowed === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅維修／門市單位可使用</p></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Wrench className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">維修管理</h1>
          <p className="text-sm text-muted-foreground">報修工單、設備資產台帳</p>
        </div>
        <div className="ml-auto"><Link href="/office"><Button variant="outline" size="sm">返回</Button></Link></div>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([['orders', '報修單', <ClipboardList key="o" className="h-4 w-4" />], ['equipment', '設備台帳', <Boxes key="e" className="h-4 w-4" />]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{icon}{label}</button>
        ))}
      </div>

      {tab === 'orders' ? <OrdersTab /> : <EquipmentTab />}
    </div>
  )
}

// ─────────────────────────── 報修單 ───────────────────────────
interface Order {
  id: string; store: string; equipment_id: string | null; equipment_name: string
  title: string; description: string; priority: string; status: string
  reporter_name: string; assignee_type: string; assignee_id: string; assignee_name: string
  cost: number; resolution: string; reported_at: string; assigned_at: string | null; completed_at: string | null
}
type Assignee = { id: string; name: string; service?: string; store?: string }

const PRIORITY_LABEL: Record<string, string> = { low: '低', normal: '一般', high: '高', urgent: '緊急' }
const PRIORITY_CLASS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600', normal: 'bg-sky-100 text-sky-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700',
}
const OS_LABEL: Record<string, string> = { reported: '待處理', assigned: '已派工', in_progress: '處理中', done: '已完成', cancelled: '已取消' }
const OS_CLASS: Record<string, string> = {
  reported: 'bg-amber-100 text-amber-700', assigned: 'bg-sky-100 text-sky-700', in_progress: 'bg-indigo-100 text-indigo-700',
  done: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-gray-200 text-gray-500',
}
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')

function OrdersTab() {
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [canManage, setCanManage] = useState(false)
  const [vendors, setVendors] = useState<Assignee[]>([])
  const [employees, setEmployees] = useState<Assignee[]>([])
  const [equip, setEquip] = useState<Equip[]>([])
  const [creating, setCreating] = useState<Record<string, string> | null>(null)
  const [managing, setManaging] = useState<Order | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (status) sp.set('status', status)
    const res = await fetch('/api/repair/orders?' + sp.toString())
    const j = await res.json().catch(() => ({}))
    setItems(j.items ?? [])
    setLoading(false)
  }, [status])
  useEffect(() => { load() }, [load])

  // 判斷是否可管理（派工）＋載入派工對象與設備清單
  useEffect(() => {
    fetch('/api/repair/assignees').then(async r => {
      if (r.status === 403) { setCanManage(false); return }
      setCanManage(true)
      const j = await r.json().catch(() => ({}))
      setVendors(j.vendors ?? []); setEmployees(j.employees ?? [])
    })
    fetch('/api/repair/equipment').then(async r => {
      if (r.ok) { const j = await r.json().catch(() => ({})); setEquip(j.items ?? []) }
    })
  }, [])

  async function createReport() {
    if (!creating) return
    if (!String(creating.title ?? '').trim()) { setErr('問題標題必填'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/repair/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creating) })
    const j = await res.json().catch(() => ({})); setSaving(false)
    if (!res.ok) { setErr(j.error || '儲存失敗'); return }
    setCreating(null); load()
  }

  async function saveManage() {
    if (!managing) return
    setSaving(true); setErr('')
    const res = await fetch('/api/repair/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(managing) })
    const j = await res.json().catch(() => ({})); setSaving(false)
    if (!res.ok) { setErr(j.error || '儲存失敗'); return }
    setManaging(null); load()
  }

  async function del(id: string) {
    if (!confirm('確定刪除這張工單？')) return
    await fetch('/api/repair/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const stores = Array.from(new Set(equip.map(e => e.store).filter(Boolean))).sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="">全部狀態</option>
          {Object.entries(OS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setCreating({ title: '', store: '', equipment_id: '', description: '', priority: 'normal' }) }}><Plus className="h-4 w-4" />報修</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">尚無報修單</div>
        : (
          <div className="space-y-2">
            {items.map(o => (
              <div key={o.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${OS_CLASS[o.status] ?? ''}`}>{OS_LABEL[o.status] ?? o.status}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_CLASS[o.priority] ?? ''}`}>{PRIORITY_LABEL[o.priority] ?? o.priority}</span>
                      <span className="font-semibold">{o.title}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground space-x-3">
                      {o.store && <span>門市：{o.store}</span>}
                      {o.equipment_name && <span>設備：{o.equipment_name}</span>}
                      {o.reporter_name && <span>報修：{o.reporter_name}</span>}
                      <span>{o.reported_at?.slice(0, 10)}</span>
                    </div>
                    {o.description && <p className="mt-1 text-sm whitespace-pre-wrap">{o.description}</p>}
                    <div className="mt-1 text-sm space-x-3">
                      {o.assignee_name && <span className="text-indigo-600">執行：{o.assignee_type === 'vendor' ? '廠商' : '員工'} {o.assignee_name}</span>}
                      {o.cost > 0 && <span className="text-emerald-700">費用：{fmt(o.cost)}</span>}
                      {o.resolution && <span className="text-muted-foreground">結果：{o.resolution}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {canManage && <button onClick={() => { setErr(''); setManaging({ ...o }) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>}
                    {canManage && <button onClick={() => del(o.id)} className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* 報修 modal */}
      {creating && (
        <Modal title="報修" onClose={() => setCreating(null)} err={err} saving={saving} onSave={createReport}>
          <label className="col-span-2 text-sm">問題標題 *<Input value={creating.title} onChange={e => setCreating({ ...creating, title: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">門市
            <select value={creating.store} onChange={e => setCreating({ ...creating, store: e.target.value })} className={`mt-1 w-full ${selCls}`}>
              <option value="">—</option>
              {stores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm">關聯設備
            <select value={creating.equipment_id} onChange={e => setCreating({ ...creating, equipment_id: e.target.value })} className={`mt-1 w-full ${selCls}`}>
              <option value="">—（無/未登錄）</option>
              {equip.map(e => <option key={e.id} value={e.id}>{e.name}{e.store ? `（${e.store}）` : ''}</option>)}
            </select>
          </label>
          <label className="text-sm">優先度
            <select value={creating.priority} onChange={e => setCreating({ ...creating, priority: e.target.value })} className={`mt-1 w-full ${selCls}`}>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-sm">詳細描述
            <textarea value={creating.description} onChange={e => setCreating({ ...creating, description: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          </label>
        </Modal>
      )}

      {/* 派工／處理 modal */}
      {managing && (
        <Modal title="工單處理" onClose={() => setManaging(null)} err={err} saving={saving} onSave={saveManage}>
          <div className="col-span-2 text-sm font-medium">{managing.title}</div>
          <label className="text-sm">狀態
            <select value={managing.status} onChange={e => setManaging({ ...managing, status: e.target.value })} className={`mt-1 w-full ${selCls}`}>
              {Object.entries(OS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm">優先度
            <select value={managing.priority} onChange={e => setManaging({ ...managing, priority: e.target.value })} className={`mt-1 w-full ${selCls}`}>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm">執行者類型
            <select value={managing.assignee_type} onChange={e => setManaging({ ...managing, assignee_type: e.target.value, assignee_id: '' })} className={`mt-1 w-full ${selCls}`}>
              <option value="">未派工</option>
              <option value="vendor">外部廠商</option>
              <option value="employee">內部員工</option>
            </select>
          </label>
          <label className="text-sm">執行者
            <select value={managing.assignee_id} onChange={e => setManaging({ ...managing, assignee_id: e.target.value })} disabled={!managing.assignee_type} className={`mt-1 w-full ${selCls} disabled:opacity-50`}>
              <option value="">—</option>
              {managing.assignee_type === 'vendor' && vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.service ? `（${v.service}）` : ''}</option>)}
              {managing.assignee_type === 'employee' && employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.store ? `（${e.store}）` : ''}</option>)}
            </select>
          </label>
          <label className="text-sm">維修費用<Input type="number" value={String(managing.cost ?? 0)} onChange={e => setManaging({ ...managing, cost: Number(e.target.value) || 0 })} className="mt-1" /></label>
          <label className="col-span-2 text-sm">處理結果／備註
            <textarea value={managing.resolution} onChange={e => setManaging({ ...managing, resolution: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          </label>
        </Modal>
      )}
    </div>
  )
}

// 通用 modal
function Modal({ title, onClose, onSave, saving, err, children }: { title: string; onClose: () => void; onSave: () => void; saving: boolean; err: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">{children}</div>
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={onSave} disabled={saving} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />}儲存</Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── 設備台帳 ───────────────────────────
const blankEq = (): Partial<Equip> => ({
  store: '', category: '', name: '', brand_model: '', serial_no: '',
  purchase_date: '', warranty_until: '', location: '', status: 'active', note: '',
})

function EquipmentTab() {
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
    const res = await fetch('/api/repair/equipment', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await res.json().catch(() => ({})); setSaving(false)
    if (!res.ok) { setErr(j.error || '儲存失敗'); return }
    setEditing(null); load()
  }

  async function del(id: string) {
    if (!confirm('確定刪除這筆設備？')) return
    await fetch('/api/repair/equipment', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={store} onChange={e => setStore(e.target.value)} className={selCls}>
          <option value="">全部門市</option>
          {stores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
          <option value="">全部狀態</option>
          {Object.entries(EQ_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => { setErr(''); setEditing(blankEq()) }}><Plus className="h-4 w-4" />新增設備</Button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-muted-foreground text-sm">尚無設備資料</div>
        : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">設備名稱</th><th className="px-3 py-2 font-medium">門市</th>
                  <th className="px-3 py-2 font-medium">類別</th><th className="px-3 py-2 font-medium">品牌型號</th>
                  <th className="px-3 py-2 font-medium">序號</th><th className="px-3 py-2 font-medium">保固到期</th>
                  <th className="px-3 py-2 font-medium">狀態</th><th className="px-3 py-2 font-medium"></th>
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
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${EQ_STATUS_CLASS[i.status] ?? ''}`}>{EQ_STATUS_LABEL[i.status] ?? i.status}</span></td>
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
        <Modal title={editing.id ? '編輯設備' : '新增設備'} onClose={() => setEditing(null)} err={err} saving={saving} onSave={save}>
          <label className="col-span-2 text-sm">設備名稱 *<Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">門市<Input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">類別<Input value={editing.category ?? ''} onChange={e => setEditing({ ...editing, category: e.target.value })} className="mt-1" placeholder="製冰機/封口機…" /></label>
          <label className="text-sm">品牌型號<Input value={editing.brand_model ?? ''} onChange={e => setEditing({ ...editing, brand_model: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">序號/財產編號<Input value={editing.serial_no ?? ''} onChange={e => setEditing({ ...editing, serial_no: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">購入日<Input type="date" value={editing.purchase_date ?? ''} onChange={e => setEditing({ ...editing, purchase_date: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">保固到期日<Input type="date" value={editing.warranty_until ?? ''} onChange={e => setEditing({ ...editing, warranty_until: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">擺放位置<Input value={editing.location ?? ''} onChange={e => setEditing({ ...editing, location: e.target.value })} className="mt-1" /></label>
          <label className="text-sm">狀態
            <select value={editing.status ?? 'active'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`mt-1 w-full ${selCls}`}>
              {Object.entries(EQ_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-sm">備註<Input value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} className="mt-1" /></label>
        </Modal>
      )}
    </div>
  )
}
