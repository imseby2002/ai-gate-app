'use client'

/**
 * 個人 LINE 電腦版／Zalo 網頁群組帶入：桌面連接器開啟聊天程式並複製文案，
 * 選群組、貼上、送出都由使用者自己操作（不做無人值守自動發送）。
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { queueConnectorTask } from '@/components/marketing/ConnectorPanel'

type ChatApp = 'line_pc' | 'zalo_web'
interface Account { id: string; platform: string; account_name: string; adspower_profile_id?: string | null }

export function ChatGroupCopilot({
  accounts,
  defaultText,
  showToast,
}: {
  accounts: Account[]
  defaultText: string
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void
}) {
  const t = useTranslations('DesktopConnector')
  const [app, setApp] = useState<ChatApp>('line_pc')
  const [accountId, setAccountId] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupUrl, setGroupUrl] = useState('')
  const [text, setText] = useState(defaultText)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setText(defaultText) }, [defaultText])

  const zaloAccounts = accounts.filter(a => a.adspower_profile_id)

  const submit = async () => {
    if (!text.trim()) { showToast(t('chat.needText'), 'error'); return }
    if (app === 'zalo_web' && !accountId) { showToast(t('copilotNeedAccount'), 'error'); return }
    setBusy(true)
    try {
      await queueConnectorTask({
        type: 'copilot_chat',
        app,
        account_id: app === 'zalo_web' ? accountId : undefined,
        group_name: groupName,
        group_url: app === 'zalo_web' ? groupUrl : undefined,
        text,
      })
      showToast(t('chat.queued', { app: t(`chat.app.${app}`) }), 'success')
    } catch (e) {
      showToast(`${t('failed')}：${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
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
        {(['line_pc', 'zalo_web'] as const).map(a => (
          <button key={a} type="button" onClick={() => setApp(a)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${app === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background'}`}>
            {t(`chat.app.${a}`)}
          </button>
        ))}
      </div>

      {app === 'zalo_web' && (
        <label className="block text-[11px] font-semibold">
          <span>{t('copilotAccount')}</span>
          {zaloAccounts.length ? (
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className={field}>
              <option value="">{t('copilotPick')}</option>
              {zaloAccounts.map(a => <option key={a.id} value={a.id}>{a.platform} · {a.account_name}</option>)}
            </select>
          ) : (
            <span className="block mt-1 font-normal text-muted-foreground">{t('copilotNone')}</span>
          )}
        </label>
      )}

      <label className="block text-[11px] font-semibold">
        <span>{t('chat.groupName')}</span>
        <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t('chat.groupNamePh')} className={field} />
      </label>

      {app === 'zalo_web' && (
        <label className="block text-[11px] font-semibold">
          <span>{t('chat.groupUrl')}</span>
          <input value={groupUrl} onChange={e => setGroupUrl(e.target.value)} placeholder="https://zalo.me/g/..." className={field} />
        </label>
      )}

      <label className="block text-[11px] font-semibold">
        <span>{t('chat.text')}</span>
        <textarea rows={5} value={text} onChange={e => setText(e.target.value)} className={field} />
      </label>

      <p className="text-[10px] text-amber-700 dark:text-amber-400">{t('chat.warn')}</p>

      <button type="button" onClick={submit} disabled={busy}
        className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-50">
        {t('chat.submit')}
      </button>
    </div>
  )
}
