'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Plus, X, Link2, Trash2, Merge, CalendarDays, BedDouble, Smartphone, MessageCircle, StickyNote, Users } from 'lucide-react'
import { IDENTITY_KINDS } from '@/lib/crm/normalize'

interface Identity { id?: string; kind: string; value: string; label: string | null }
interface ContactRow {
  id: string; display_name: string | null; phone: string | null; email: string | null
  tags: string[]; traits: string | null; order_count: number; total_spent: number
  last_activity_at: string | null; crm_identities: Identity[]
}
interface Activity { id: string; source: string; kind: string; title: string; amount: number | null; currency: string | null; status: string | null; occurred_at: string; meta: Record<string, unknown> }
interface ContactFull extends Omit<ContactRow, 'crm_identities'> {
  gender: string | null; birthday: string | null; country: string | null; notes: string | null
  ai_summary: string | null; first_seen_at: string | null
}

const KIND_LABEL = Object.fromEntries(IDENTITY_KINDS.map(k => [k.id, k.label]))
const KIND_COLOR: Record<string, string> = {
  line: 'bg-green-100 text-green-700', whatsapp: 'bg-emerald-100 text-emerald-700', messenger: 'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700', telegram: 'bg-sky-100 text-sky-700', zalo: 'bg-indigo-100 text-indigo-700',
  wechat: 'bg-lime-100 text-lime-700', phone: 'bg-gray-100 text-gray-700', email: 'bg-amber-100 text-amber-700', other: 'bg-slate-100 text-slate-700',
}
const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  reserve: { label: '服務預約', icon: CalendarDays, color: 'text-pink-600' },
  booking: { label: '訂房', icon: BedDouble, color: 'text-cyan-600' },
  esim: { label: 'eSIM', icon: Smartphone, color: 'text-violet-600' },
  cs: { label: '客服對話', icon: MessageCircle, color: 'text-orange-600' },
  manual: { label: '備註', icon: StickyNote, color: 'text-slate-600' },
}

const fmtMoney = (n: number | null | undefined) => (n == null ? '' : `NT$${Number(n).toLocaleString()}`)
type ApiError = Error & { status?: number }
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('zh-TW') : '—')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { data, status: res.status })
  return data
}

export default function CrmPage() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [rows, setRows] = useState<ContactRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (p = 0) => {
    setLoading(true)
    try {
      const sp = new URLSearchParams({ page: String(p) })
      if (q.trim()) sp.set('q', q.trim())
      if (kind) sp.set('kind', kind)
      const d = await api(`/api/crm/contacts?${sp}`)
      setRows(d.contacts); setTotal(d.total); setPage(p)
    } catch (e) { setMsg(errMsg(e)) } finally { setLoading(false) }
  }, [q, kind])

  useEffect(() => { const t = setTimeout(() => load(0), 300); return () => clearTimeout(t) }, [load])

  async function sync() {
    setSyncing(true); setMsg('')
    try {
      const d = await api('/api/crm/sync', { method: 'POST' })
      setMsg(`已同步：預約 ${d.sources.reserve}、訂房 ${d.sources.booking}、eSIM ${d.sources.esim}、客服 ${d.sources.cs} 筆，新增客人 ${d.contactsCreated} 位`)
      load(0)
    } catch (e) { setMsg(`同步失敗：${errMsg(e)}`) } finally { setSyncing(false) }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 bg-white border-b px-4 py-3 flex flex-wrap items-center gap-2">
        <Users className="w-5 h-5 text-indigo-600" />
        <h1 className="text-lg font-semibold mr-2">客戶系統</h1>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋姓名、電話、Email、LINE / WhatsApp ID、特質"
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <select value={kind} onChange={e => setKind(e.target.value)} className="text-sm border rounded-lg px-2 py-2">
          <option value="">全部帳號類型</option>
          {IDENTITY_KINDS.map(k => <option key={k.id} value={k.id}>有 {k.label}</option>)}
        </select>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-gray-50">
          <Plus className="w-4 h-4" />新增客人
        </button>
        <button onClick={sync} disabled={syncing} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? '同步中…' : '同步各系統資料'}
        </button>
      </div>
      {msg && <div className="shrink-0 px-4 py-2 text-sm bg-indigo-50 text-indigo-800 border-b flex justify-between">{msg}<button onClick={() => setMsg('')}><X className="w-4 h-4" /></button></div>}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 sticky top-0">
            <tr>
              <th className="text-left font-medium px-4 py-2">客人</th>
              <th className="text-left font-medium px-4 py-2 hidden md:table-cell">聯絡帳號</th>
              <th className="text-left font-medium px-4 py-2 hidden lg:table-cell">特質／標籤</th>
              <th className="text-right font-medium px-4 py-2">次數</th>
              <th className="text-right font-medium px-4 py-2">累計消費</th>
              <th className="text-right font-medium px-4 py-2 hidden sm:table-cell">最近互動</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map(r => (
              <tr key={r.id} onClick={() => setSelected(r.id)} className="border-t hover:bg-indigo-50/40 cursor-pointer">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.display_name || '（未命名）'}</div>
                  <div className="text-xs text-gray-500">{[r.phone, r.email].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="px-4 py-2.5 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(r.crm_identities.map(i => i.kind))].map(k => (
                      <span key={k} className={`text-[11px] px-1.5 py-0.5 rounded ${KIND_COLOR[k] ?? KIND_COLOR.other}`}>{KIND_LABEL[k] ?? k}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 hidden lg:table-cell max-w-xs">
                  <div className="flex flex-wrap gap-1">{r.tags.map(t => <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{t}</span>)}</div>
                  {r.traits && <div className="text-xs text-gray-500 truncate">{r.traits}</div>}
                </td>
                <td className="px-4 py-2.5 text-right">{r.order_count}</td>
                <td className="px-4 py-2.5 text-right">{fmtMoney(r.total_spent)}</td>
                <td className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">{fmtDate(r.last_activity_at)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-16">尚無客人資料，按「同步各系統資料」從預約、訂房、eSIM、客服匯入</td></tr>
            )}
          </tbody>
        </table>
        {total > 50 && (
          <div className="flex items-center justify-center gap-3 py-3 text-sm">
            <button disabled={page === 0} onClick={() => load(page - 1)} className="px-3 py-1 border rounded disabled:opacity-40">上一頁</button>
            <span>{page + 1} / {Math.ceil(total / 50)}（共 {total} 位）</span>
            <button disabled={(page + 1) * 50 >= total} onClick={() => load(page + 1)} className="px-3 py-1 border rounded disabled:opacity-40">下一頁</button>
          </div>
        )}
      </div>

      {selected && <ContactDrawer id={selected} onClose={() => setSelected(null)} onChanged={() => load(page)} />}
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={id => { setCreating(false); load(0); setSelected(id) }} />}
    </div>
  )
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ display_name: '', phone: '', email: '', traits: '' })
  const [err, setErr] = useState('')
  async function submit() {
    try { const d = await api('/api/crm/contacts', { method: 'POST', body: JSON.stringify(f) }); onCreated(d.id) } catch (e) { setErr(errMsg(e)) }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold">新增客人</h2>
        {(['display_name', 'phone', 'email'] as const).map(k => (
          <input key={k} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}
            placeholder={{ display_name: '姓名', phone: '電話', email: 'Email' }[k]} className="w-full border rounded-lg px-3 py-2 text-sm" />
        ))}
        <textarea value={f.traits} onChange={e => setF({ ...f, traits: e.target.value })} placeholder="客人特質（偏好、習慣、注意事項）" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded-lg">取消</button>
          <button onClick={submit} className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white">建立</button>
        </div>
      </div>
    </div>
  )
}

function ContactDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ contact: ContactFull; identities: Identity[]; activities: Activity[] } | null>(null)
  const [form, setForm] = useState<Partial<ContactFull> & { tagsText?: string }>({})
  const [dirty, setDirty] = useState(false)
  const [err, setErr] = useState('')
  const [newIdent, setNewIdent] = useState({ kind: 'line', value: '', label: '' })
  const [note, setNote] = useState('')
  const [mergeQ, setMergeQ] = useState('')
  const [mergeHits, setMergeHits] = useState<ContactRow[]>([])
  const [srcFilter, setSrcFilter] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/crm/contacts/${id}`)
      setData(d); setForm({ ...d.contact, tagsText: (d.contact.tags ?? []).join(', ') }); setDirty(false)
    } catch (e) { setErr(errMsg(e)) }
  }, [id])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  useEffect(() => {
    if (!mergeQ.trim()) return
    const t = setTimeout(async () => {
      const d = await api(`/api/crm/contacts?q=${encodeURIComponent(mergeQ.trim())}`).catch(() => ({ contacts: [] }))
      setMergeHits(d.contacts.filter((c: ContactRow) => c.id !== id).slice(0, 8))
    }, 300)
    return () => clearTimeout(t)
  }, [mergeQ, id])

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  async function save() {
    setErr('')
    try {
      const { tagsText, ...rest } = form
      await api(`/api/crm/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({
        display_name: rest.display_name, phone: rest.phone, email: rest.email, gender: rest.gender, birthday: rest.birthday,
        country: rest.country, traits: rest.traits, notes: rest.notes, tags: (tagsText ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean),
      }) })
      await load(); onChanged()
    } catch (e) { setErr(errMsg(e)) }
  }

  async function addIdent(move = false) {
    setErr('')
    try {
      await api(`/api/crm/contacts/${id}/identities`, { method: 'POST', body: JSON.stringify({ ...newIdent, move }) })
      setNewIdent({ ...newIdent, value: '', label: '' }); await load(); onChanged()
    } catch (e) {
      const ae = e as ApiError
      if (ae.status === 409 && confirm(`${ae.message}\n\n要把這個帳號改綁到目前這位客人嗎？`)) return addIdent(true)
      setErr(errMsg(e))
    }
  }
  async function delIdent(identityId: string) {
    if (!confirm('解除綁定這個帳號？')) return
    await api(`/api/crm/contacts/${id}/identities?identity_id=${identityId}`, { method: 'DELETE' }).catch(e => setErr(e.message))
    await load(); onChanged()
  }
  async function addNote() {
    if (!note.trim()) return
    await api(`/api/crm/contacts/${id}/notes`, { method: 'POST', body: JSON.stringify({ text: note }) }).catch(e => setErr(e.message))
    setNote(''); await load(); onChanged()
  }
  async function delNote(actId: string) {
    await api(`/api/crm/contacts/${id}/notes?activity_id=${actId}`, { method: 'DELETE' }).catch(e => setErr(e.message))
    await load()
  }
  async function merge(other: ContactRow) {
    if (!confirm(`把「${other.display_name || '未命名'}」的所有帳號與紀錄合併到目前這位客人？（無法復原）`)) return
    try { await api(`/api/crm/contacts/${id}/merge`, { method: 'POST', body: JSON.stringify({ other_id: other.id }) }); setMergeQ(''); await load(); onChanged() } catch (e) { setErr(errMsg(e)) }
  }
  async function remove() {
    if (!confirm('刪除這位客人的客戶資料？（原始預約／訂房／訂單不受影響，下次同步可能重新建立）')) return
    await api(`/api/crm/contacts/${id}`, { method: 'DELETE' }); onChanged(); onClose()
  }

  const c = data?.contact
  const acts = (data?.activities ?? []).filter(a => !srcFilter || a.source === srcFilter)
  const bySource = (data?.activities ?? []).reduce<Record<string, number>>((m, a) => ({ ...m, [a.source]: (m[a.source] ?? 0) + 1 }), {})

  return (
    <div className="fixed inset-0 z-40 bg-black/20 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center gap-2 z-10">
          <h2 className="font-semibold text-lg flex-1 truncate">{c?.display_name || '（未命名）'}</h2>
          {dirty && <button onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white">儲存</button>}
          <button onClick={remove} title="刪除" className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        {err && <div className="mx-5 mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</div>}
        {!c ? <div className="p-10 text-center text-gray-400">載入中…</div> : (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="消費／預訂次數" value={String(c.order_count)} />
              <Stat label="累計消費" value={fmtMoney(c.total_spent)} />
              <Stat label="首次接觸" value={fmtDate(c.first_seen_at)} />
            </div>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <Field label="姓名" value={form.display_name} onChange={v => set('display_name', v)} />
              <Field label="電話" value={form.phone} onChange={v => set('phone', v)} />
              <Field label="Email" value={form.email} onChange={v => set('email', v)} />
              <Field label="國家／地區" value={form.country} onChange={v => set('country', v)} />
              <Field label="性別" value={form.gender} onChange={v => set('gender', v)} />
              <Field label="生日" type="date" value={form.birthday} onChange={v => set('birthday', v)} />
              <div className="col-span-2"><Field label="標籤（逗號分隔，例如 VIP, 常客, 素食）" value={form.tagsText} onChange={v => set('tagsText', v)} /></div>
              <label className="col-span-2 block">
                <span className="text-xs text-gray-500">客人特質（偏好、習慣、注意事項）</span>
                <textarea value={form.traits ?? ''} onChange={e => set('traits', e.target.value)} rows={3} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              <label className="col-span-2 block">
                <span className="text-xs text-gray-500">內部備註</span>
                <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              {c.ai_summary && (
                <div className="col-span-2 bg-orange-50 border border-orange-100 rounded-lg p-3">
                  <div className="text-xs text-orange-700 mb-1">AI 客服對話摘要</div>
                  <div className="whitespace-pre-wrap">{c.ai_summary}</div>
                </div>
              )}
            </section>

            <section>
              <h3 className="font-medium mb-2 flex items-center gap-1"><Link2 className="w-4 h-4" />綁定帳號（LINE / WhatsApp / 電話 / Email …）</h3>
              <div className="space-y-1.5">
                {data!.identities.map(i => (
                  <div key={i.id} className="flex items-center gap-2 text-sm">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${KIND_COLOR[i.kind] ?? KIND_COLOR.other}`}>{KIND_LABEL[i.kind] ?? i.kind}</span>
                    <span className="font-mono text-xs truncate">{i.value}</span>
                    {i.label && <span className="text-gray-500 truncate">（{i.label}）</span>}
                    <button onClick={() => delIdent(i.id!)} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <select value={newIdent.kind} onChange={e => setNewIdent({ ...newIdent, kind: e.target.value })} className="border rounded-lg px-2 py-1.5 text-sm">
                  {IDENTITY_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
                <input value={newIdent.value} onChange={e => setNewIdent({ ...newIdent, value: e.target.value })} placeholder="帳號 ID／電話" className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm" />
                <input value={newIdent.label} onChange={e => setNewIdent({ ...newIdent, label: e.target.value })} placeholder="顯示名稱" className="w-28 border rounded-lg px-2 py-1.5 text-sm" />
                <button onClick={() => addIdent()} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">綁定</button>
              </div>
            </section>

            <section>
              <h3 className="font-medium mb-2 flex items-center gap-1"><Merge className="w-4 h-4" />合併重複客人</h3>
              <input value={mergeQ} onChange={e => { setMergeQ(e.target.value); if (!e.target.value.trim()) setMergeHits([]) }} placeholder="搜尋另一筆同一人的資料" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
              {mergeHits.map(h => (
                <button key={h.id} onClick={() => merge(h)} className="w-full text-left text-sm px-3 py-1.5 hover:bg-indigo-50 rounded flex justify-between">
                  <span>{h.display_name || '（未命名）'} <span className="text-gray-500">{[h.phone, h.email].filter(Boolean).join(' · ')}</span></span>
                  <span className="text-indigo-600">合併 →</span>
                </button>
              ))}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="font-medium">完整紀錄</h3>
                <button onClick={() => setSrcFilter('')} className={`text-xs px-2 py-0.5 rounded-full border ${!srcFilter ? 'bg-gray-800 text-white' : ''}`}>全部 {data!.activities.length}</button>
                {Object.entries(bySource).map(([s, n]) => (
                  <button key={s} onClick={() => setSrcFilter(s)} className={`text-xs px-2 py-0.5 rounded-full border ${srcFilter === s ? 'bg-gray-800 text-white' : ''}`}>{SOURCE_META[s]?.label ?? s} {n}</button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="新增備註紀錄（例如：來電詢問、客訴處理）" className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
                <button onClick={addNote} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">新增</button>
              </div>
              <ol className="space-y-2">
                {acts.map(a => {
                  const m = SOURCE_META[a.source] ?? SOURCE_META.manual
                  const Icon = m.icon
                  return (
                    <li key={a.id} className="flex gap-3 text-sm border rounded-lg px-3 py-2">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${m.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium break-words">{a.title}</span>
                          {a.amount != null && a.amount > 0 && <span className="shrink-0">{fmtMoney(a.amount)}</span>}
                        </div>
                        <div className="text-xs text-gray-500 flex gap-2 flex-wrap">
                          <span>{m.label}</span><span>{fmtDate(a.occurred_at)}</span>
                          {a.status && <span>狀態：{a.status}</span>}
                          {typeof a.meta?.platform === 'string' && <span>{a.meta.platform}</span>}
                          {typeof a.meta?.order_no === 'string' && <span>單號 {a.meta.order_no}</span>}
                          {typeof a.meta?.appointment_no === 'string' && <span>單號 {a.meta.appointment_no}</span>}
                          {typeof a.meta?.platform_booking_id === 'string' && <span>單號 {a.meta.platform_booking_id}</span>}
                        </div>
                      </div>
                      {a.source === 'manual' && <button onClick={() => delNote(a.id)} className="text-gray-400 hover:text-red-500 self-start"><X className="w-4 h-4" /></button>}
                    </li>
                  )
                })}
                {acts.length === 0 && <li className="text-sm text-gray-400">尚無紀錄</li>}
              </ol>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-slate-50 rounded-lg py-3"><div className="text-lg font-semibold">{value || '—'}</div><div className="text-xs text-gray-500">{label}</div></div>
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string | null | undefined; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-1.5" />
    </label>
  )
}
