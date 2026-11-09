'use client'

// 多分店切換：選擇目前要管理的門市，或新增分店（可複製目前門市的設定、服務與人員）
import { useEffect, useState } from 'react'
import { Plus, Store, X } from 'lucide-react'

type StoreItem = { id: string; name: string; slug: string; is_active: boolean }

export function StoreSwitcher({ compact = false }: { compact?: boolean }) {
  const [stores, setStores] = useState<StoreItem[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [max, setMax] = useState(1)
  const [plan, setPlan] = useState<'free' | 'core'>('free')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [copy, setCopy] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/reserve/stores').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!alive || !d) return
      setStores(d.stores ?? [])
      setCurrentId(d.currentId ?? null)
      setMax(d.max ?? 1)
      setPlan(d.plan ?? 'free')
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  async function switchTo(id: string) {
    if (!id || id === currentId) return
    setBusy(true)
    const r = await fetch('/api/reserve/stores', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (r.ok) window.location.reload()
    else setBusy(false)
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const r = await fetch('/api/reserve/stores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, copyFrom: copy && stores.length > 0 }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok) window.location.reload()
    else { setError(d.error ?? '建立失敗'); setBusy(false) }
  }

  if (compact) {
    return (
      <div className="mx-auto h-8 w-8 rounded-xl border flex items-center justify-center text-slate-400" title={stores.find(s => s.id === currentId)?.name ?? '門市'}>
        <Store className="h-4 w-4" />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Store className="h-3.5 w-3.5 text-rose-500 shrink-0" />
        {stores.length > 0 ? (
          <select
            value={currentId ?? ''}
            disabled={busy}
            onChange={e => switchTo(e.target.value)}
            className="flex-1 min-w-0 text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
            aria-label="目前管理的門市"
          >
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? '' : '（暫停）'}</option>)}
          </select>
        ) : (
          <span className="flex-1 text-xs text-slate-500">尚未建立門市</span>
        )}
        {stores.length < max ? (
          <button type="button" onClick={() => setAdding(true)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600" title="新增分店">
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : plan === 'free' && (
          <a href="/reserve/plan" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600" title="升級 CORE 可新增分店">
            <Plus className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {adding && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setAdding(false)}>
          <form onSubmit={create} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-3 text-xs shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">新增分店</h3>
              <button type="button" onClick={() => setAdding(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <label className="block">
              <span className="font-semibold text-slate-700 dark:text-slate-300">分店名稱</span>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="例如：信義店" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none" />
            </label>
            <label className="block">
              <span className="font-semibold text-slate-700 dark:text-slate-300">預約網址代稱（選填，英文小寫、數字與 -）</span>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-slate-400 shrink-0">/r/</span>
                <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} placeholder="xinyi" pattern="[a-z0-9][a-z0-9-]{2,49}" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none" />
              </div>
            </label>
            {stores.length > 0 && (
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={copy} onChange={e => setCopy(e.target.checked)} className="accent-rose-600" />
                複製目前門市的營業設定、服務項目與人員
              </label>
            )}
            {error && <p className="text-rose-600">{error}</p>}
            <button type="submit" disabled={busy} className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-60">
              {busy ? '建立中…' : '建立並切換'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
