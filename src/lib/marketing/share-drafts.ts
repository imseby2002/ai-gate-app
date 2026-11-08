/**
 * 個人 LINE／Zalo 群組一鍵帶入：系統準備文案草稿 → 通知持有人（優先 Telegram：個人設定的 bot＋chat_id；
 * 未設定時改用 LINE 官方帳號推播給「專員綁定」名單）→
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

/** 可用 Telegram 通知的持有人：本人＋同公司成員中，個人設定已填 Telegram bot token 與 chat_id 者 */
export async function telegramHolders(userId: string): Promise<{ id: string; name: string }[]> {
  const owners = await lineGroupOwnerIds(userId)
  const { data } = await createAdminClient().from('profiles')
    .select('id, full_name, email, telegram_bot_token, telegram_chat_id').in('id', owners)
  return (data ?? [])
    .filter(p => p.telegram_bot_token && p.telegram_chat_id)
    .map(p => ({ id: p.id as string, name: (p.full_name as string) || (p.email as string) || '' }))
    .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : a.name.localeCompare(b.name)))
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 以持有人的 Telegram 通知：群組名稱＋文案＋「一鍵帶入」按鈕；holderId 須為本人或同公司成員 */
export async function notifyHolderTelegram(userId: string, holderId: string, draft: { id: string; app: ShareApp; group_name: string | null; text: string }): Promise<boolean> {
  if (!(await lineGroupOwnerIds(userId)).includes(holderId)) return false
  const { data: p } = await createAdminClient().from('profiles')
    .select('telegram_bot_token, telegram_chat_id').eq('id', holderId).maybeSingle()
  if (!p?.telegram_bot_token || !p.telegram_chat_id) return false
  const appName = draft.app === 'line' ? 'LINE' : 'Zalo'
  const header = `📣 <b>請發到${appName}群組${draft.group_name ? `「${escHtml(draft.group_name)}」` : ''}</b>`
  const res = await fetch(`https://api.telegram.org/bot${String(p.telegram_bot_token).trim()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(p.telegram_chat_id).trim(),
      text: `${header}\n\n${escHtml(draft.text)}`.slice(0, 4000),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '👉 一鍵帶入', url: shareDraftUrl(draft.id) }]] },
    }),
  }).catch(() => null)
  const d = res ? await res.json().catch(() => ({})) : {}
  return d?.ok === true
}

// ── 行銷排程：時間到建立草稿並通知持有人 ────────────────────────────────
const REPEAT_MS = { daily: 86_400_000, weekly: 7 * 86_400_000 } as const

interface ShareSchedule {
  id: string
  user_id: string
  app: ShareApp
  group_name: string | null
  text: string
  holder_id: string | null
  next_run_at: string
  repeat: 'once' | 'daily' | 'weekly'
}

/** 領取並執行一筆到期排程：以 next_run_at 條件更新做原子領取，避免重複通知 */
export async function runShareSchedule(s: ShareSchedule): Promise<{ id: string; notified: number } | null> {
  const admin = createAdminClient()
  let next: string | null = null
  if (s.repeat !== 'once') {
    // 補到未來的下一個時間點（停機補跑時不連發）
    let t = new Date(s.next_run_at).getTime()
    do { t += REPEAT_MS[s.repeat] } while (t <= Date.now())
    next = new Date(t).toISOString()
  }
  const { data: claimed } = await admin.from('marketing_share_schedules')
    .update(next ? { next_run_at: next } : { status: 'done' })
    .eq('id', s.id).eq('status', 'active').eq('next_run_at', s.next_run_at)
    .select('id').maybeSingle()
  if (!claimed) return null

  const { data: draft } = await admin.from('marketing_share_drafts')
    .insert({ user_id: s.user_id, app: s.app, group_name: s.group_name, text: s.text })
    .select('id, app, group_name, text').single()
  let notified = 0
  if (draft) {
    notified = s.holder_id
      ? ((await notifyHolderTelegram(s.user_id, s.holder_id, draft)) ? 1 : 0)
      : await notifyHolders(s.user_id, draft)
    await admin.from('marketing_share_drafts').update({ notified_count: notified }).eq('id', draft.id)
  }
  await admin.from('marketing_share_schedules')
    .update({ last_sent_at: new Date().toISOString(), last_result: notified ? 'ok' : 'failed' })
    .eq('id', s.id)
  return { id: s.id, notified }
}
