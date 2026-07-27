/**
 * 客服統一收件匣 —— agent 從網頁主動推訊給客戶（推回原平台）。
 *
 * 與 webhook 內的「被動回覆」不同：agent 回覆是延遲的，
 * LINE reply token 早已失效，因此一律使用各平台的「主動推播 / push」API。
 *
 * 使用 service role client 讀取平台憑證（憑證存在 social_platform_credentials）。
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function loadCredentials(userId: string, platform: string): Promise<Record<string, string>> {
  const { data } = await getServiceClient()
    .from('social_platform_credentials')
    .select('credentials')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single()
  return (data?.credentials as Record<string, string>) ?? {}
}

export interface SendResult {
  ok: boolean
  error?: string
}

/**
 * 把一則文字主動推給某平台上的客戶。
 * @param userId   民宿擁有者 id（憑證所屬）
 * @param platform 客戶來源平台（與 webhook 收訊時一致：line / whatsapp / telegram / zalo / whatsapp-personal …）
 * @param to       客戶在該平台的 id（cs_messages.from_id）
 * @param text     要送出的文字
 */
export interface SendOptions {
  /** LINE 專用：客戶傳訊後 ~1 分鐘內的 reply token；提供時優先用免費 Reply API，失敗才 fallback 到 Push。 */
  lineReplyToken?: string
}

export async function sendToCustomer(
  userId: string,
  platform: string,
  to: string,
  text: string,
  opts: SendOptions = {},
): Promise<SendResult & { channel?: 'reply' | 'push' }> {
  if (!text.trim()) return { ok: false, error: '訊息不可為空' }
  if (!to) return { ok: false, error: '缺少收件人 id' }

  try {
    // ── LINE：1 分鐘內優先用免費 Reply API（reply token），逾時 / 失敗 fallback Push ──
    if (platform === 'line' || platform === 'line-oa') {
      const token = (await loadCredentials(userId, platform)).line_channel_access_token ?? ''
      if (!token) return { ok: false, error: '尚未設定 LINE Channel Access Token' }

      // 先試免費 Reply API（reply token 一次性，可能已過期/被用過 → 失敗就轉 Push）
      if (opts.lineReplyToken) {
        const r = await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ replyToken: opts.lineReplyToken, messages: [{ type: 'text', text }] }),
        })
        if (r.ok) return { ok: true, channel: 'reply' }
        // 非 ok（token 失效）→ 落入下方 Push
      }

      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      })
      if (!res.ok) return { ok: false, error: `LINE 推播失敗（${res.status}）` }
      return { ok: true, channel: 'push' }
    }

    // ── WhatsApp Cloud / Business（24 小時客服窗口內可主動送） ─────────────
    if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
      const creds = await loadCredentials(userId, platform)
      const phoneId = creds.whatsapp_phone_number_id ?? ''
      const token = creds.whatsapp_access_token ?? ''
      if (!phoneId || !token) return { ok: false, error: '尚未設定 WhatsApp 憑證' }
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        const msg = j?.error?.message
        return { ok: false, error: msg ? `WhatsApp：${msg}` : `WhatsApp 送訊失敗（${res.status}）` }
      }
      return { ok: true }
    }

    // ── FB Messenger / Instagram Direct（Meta Send API，須在 24 小時客服窗口內） ──
    if (platform === 'messenger' || platform === 'instagram') {
      const isIG = platform === 'instagram'
      const label = isIG ? 'Instagram' : 'Messenger'
      const token = (isIG
        ? (await loadCredentials(userId, platform)).ig_access_token
        : (await loadCredentials(userId, platform)).fb_page_access_token) ?? ''
      if (!token) return { ok: false, error: `尚未設定 ${label} 憑證` }
      const payload = isIG
        ? { recipient: { id: to }, message: { text } }
        : { recipient: { id: to }, messaging_type: 'RESPONSE', message: { text } }
      const res = await fetch('https://graph.facebook.com/v19.0/me/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        const msg = j?.error?.message
        return { ok: false, error: msg ? `${label}：${msg}` : `${label} 送訊失敗（${res.status}）` }
      }
      return { ok: true }
    }

    // ── Telegram ──────────────────────────────────────────────────────────
    if (platform === 'telegram') {
      const botToken = (await loadCredentials(userId, 'telegram')).telegram_bot_token ?? ''
      if (!botToken) return { ok: false, error: '尚未設定 Telegram Bot Token' }
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: to, text }),
      })
      if (!res.ok) return { ok: false, error: `Telegram 送訊失敗（${res.status}）` }
      return { ok: true }
    }

    // ── Zalo OA ─────────────────────────────────────────────────────────────
    if (platform === 'zalo' || platform === 'zalo-oa') {
      const oaToken = (await loadCredentials(userId, platform)).zalo_oa_access_token ?? ''
      if (!oaToken) return { ok: false, error: '尚未設定 Zalo OA Token' }
      const res = await fetch('https://openapi.zalo.me/v2.0/oa/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: oaToken },
        body: JSON.stringify({ recipient: { user_id: to }, message: { text } }),
      })
      if (!res.ok) return { ok: false, error: `Zalo 送訊失敗（${res.status}）` }
      return { ok: true }
    }

    // ── WhatsApp Personal（自建 Baileys Bridge） ─────────────────────────────
    if (platform === 'whatsapp-personal' || platform === 'whatsapp_personal') {
      const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL?.replace(/\/$/, '')
      const bridgeKey = process.env.WHATSAPP_BRIDGE_API_KEY ?? ''
      if (!bridgeUrl || !bridgeKey) return { ok: false, error: '尚未設定 WhatsApp Bridge' }
      const res = await fetch(`${bridgeUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': bridgeKey },
        body: JSON.stringify({ userId, to, text }),
      })
      if (!res.ok) return { ok: false, error: `WhatsApp Bridge 送訊失敗（${res.status}）` }
      return { ok: true }
    }

    // ── WeChat：公眾號僅能被動回覆，無法主動推播任意文字 ─────────────────────
    if (platform === 'wechat') {
      return { ok: false, error: '微信公眾號不支援主動推播，僅能在客戶訊息後 48 小時內由系統被動回覆' }
    }

    return { ok: false, error: `不支援主動推播的平台：${platform}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '送訊發生未知錯誤' }
  }
}
