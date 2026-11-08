'use client'

/**
 * 個人 LINE／Zalo 群組一鍵帶入（不需桌面連接器）：
 * - 這台電腦：LINE 以分享連結開啟並帶入文案；Zalo 複製文案並開啟 Zalo 網頁
 * - 通知持有人：官方帳號把「群組＋文案＋一鍵帶入連結」推給已綁定的專員，持有人在手機帶入
 * 選群組、按送出一律由使用者操作。
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'

type ChatApp = 'line' | 'zalo'

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

  useEffect(() => { setText(defaultText) }, [defaultText])

  const createDraft = async (notify: boolean) => {
    const res = await fetch('/api/marketing/share-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, group_name: groupName, text, notify }),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`)
    return d as { url: string; line_url?: string; notified: number }
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
      showToast(d.notified ? t('chat.notified', { n: d.notified }) : t('chat.noHolder'), d.notified ? 'success' : 'error')
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy('')
    }
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
    </div>
  )
}
