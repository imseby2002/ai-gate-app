'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, Plus, Trash2, X, Store, Tags, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'stores' | 'categories'
interface StoreRow { id: string; code: string; name: string; region: string; active: boolean }
interface CatRow { id: string; code: string; name: string; entry_method: string; vendor_service: string; sort: number }

const METHOD_LABEL: Record<string, string> = { import: '人工匯入', vendor: '廠商填', manual: '手動' }
const SERVICE_LABEL: Record<string, string> = { gas: '瓦斯', ice: '冰塊', '': '—' }

export default function StoreExpensesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('stores')

  const check = useCallback(async () => {
    const res = await fetch('/api/fin/stores')
    setIsAdmin(res.status !== 403)
  }, [])
  useEffect(() => { check() }, [check])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅管理者可使用門市費用</p></div>
    </div>
  )

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'stores', label: '門市／區域', icon: <Store className="h-4 w-4" /> },
    { id: 'categories', label: '費用科目', icon: <Tags className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Wallet className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">門市費用</h1>
          <p className="text-sm text-gray-500">門市/區域、費用科目（水電瓦斯冰塊）</p>
        </div>
        <div className="ml-auto"><Link href="/finance"><Button variant="outline" size="sm" className="gap-1.5"><Wallet className="h-4 w-4" />出納總務</Button></Link></div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === t.id ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'stores' && <StoresTab />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  )
}

function StoresTab() {
  const [rows, setRows] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<StoreRow> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fin/stores')
    if (res.ok) setRows((await res.json()).stores ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing?.code?.trim()) return
    setBusy(true)
    const res = await fetch('/api/fin/stores', {
      method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
    })
    setBusy(false)
    if (res.ok) { setEditing(null); load() } else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }
  const remove = async (r: StoreRow) => {
    if (!confirm(`刪除門市「${r.code}」？`)) return
    await fetch('/api/fin/stores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); load()
  }

  const regions = [...new Set(rows.map(r => r.region).filter(Boolean))]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">每個門市有編碼與所屬區域（冰塊廠商依區域涵蓋）。</p>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing({ code: '', name: '', region: '', active: true })}><Plus className="h-4 w-4" />新增門市</Button>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : rows.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無門市</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">編碼</th><th className="pr-2">名稱</th><th className="pr-2">區域</th><th className="pr-2">狀態</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-2 pr-2 font-medium">{r.code}</td>
              <td className="pr-2">{r.name}</td>
              <td className="pr-2 text-gray-500">{r.region || '—'}</td>
              <td className="pr-2">{r.active ? <span className="text-emerald-600 text-xs">啟用</span> : <span className="text-gray-400 text-xs">停用</span>}</td>
              <td className="text-right whitespace-nowrap">
                <button onClick={() => setEditing({ ...r })} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">編輯</button>
                <button onClick={() => remove(r)} className="ml-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4 inline" /></button>
              </td>
            </tr>))}</tbody></table></div>}

      {editing && (
        <Modal title={editing.id ? '編輯門市' : '新增門市'} onClose={() => setEditing(null)}>
          <Field label="門市編碼 *"><Input value={editing.code ?? ''} onChange={e => setEditing({ ...editing, code: e.target.value })} /></Field>
          <Field label="名稱"><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="區域"><Input list="region-list" value={editing.region ?? ''} onChange={e => setEditing({ ...editing, region: e.target.value })} />
            <datalist id="region-list">{regions.map(r => <option key={r} value={r} />)}</datalist>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({ ...editing, active: e.target.checked })} />啟用</label>
          <ModalActions busy={busy} disabled={!editing.code?.trim()} onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}
    </div>
  )
}

function CategoriesTab() {
  const [rows, setRows] = useState<CatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<CatRow> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fin/categories')
    if (res.ok) setRows((await res.json()).categories ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!editing?.code?.trim()) return
    setBusy(true)
    const res = await fetch('/api/fin/categories', {
      method: editing.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
    })
    setBusy(false)
    if (res.ok) { setEditing(null); load() } else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }
  const remove = async (r: CatRow) => {
    if (!confirm(`刪除科目「${r.name || r.code}」？`)) return
    await fetch('/api/fin/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) }); load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">水電＝人工匯入；瓦斯/冰塊＝廠商填。可自訂新增。</p>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing({ code: '', name: '', entry_method: 'manual', vendor_service: '', sort: 0 })}><Plus className="h-4 w-4" />新增科目</Button>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b"><th className="py-2 pr-2">編碼</th><th className="pr-2">名稱</th><th className="pr-2">填寫方式</th><th className="pr-2">廠商別</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-2 pr-2 font-medium">{r.code}</td>
              <td className="pr-2">{r.name}</td>
              <td className="pr-2 text-gray-500">{METHOD_LABEL[r.entry_method] ?? r.entry_method}</td>
              <td className="pr-2 text-gray-500">{r.entry_method === 'vendor' ? (SERVICE_LABEL[r.vendor_service] ?? r.vendor_service) : '—'}</td>
              <td className="text-right whitespace-nowrap">
                <button onClick={() => setEditing({ ...r })} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">編輯</button>
                <button onClick={() => remove(r)} className="ml-1 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4 inline" /></button>
              </td>
            </tr>))}</tbody></table></div>}

      {editing && (
        <Modal title={editing.id ? '編輯科目' : '新增科目'} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="科目編碼 *"><Input value={editing.code ?? ''} onChange={e => setEditing({ ...editing, code: e.target.value })} /></Field>
            <Field label="名稱"><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="填寫方式">
              <select value={editing.entry_method ?? 'manual'} onChange={e => setEditing({ ...editing, entry_method: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
                <option value="import">人工匯入</option><option value="vendor">廠商填</option><option value="manual">手動</option>
              </select>
            </Field>
            {editing.entry_method === 'vendor' && (
              <Field label="廠商別">
                <select value={editing.vendor_service ?? ''} onChange={e => setEditing({ ...editing, vendor_service: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
                  <option value="">選擇…</option><option value="gas">瓦斯（1 家）</option><option value="ice">冰塊（分區）</option>
                </select>
              </Field>
            )}
          </div>
          <ModalActions busy={busy} disabled={!editing.code?.trim()} onCancel={() => setEditing(null)} onSave={save} />
        </Modal>
      )}
    </div>
  )
}

// ── 共用小元件 ──
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs text-gray-500">{label}</span>{children}</label>
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3><button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button></div>
        {children}
      </div>
    </div>
  )
}
function ModalActions({ busy, disabled, onCancel, onSave }: { busy: boolean; disabled: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
      <Button size="sm" onClick={onSave} disabled={busy || disabled}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}</Button>
    </div>
  )
}
