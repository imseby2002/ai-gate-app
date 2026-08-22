'use client'

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { FileText, Upload, Loader2, AlertCircle, Plus, Trash2, X, Bell, Building2, CalendarClock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'docs' | 'settings'
interface StoreOpt { code: string; name: string; region: string }
interface Doc {
  id: string; doc_type: string; title: string; store_code: string; counterparty: string
  effective_date: string | null; expiry_date: string | null; payment_day: number | null
  remind_days_before: number; pay_remind_days_before: number; status: string
  file_name: string; url: string; note: string; confirmed: boolean
}
interface AffairSettings {
  external_telegram: string; external_email: string
  general_telegram: string; general_email: string
  cashier_telegram: string; cashier_email: string
  default_remind_days: number; default_pay_remind_days: number
}

const TYPE_LABEL: Record<string, string> = { lease: '門市租約', contract: '廠商合約', license: '衛生證／證照', other: '其他' }
const TYPE_ORDER = ['lease', 'contract', 'license', 'other']
const todayStr = () => new Date().toISOString().slice(0, 10)

function daysUntil(d: string | null): number | null {
  if (!d) return null
  const ms = new Date(d + 'T00:00:00').getTime() - new Date(todayStr() + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}

export default function AffairsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('docs')

  useEffect(() => {
    fetch('/api/affairs/settings').then(r => { setIsAdmin(r.status !== 403) })
  }, [])

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅管理者可使用外務管理</p></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">外務・證照合約</h1>
          <p className="text-sm text-gray-500">租約、廠商合約、衛生證等文件與到期／繳費提醒</p>
        </div>
        <div className="ml-auto"><Link href="/finance"><Button variant="outline" size="sm" className="gap-1.5"><Building2 className="h-4 w-4" />財務</Button></Link></div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {([['docs', '文件', <FileText key="a" className="h-4 w-4" />], ['settings', '通知設定', <Bell key="b" className="h-4 w-4" />]] as [Tab, string, ReactNode][]).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === id ? { background: 'white', color: 'var(--primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#6b7280' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'docs' && <DocsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}

// ── 文件 ──
function DocsTab() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [stores, setStores] = useState<StoreOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [editing, setEditing] = useState<Partial<Doc> | null>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    setLoading(true)
    const qs = filterType ? `?doc_type=${filterType}` : ''
    fetch(`/api/affairs/documents${qs}`).then(r => r.ok ? r.json() : { documents: [] }).then(d => { setDocs(d.documents ?? []); setLoading(false) })
  }, [filterType, tick])
  useEffect(() => {
    fetch('/api/fin/stores').then(r => r.ok ? r.json() : { stores: [] }).then(d => setStores(d.stores ?? []))
  }, [])

  const storeName = (code: string) => stores.find(s => s.code === code)?.name || code

  // 即將到期／繳費看板
  const upcoming = docs.filter(d => d.status === 'active').map(d => {
    const exd = daysUntil(d.expiry_date)
    const expiryDue = exd !== null && exd <= d.remind_days_before
    return { d, exd, expiryDue }
  }).filter(x => x.expiryDue).sort((a, b) => (a.exd ?? 0) - (b.exd ?? 0))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 rounded-md border px-2 text-sm">
          <option value="">全部類別</option>
          {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={() => setEditing({ doc_type: 'lease', remind_days_before: 30, pay_remind_days_before: 5 })}><Plus className="h-4 w-4" />新增文件</Button>
      </div>

      {upcoming.length > 0 && (
        <Card className="p-3 border-amber-200 bg-amber-50/60">
          <div className="text-sm font-medium text-amber-800 flex items-center gap-1.5 mb-2"><CalendarClock className="h-4 w-4" />即將到期（{upcoming.length}）</div>
          <div className="grid gap-1">
            {upcoming.slice(0, 8).map(({ d, exd }) => (
              <div key={d.id} className="text-xs flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-white border text-gray-500">{TYPE_LABEL[d.doc_type]}</span>
                <span className="font-medium">{d.title || '（未命名）'}</span>
                {d.store_code && <span className="text-gray-400">{storeName(d.store_code)}</span>}
                <span className={`ml-auto tabular-nums font-medium ${exd !== null && exd < 0 ? 'text-red-600' : exd !== null && exd <= 7 ? 'text-red-500' : 'text-amber-600'}`}>
                  {exd !== null && exd < 0 ? `已過期 ${-exd} 天` : `${exd} 天後到期`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : docs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">尚無文件，點右上「新增文件」上傳。</div>
        : <div className="grid gap-2">{docs.map(d => {
          const exd = daysUntil(d.expiry_date)
          return (
            <Card key={d.id} className="p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-600">{TYPE_LABEL[d.doc_type]}</span>
                    <span className="font-medium">{d.title || '（未命名）'}</span>
                    {d.store_code && <span className="text-xs text-gray-400">{storeName(d.store_code)}</span>}
                    {d.status === 'archived' && <span className="text-xs text-gray-400">已封存</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    {d.counterparty && <span>對方：{d.counterparty}</span>}
                    {d.expiry_date && <span className={exd !== null && exd <= d.remind_days_before ? 'text-amber-600 font-medium' : ''}>到期：{d.expiry_date}{exd !== null ? `（${exd < 0 ? `過期${-exd}天` : `剩${exd}天`}）` : ''}</span>}
                    {d.doc_type === 'lease' && d.payment_day && <span>每月繳費日：{d.payment_day} 號</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary p-1" title="檢視檔案"><ExternalLink className="h-4 w-4" /></a>}
                  <button onClick={() => setEditing(d)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">編輯</button>
                </div>
              </div>
            </Card>
          )
        })}</div>}

      {editing && <DocModal doc={editing} stores={stores} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function DocModal({ doc, stores, onClose, onSaved }: { doc: Partial<Doc>; stores: StoreOpt[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !doc.id
  const [f, setF] = useState<Partial<Doc>>({ ...doc })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<Doc>) => setF(p => ({ ...p, ...patch }))

  const save = async () => {
    setBusy(true); setErr('')
    if (isNew) {
      const fd = new FormData()
      if (file) fd.append('file', file)
      fd.append('doc_type', f.doc_type ?? 'other')
      for (const k of ['title', 'store_code', 'counterparty', 'note'] as const) fd.append(k, String(f[k] ?? ''))
      if (f.effective_date) fd.append('effective_date', f.effective_date)
      if (f.expiry_date) fd.append('expiry_date', f.expiry_date)
      if (f.payment_day) fd.append('payment_day', String(f.payment_day))
      fd.append('remind_days_before', String(f.remind_days_before ?? 30))
      fd.append('pay_remind_days_before', String(f.pay_remind_days_before ?? 5))
      const res = await fetch('/api/affairs/documents', { method: 'POST', body: fd })
      setBusy(false)
      if (res.ok) onSaved(); else setErr((await res.json().catch(() => ({}))).error ?? '儲存失敗')
    } else {
      const res = await fetch('/api/affairs/documents', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: f.id, doc_type: f.doc_type, title: f.title, store_code: f.store_code, counterparty: f.counterparty,
          effective_date: f.effective_date || null, expiry_date: f.expiry_date || null, payment_day: f.payment_day || null,
          remind_days_before: f.remind_days_before, pay_remind_days_before: f.pay_remind_days_before, note: f.note, status: f.status,
        }),
      })
      setBusy(false)
      if (res.ok) onSaved(); else setErr((await res.json().catch(() => ({}))).error ?? '儲存失敗')
    }
  }
  const remove = async () => {
    if (!confirm('刪除此文件（含檔案）？')) return
    await fetch('/api/affairs/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id }) })
    onSaved()
  }

  const isLease = f.doc_type === 'lease'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">{isNew ? '新增文件' : '編輯文件'}</h3><button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button></div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-xs text-gray-500">類別</span>
            <select value={f.doc_type ?? 'other'} onChange={e => set({ doc_type: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">門市（可空＝公司級）</span>
            <select value={f.store_code ?? ''} onChange={e => set({ store_code: e.target.value })} className="w-full h-9 rounded-md border px-2 text-sm">
              <option value="">—</option>
              {stores.map(s => <option key={s.code} value={s.code}>{s.name || s.code}</option>)}
            </select></label>
        </div>
        <label className="block space-y-1"><span className="text-xs text-gray-500">標題</span><Input value={f.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="如：YL 門市租約 2026" /></label>
        <label className="block space-y-1"><span className="text-xs text-gray-500">對方（房東／廠商／發證機關）</span><Input value={f.counterparty ?? ''} onChange={e => set({ counterparty: e.target.value })} /></label>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-xs text-gray-500">生效日</span><Input type="date" value={f.effective_date ?? ''} onChange={e => set({ effective_date: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-xs text-gray-500">到期日</span><Input type="date" value={f.expiry_date ?? ''} onChange={e => set({ expiry_date: e.target.value })} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-xs text-gray-500">到期提前提醒（天）</span><Input type="number" value={String(f.remind_days_before ?? 30)} onChange={e => set({ remind_days_before: Number(e.target.value) || 0 })} /></label>
          {isLease && <label className="space-y-1"><span className="text-xs text-gray-500">每月繳費日（1-31）</span><Input type="number" value={f.payment_day ? String(f.payment_day) : ''} onChange={e => set({ payment_day: Number(e.target.value) || undefined })} /></label>}
        </div>
        {isLease && <label className="block space-y-1"><span className="text-xs text-gray-500">繳費提前提醒出納（天）</span><Input type="number" value={String(f.pay_remind_days_before ?? 5)} onChange={e => set({ pay_remind_days_before: Number(e.target.value) || 0 })} /></label>}
        <label className="block space-y-1"><span className="text-xs text-gray-500">備註</span><Input value={f.note ?? ''} onChange={e => set({ note: e.target.value })} /></label>

        {isNew ? (
          <div>
            <input ref={fileRef} type="file" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)} accept=".pdf,.png,.jpg,.jpeg,.webp" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{file ? file.name : '選擇檔案（PDF／圖片，可選）'}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            {f.file_name ? <span className="text-gray-500">附檔：{f.file_name}</span> : <span className="text-gray-400">無附檔</span>}
            <label className="ml-auto flex items-center gap-1"><span className="text-gray-500">狀態</span>
              <select value={f.status ?? 'active'} onChange={e => set({ status: e.target.value })} className="h-8 rounded-md border px-1.5 text-xs">
                <option value="active">生效中</option><option value="archived">封存</option>
              </select></label>
          </div>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-between pt-1">
          {!isNew ? <button onClick={remove} className="text-red-500 hover:text-red-600 flex items-center gap-1 text-sm"><Trash2 className="h-4 w-4" />刪除</button> : <span />}
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onClose}>取消</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}</Button></div>
        </div>
      </div>
    </div>
  )
}

// ── 通知設定 ──
function SettingsTab() {
  const [cfg, setCfg] = useState<AffairSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/affairs/settings')
    if (res.ok) setCfg(await res.json())
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!cfg) return
    setBusy(true)
    const res = await fetch('/api/affairs/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setBusy(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  if (!cfg) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  const set = (patch: Partial<AffairSettings>) => setCfg(c => c ? { ...c, ...patch } : c)
  const roles: [string, keyof AffairSettings, keyof AffairSettings, string][] = [
    ['外務', 'external_telegram', 'external_email', '到期通知'],
    ['總務', 'general_telegram', 'general_email', '到期通知'],
    ['出納', 'cashier_telegram', 'cashier_email', '租約繳費提醒'],
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">各角色各設管道。到期通知送<b>外務＋總務</b>，租約繳費提醒送<b>出納</b>。站內通知一律保留。</p>
      {roles.map(([label, tgKey, emailKey, hint]) => (
        <Card key={label} className="p-4 space-y-2">
          <div className="text-sm font-medium">{label} <span className="text-xs text-gray-400 font-normal">· {hint}</span></div>
          <div className="grid md:grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-xs text-gray-500">Telegram chat id</span><Input value={String(cfg[tgKey] ?? '')} onChange={e => set({ [tgKey]: e.target.value } as Partial<AffairSettings>)} /></label>
            <label className="space-y-1"><span className="text-xs text-gray-500">Email</span><Input value={String(cfg[emailKey] ?? '')} onChange={e => set({ [emailKey]: e.target.value } as Partial<AffairSettings>)} /></label>
          </div>
        </Card>
      ))}
      <Card className="p-4 grid grid-cols-2 gap-2">
        <label className="space-y-1"><span className="text-xs text-gray-500">預設到期提前天數</span><Input type="number" value={String(cfg.default_remind_days)} onChange={e => set({ default_remind_days: Number(e.target.value) || 0 })} /></label>
        <label className="space-y-1"><span className="text-xs text-gray-500">預設繳費提前天數</span><Input type="number" value={String(cfg.default_pay_remind_days)} onChange={e => set({ default_pay_remind_days: Number(e.target.value) || 0 })} /></label>
      </Card>
      <div className="flex items-center justify-between">
        <RunRemindersButton />
        <Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? '已儲存 ✓' : '儲存'}</Button>
      </div>
    </div>
  )
}

function RunRemindersButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async () => {
    setBusy(true); setMsg('')
    const res = await fetch('/api/affairs/run-reminders', { method: 'POST' })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? `已發送：到期 ${d.expiry ?? 0}、繳費 ${d.payment ?? 0}（已發過的不重送）` : (d.error ?? '執行失敗'))
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}立即檢查提醒</Button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  )
}
