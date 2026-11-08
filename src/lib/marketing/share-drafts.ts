/**
 * 個人 LINE／Zalo 群組一鍵帶入：系統準備文案草稿 → 官方帳號通知持有人（已綁定的專員）→
 * 持有人開啟 /gs/<id>，以 LINE 分享連結或手機分享選單帶入文案，自己選群組按送出。
 * LINE 分享連結：https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { loadChannelCredentials } from '@/lib/channels/resolve'
import { lineGroupOwnerIds } from '@/lib/marketing/line-groups'

export type ShareApp = 'line' | 'zalo'

export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`
}

export function shareDraftUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  return `${base}/gs/${id}`
}

/** 持有人名單：本人＋同公司成員中，客服「專員綁定」的 LINE userId（cs_data_sources type=notify_line） */
async function holderTargets(userId: string): Promise<{ ownerId: string; recipients: string[] }[]> {
  const admin = createAdminClient()
  const owners = await lineGroupOwnerIds(userId)
  const { data } = await admin.from('cs_data_sources').select('user_id, config')
    .in('user_id', owners).eq('type', 'notify_line')
  return (data ?? [])
    .map(r => ({ ownerId: r.user_id as string, recipients: ((r.config as { recipients?: string[] } | null)?.recipients ?? []).filter(Boolean) }))
    .filter(r => r.recipients.length)
}

/** 以官方帳號推播給持有人：群組名稱＋文案＋一鍵帶入連結；回傳成功通知人數 */
export async function notifyHolders(userId: string, draft: { id: string; app: ShareApp; group_name: string | null; text: string }): Promise<number> {
  const appName = draft.app === 'line' ? 'LINE' : 'Zalo'
  const header = `📣 請發到${appName}群組${draft.group_name ? `「${draft.group_name}」` : ''}`
  const message = `${header}\n\n${draft.text}`.slice(0, 4900)
  const link = `👉 一鍵帶入：${shareDraftUrl(draft.id)}`

  let sent = 0
  for (const { ownerId, recipients } of await holderTargets(userId)) {
    const token = (await loadChannelCredentials(ownerId, 'line', 'cs')).line_channel_access_token
    if (!token) continue
    for (const to of recipients) {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, messages: [{ type: 'text', text: message }, { type: 'text', text: link }] }),
      }).catch(() => null)
      if (res?.ok) sent++
    }
  }
  return sent
}
