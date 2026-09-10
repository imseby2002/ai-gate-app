import { createClient as createSupabaseClient } from '@supabase/supabase-js'

interface PushMessage {
  to: string | string[]
  title: string
  body: string
  data?: Record<string, any>
  sound?: 'default' | null
  badge?: number
  channelId?: string
}

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * 呼叫 Expo 官方 Push Notification API 發送推播
 */
export async function sendExpoPush(messages: PushMessage | PushMessage[]) {
  const msgList = Array.isArray(messages) ? messages : [messages]
  if (msgList.length === 0) return { ok: true, count: 0 }

  // 展平成各個個別 token 的推播
  const payloads: any[] = []
  for (const m of msgList) {
    const tokens = Array.isArray(m.to) ? m.to : [m.to]
    for (const t of tokens) {
      if (!t || typeof t !== 'string' || !t.startsWith('ExponentPushToken')) continue
      payloads.push({
        to: t,
        title: m.title,
        body: m.body,
        data: m.data || {},
        sound: m.sound ?? 'default',
        badge: m.badge,
        channelId: 'default',
      })
    }
  }

  if (payloads.length === 0) return { ok: true, count: 0 }

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloads),
    })

    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, count: payloads.length, data }
  } catch (err) {
    console.error('發送 Expo 推播失敗:', err)
    return { ok: false, error: String(err) }
  }
}

/**
 * 發送推播給指定的 User（自動查找該使用者的手機 Push Token）
 */
export async function notifyUserMobile(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, any> }
) {
  const admin = getServiceClient()

  const tokens = new Set<string>()

  // 1. 從 profiles 讀取
  const { data: profile } = await admin
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single()

  if (profile?.push_token) {
    tokens.add(profile.push_token)
  }

  // 2. 從 user_push_tokens 多裝置表讀取
  try {
    const { data: deviceTokens } = await admin
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', userId)

    for (const row of deviceTokens || []) {
      if (row.push_token) tokens.add(row.push_token)
    }
  } catch {
    // 表尚未建立或遷移時略過
  }

  if (tokens.size === 0) {
    return { sent: false, reason: 'no_tokens' }
  }

  return sendExpoPush({
    to: Array.from(tokens),
    title: payload.title,
    body: payload.body,
    data: payload.data,
  })
}
