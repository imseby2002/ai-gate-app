'use client'

/** 客服頁：個人 LINE／Zalo 群組通知——事件規則（訂單確認／行程異動）＋手動一鍵帶入 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BellRing, Trash2 } from 'lucide-react'
import { ChatGroupCopilot } from '@/components/marketing/ChatGroupCopilot'

interface Rule { id: string; event: 'order_confirmed' | 'itinerary_changed'; app: 'line' | 'zalo'; group_name: string; holder_id: string }
interface Holder { id: string; name: string }

export function GroupNotifyPanel() {
  const t = useTranslations('DesktopConnector')
  const [rules, setRules] = useState<Rule[]>([])
  const [holders, setHolders] = useState<Holder[]>([])
  const [canSettings, setCanSettings] = useState(false)
  const [form, setForm] = useState({ event: 'order_confirmed', app: 'line', group_name: '', holder_id: '' })
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(() => fetch('/api/cs/group-notify-rules')
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d) return
      setRules(d.rules ?? [])
      setHolders(d.holders ?? [])
      setCanSettings(d.canSettings === true)
      setForm(f => ({ ...f, holder_id: f.holder_id || d.holders?.[0]?.id || '' }))
    })
    .catch(() => {}), [])
  useEffect(() => { load() }, [load])

  const toast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setMsg({ text, ok: type !== 'error' })
    setTimeout(() => setMsg(null), 4000)
  }

  const add = async () => {
    const res = await fetch('/api/cs/group-notify-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { toast(`${t('failed')}：${d.error ?? res.status}`, 'error'); return }
    setForm(f => ({ ...f, group_name: '' }))
    toast(t('rules.added'))
    load()
  }

  const remove = async (id: string) => {
    await fetch(`/api/cs/group-notify-rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    load()
  }

  const holderName = (id: string) => holders.find(h => h.id === id)?.name ?? '—'
  const field = 'w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-8 space-y-4">
      <div className="rounded-2xl border border-border bg-white dark:bg-card p-4 space-y-3 text-xs">
        <div className="pb-2 border-b border-border">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4 text-emerald-600" /> {t('rules.title')}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">{t('rules.desc')}</p>
        </div>

        {rules.length > 0 && (
          <ul className="space-y-1.5">
            {rules.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5">
                <span>{t(`rules.event.${r.event}`)} → {r.app === 'line' ? 'LINE' : 'Zalo'}「{r.group_name}」· Telegram {holderName(r.holder_id)}</span>
                {canSettings && (
                  <button type="button" onClick={() => remove(r.id)} className="text-muted-foreground hover:text-red-600" aria-label={t('rules.remove')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canSettings && (holders.length ? (
          <div className="grid grid-cols-2 gap-2">
            <select value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))} className={field}>
              <option value="order_confirmed">{t('rules.event.order_confirmed')}</option>
              <option value="itinerary_changed">{t('rules.event.itinerary_changed')}</option>
            </select>
            <select value={form.app} onChange={e => setForm(f => ({ ...f, app: e.target.value }))} className={field}>
              <option value="line">LINE</option>
              <option value="zalo">Zalo</option>
            </select>
            <input value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
              placeholder={t('chat.groupName')} className={field} />
            <select value={form.holder_id} onChange={e => setForm(f => ({ ...f, holder_id: e.target.value }))} className={field}>
              {holders.map(h => <option key={h.id} value={h.id}>Telegram · {h.name}</option>)}
            </select>
            <button type="button" onClick={add} disabled={!form.group_name.trim()}
              className="col-span-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50">
              {t('rules.add')}
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">{t('rules.noHolder')}</p>
        ))}

        {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
      </div>

      <ChatGroupCopilot defaultText="" showToast={toast} />
    </div>
  )
}
