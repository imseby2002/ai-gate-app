'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'

interface Offline {
  id: string; type: string; title: string; store: string; status: string
  start_date: string | null; end_date: string | null; budget: number; counterparty: string; photo_url: string; note: string
}
const TYPE: [string, string][] = [['material', '門市物料'], ['event', '地推活動'], ['outdoor', '戶外廣告'], ['partner', '異業合作']]
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE)
const STATUS_LABEL: Record<string, string> = { planned: '規劃', active: '進行中', installed: '已上架', done: '完成', cancelled: '取消' }
const STATUS_CLS: Record<string, string> = { planned: 'bg-gray-100 text-gray-600', active: 'bg-amber-100 text-amber-700', installed: 'bg-indigo-100 text-indigo-700', done: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-gray-100 text-gray-400' }
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const inp = 'h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm'
const ta = 'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm'
const blank = (type: string): Partial<Offline> => ({ type: type || 'material', title: '', store: '', status: 'planned', start_date: '', end_date: '', budget: 0, counterparty: '', photo_url: '', note: '' })

export default function MarketingOfflinePage() {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<Offline[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [editing, setEditing] = useState<Partial<Offline> | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams(); if (type) sp.set('type', type); if (status) sp.set('status', status)
    const r = await fetch('/api/marketing/offline?' + sp.toString())
    if (r.status === 403) { setForbidden(true); setLoading(false); return }
    const j = await r.json().catch(() => ({})); setItems(j.items ?? []); setLoading(false)
  }, [type, status])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!editing) return
    if (!String(editing.title ?? '').trim()) { setErr('標題必填'); return }
    setSaving(true); setErr('')
    const method = editing.id ? 'PATCH' : 'POST'
    const r = await fetch('/api/marketing/offline', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (!r.ok) { setErr(j.error || '儲存失敗'); return }
    setEditing(null); load()
  }
  async function del(id: string) {
    if (!confirm('確定刪除？')) return
    await fetch('/api/marketing/offline', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  if (forbidden) return <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">需開通行銷模組才能使用</div>

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><MapPin className="h-5 w-5 text-indigo-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">實體行銷</h1>
          <p className="text-sm text-gray-500">門市物料、地推活動、戶外廣告、異業合作，可拍照存證</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
          <option value="">全部類型</option>{TYPE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
          <option value="">全部狀態</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => { setErr(''); setEditing(blank(type || 'material')) }} className="ml-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"><Plus className="h-4 w-4" />新增</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : items.length === 0 ? <div className="text-center py-16 text-gray-400 text-sm">尚無實體行銷項目</div>
        : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(i => (
              <div key={i.id} className="rounded-xl border bg-white overflow-hidden">
                {i.photo_url && <img src={i.photo_url} alt="" className="w-full h-32 object-cover" />}
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border text-gray-600">{TYPE_LABEL[i.type] ?? i.type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_CLS[i.status] ?? ''}`}>{STATUS_LABEL[i.status] ?? i.status}</span>
                    <span className="font-medium text-gray-900">{i.title}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500 space-x-2">
                    {i.store && <span>門市：{i.store}</span>}{i.counterparty && <span>· {i.counterparty}</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-400 space-x-2">
                    {(i.start_date || i.end_date) && <span>{i.start_date ?? ''}{i.end_date ? `～${i.end_date}` : ''}</span>}
                    {i.budget > 0 && <span>· 預算 {fmt(i.budget)}</span>}
                  </div>
                  {i.note && <p className="mt-1 text-sm text-gray-700">{i.note}</p>}
                  <div className="mt-2 flex justify-end gap-1">
                    <button onClick={() => { setErr(''); setEditing({ ...i, start_date: i.start_date ?? '', end_date: i.end_date ?? '' }) }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => del(i.id)} className="p-1.5 rounded hover:bg-gray-100 text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editing.id ? '編輯' : '新增'}實體行銷</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label>類型<select value={editing.type ?? 'material'} onChange={e => setEditing({ ...editing, type: e.target.value })} className={`mt-1 ${inp}`}>{TYPE.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>狀態<select value={editing.status ?? 'planned'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`mt-1 ${inp}`}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="col-span-2">標題 *<input value={editing.title ?? ''} onChange={e => setEditing({ ...editing, title: e.target.value })} className={`mt-1 ${inp}`} placeholder="例：新品海報上架 / 河內大學開幕試飲" /></label>
              <label>門市<input value={editing.store ?? ''} onChange={e => setEditing({ ...editing, store: e.target.value })} className={`mt-1 ${inp}`} placeholder="空＝全公司" /></label>
              <label>廠商／合作方<input value={editing.counterparty ?? ''} onChange={e => setEditing({ ...editing, counterparty: e.target.value })} className={`mt-1 ${inp}`} /></label>
              <label>開始日<input type="date" value={editing.start_date ?? ''} onChange={e => setEditing({ ...editing, start_date: e.target.value })} className={`mt-1 ${inp}`} /></label>
              <label>結束日<input type="date" value={editing.end_date ?? ''} onChange={e => setEditing({ ...editing, end_date: e.target.value })} className={`mt-1 ${inp}`} /></label>
              <label>預算／費用<input type="number" value={String(editing.budget ?? 0)} onChange={e => setEditing({ ...editing, budget: Number(e.target.value) || 0 })} className={`mt-1 ${inp}`} /></label>
              <label>照片連結<input value={editing.photo_url ?? ''} onChange={e => setEditing({ ...editing, photo_url: e.target.value })} className={`mt-1 ${inp}`} placeholder="https://" /></label>
              <label className="col-span-2">備註<textarea rows={2} value={editing.note ?? ''} onChange={e => setEditing({ ...editing, note: e.target.value })} className={`mt-1 ${ta}`} /></label>
            </div>
            {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="h-9 px-4 rounded-md border border-gray-200 text-sm">取消</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
