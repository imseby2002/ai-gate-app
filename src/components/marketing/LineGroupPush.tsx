'use client'

/** LINE 官方帳號群組排程推播：選群組 → 文案 → 立即或排程送出 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, Loader2, RefreshCw } from 'lucide-react'

interface Group { id: string; name: string | null; status: 'active' | 'left'; last_seen_at: string }
interface Post {
  id: string
  group_ids: string[]
  text: string
  scheduled_at: string
  status: 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed' | 'canceled'
  results: { name: string | null; ok: boolean; error?: string }[]
}

export function LineGroupPush({
  defaultText,
  showToast,
}: {
  defaultText: string
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void
}) {
  const t = useTranslations('DesktopConnector')
  const [groups, setGroups] = useState<Group[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState(defaultText)
  const [imageUrl, setImageUrl] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setText(defaultText) }, [defaultText])

  const load = useCallback(async () => {
    const res = await fetch('/api/marketing/line-groups')
    if (!res.ok) return
    const d = await res.json()
    setGroups(d.groups ?? [])
    setPosts(d.posts ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const active = groups.filter(g => g.status === 'active')
  const nameOf = (id: string) => groups.find(g => g.id === id)?.name || t('lineOa.unnamed')
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))

  const submit = async () => {
    if (!picked.length) { showToast(t('lineOa.needGroup'), 'error'); return }
    if (!text.trim()) { showToast(t('chat.needText'), 'error'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/marketing/line-groups/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_ids: picked,
          text,
          image_url: imageUrl || undefined,
          scheduled_at: when ? new Date(when).toISOString() : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
      showToast(when ? t('lineOa.scheduled') : t(`lineOa.status.${d.status ?? 'sent'}`), d.status === 'failed' ? 'error' : 'success')
      setWhen('')
      await load()
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id: string) => {
    const res = await fetch(`/api/marketing/line-groups/posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) showToast(`${t('failed')}：${d.error ?? res.status}`, 'error')
    await load()
  }

  const field = 'mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-normal'

  return (
    <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3 text-xs">
      <div className="pb-2 border-b border-border flex items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-sm flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-green-600" />
            <span>{t('lineOa.title')}</span>
          </h4>
          <p className="text-[10px] text-muted-foreground mt-1">{t('lineOa.desc')}</p>
        </div>
        <button type="button" onClick={load} className="text-muted-foreground hover:text-foreground" aria-label={t('lineOa.refresh')}>
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {active.length === 0 ? (
        <p className="text-[11px] text-muted-foreground whitespace-pre-line">{t('lineOa.noGroups')}</p>
      ) : (
        <>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {active.map(g => (
              <label key={g.id} className="flex items-center gap-2">
                <input type="checkbox" checked={picked.includes(g.id)} onChange={() => toggle(g.id)} />
                <span>{g.name || t('lineOa.unnamed')}</span>
              </label>
            ))}
          </div>

          <label className="block text-[11px] font-semibold">
            <span>{t('chat.text')}</span>
            <textarea rows={5} value={text} onChange={e => setText(e.target.value)} className={field} />
          </label>
          <label className="block text-[11px] font-semibold">
            <span>{t('lineOa.image')}</span>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={field} />
          </label>
          <label className="block text-[11px] font-semibold">
            <span>{t('lineOa.when')}</span>
            <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={field} />
          </label>
          <p className="text-[10px] text-muted-foreground">{t('lineOa.quota')}</p>

          <button type="button" onClick={submit} disabled={busy}
            className="w-full px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] disabled:opacity-50 flex items-center justify-center gap-1">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {when ? t('lineOa.schedule') : t('lineOa.sendNow')}
          </button>
        </>
      )}

      {posts.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-[11px] font-semibold text-muted-foreground">{t('lineOa.recent')}</p>
          {posts.map(p => (
            <div key={p.id} className="rounded-lg border border-border p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">{new Date(p.scheduled_at).toLocaleString()}</span>
                <span className={`text-[10px] font-semibold ${p.status === 'sent' ? 'text-green-600' : p.status === 'failed' ? 'text-red-600' : p.status === 'partial' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {t(`lineOa.status.${p.status}`)}
                </span>
              </div>
              <p className="line-clamp-2">{p.text}</p>
              <p className="text-[10px] text-muted-foreground">{p.group_ids.map(nameOf).join('、')}</p>
              {p.results?.filter(r => !r.ok).map((r, i) => (
                <p key={i} className="text-[10px] text-red-500">{r.name || t('lineOa.unnamed')}：{r.error}</p>
              ))}
              {p.status === 'scheduled' && (
                <button type="button" onClick={() => cancel(p.id)} className="text-[10px] text-red-600 hover:underline">{t('lineOa.cancel')}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
