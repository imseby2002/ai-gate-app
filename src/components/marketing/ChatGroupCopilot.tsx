'use client'

/**
 * 個人 LINE／Zalo 群組一鍵帶入（不需桌面連接器）：
 * - 這台電腦：LINE 以分享連結開啟並帶入文案；Zalo 複製文案並開啟 Zalo 網頁
 * - 通知持有人：以持有人的 Telegram（個人設定）傳「群組＋文案＋一鍵帶入」；沒人設定 Telegram 時改用 LINE 官方帳號推給已綁定的專員
 * 選群組、按送出一律由使用者操作。
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'

type ChatApp = 'line' | 'zalo'
interface Schedule {
  id: string; app: ChatApp; group_name: string | null; text: string
  next_run_at: string; repeat: 'once' | 'daily' | 'weekly'; status: 'active' | 'done' | 'canceled'; last_result: string | null
}

export function ChatGroupCopilot({
  defaultText,
  showToast,
}: {
  defaultText: string
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void
}) {
  const t = useTranslations('DesktopConnector')
  const [app, setApp] = useState<ChatApp>('line')
  const [groupName, setGroupName] = useState('')
  const [text, setText] = useState(defaultText)
  const [busy, setBusy] = useState<'' | 'local' | 'notify'>('')
  const [holders, setHolders] = useState<{ id: string; name: string }[]>([])
  const [holderId, setHolderId] = useState('')
  const [when, setWhen] = useState('')
  const [repeat, setRepeat] = useState<'once' | 'daily' | 'weekly'>('once')
  const [schedules, setSchedules] = useState<Schedule[]>([])

  const loadSchedules = useCallback(() => fetch('/api/marketing/share-schedules')
    .then(r => (r.ok ? r.json() : { schedules: [] }))
    .then(d => setSchedules(d.schedules ?? []))
    .catch(() => {}), [])
  useEffect(() => { loadSchedules() }, [loadSchedules])

  useEffect(() => { setText(defaultText) }, [defaultText])
  useEffect(() => {
    fetch('/api/marketing/share-drafts').then(r => (r.ok ? r.json() : { holders: [] })).then(d => {
      const list = (d.holders ?? []) as { id: string; name: string }[]
      setHolders(list)
      setHolderId(list[0]?.id ?? '')
    }).catch(() => {})
  }, [])

  const createDraft = async (notify: boolean) => {
    const res = await fetch('/api/marketing/share-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, group_name: groupName, text, notify, holder_id: notify && holderId ? holderId : undefined }),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
    return d as { url: string; line_url?: string; notified: number; channel: 'telegram' | 'line_oa' | null }
  }

  const openHere = async () => {
    if (!text.trim()) { showToast(t('chat.needText'), 'error'); return }
    setBusy('local')
    try {
      if (app === 'line') {
        const d = await createDraft(false)
        window.open(d.line_url, '_blank', 'noopener')
      } else {
        await navigator.clipboard.writeText(text).catch(() => {})
        window.open('https://chat.zalo.me/', '_blank', 'noopener')
        showToast(t('chat.zaloCopied'), 'success')
      }
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  const notifyHolder = async () => {
    if (!text.trim()) { showToast(t('chat.needText'), 'error'); return }
    setBusy('notify')
    try {
      const d = await createDraft(true)
      const ok = d.notified > 0
      showToast(
        ok ? (d.channel === 'telegram' ? t('chat.notifiedTg') : t('chat.notified', { n: d.notified }))
          : (d.channel === 'telegram' ? t('chat.tgFailed') : t('chat.noHolder')),
        ok ? 'success' : 'error',
      )
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy('')
    }
  }

  const createSchedule = async () => {
    if (!text.trim()) { showToast(t('chat.needText'), 'error'); return }
    if (!when) { showToast(t('chat.needWhen'), 'error'); return }
    const res = await fetch('/api/marketing/share-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, group_name: groupName, text, holder_id: holderId || undefined, run_at: new Date(when).toISOString(), repeat }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { showToast(`${t('failed')}：${d.error ?? res.status}`, 'error'); return }
    setWhen('')
    showToast(t('chat.scheduled'), 'success')
    loadSchedules()
  }

  const cancelSchedule = async (id: string) => {
    await fetch(`/api/marketing/share-schedules?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    loadSchedules()
  }

  const field = 'mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-normal'

  return (
    <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3 text-xs">
      <div className="pb-2 border-b border-border">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          <span>{t('chat.title')}</span>
        </h4>
        <p className="text-[10px] text-muted-foreground mt-1">{t('chat.desc')}</p>
      </div>

      <div className="flex gap-2">
        {(['line', 'zalo'] as const).map(a => (
          <button key={a} type="button" onClick={() => setApp(a)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${app === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background'}`}>
            {a === 'line' ? 'LINE' : 'Zalo'}
          </button>
        ))}
      </div>

      <label className="block text-[11px] font-semibold">
        <span>{t('chat.groupName')}</span>
        <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t('chat.groupNamePh')} className={field} />
      </label>

      <label className="block text-[11px] font-semibold">
        <span>{t('chat.text')}</span>
        <textarea rows={5} value={text} onChange={e => setText(e.target.value)} className={field} />
      </label>

      <label className="block text-[11px] font-semibold">
        <span>{t('chat.holder')}</span>
        <select value={holderId} onChange={e => setHolderId(e.target.value)} className={field}>
          {holders.map(h => <option key={h.id} value={h.id}>Telegram · {h.name}</option>)}
          <option value="">{t('chat.holderLineOa')}</option>
        </select>
      </label>

      <p className="text-[10px] text-amber-700 dark:text-amber-400">{t('chat.warn')}</p>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={openHere} disabled={busy !== ''}
          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-50">
          {t('chat.openHere')}
        </button>
        <button type="button" onClick={notifyHolder} disabled={busy !== ''}
          className="px-3 py-2 rounded-lg border border-emerald-600 text-emerald-700 font-bold text-[11px] disabled:opacity-50">
          {t('chat.notifyHolder')}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">{t('chat.holderHint')}</p>

      <div className="pt-2 border-t border-border space-y-2">
        <p className="text-[11px] font-semibold">{t('chat.scheduleTitle')}</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={field} />
          <select value={repeat} onChange={e => setRepeat(e.target.value as typeof repeat)} className={field}>
            {(['once', 'daily', 'weekly'] as const).map(r => <option key={r} value={r}>{t(`chat.repeat.${r}`)}</option>)}
          </select>
        </div>
        <button type="button" onClick={createSchedule}
          className="w-full px-3 py-2 rounded-lg border border-emerald-600 text-emerald-700 font-bold text-[11px]">
          {t('chat.schedule')}
        </button>
        {schedules.map(sc => (
          <div key={sc.id} className="rounded-lg border border-border p-2 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>{sc.app === 'line' ? 'LINE' : 'Zalo'}{sc.group_name ? `「${sc.group_name}」` : ''} · {t(`chat.repeat.${sc.repeat}`)} · {sc.status === 'done' ? t('chat.done') : new Date(sc.next_run_at).toLocaleString()}</span>
              {sc.status === 'active' && (
                <button type="button" onClick={() => cancelSchedule(sc.id)} className="text-red-600 hover:underline">{t('chat.cancel')}</button>
              )}
            </div>
            <p className="line-clamp-2">{sc.text}</p>
            {sc.last_result === 'failed' && <p className="text-[10px] text-red-500">{t('chat.lastFailed')}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
