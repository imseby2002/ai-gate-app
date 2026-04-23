/**
 * GET  /api/marketing/telegram-test  — getWebhookInfo (shows last_error_message)
 * POST /api/marketing/telegram-test  — send a test message to a chatId
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getBotToken(userId: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('social_platform_credentials')
    .select('credentials')
    .eq('user_id', userId)
    .eq('platform', 'telegram')
    .single()
  return (data?.credentials as Record<string, string> | null)?.telegram_bot_token ?? ''
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const botToken = await getBotToken(user.id)
  if (!botToken) return NextResponse.json({ error: '尚未設定 Bot Token' }, { status: 400 })

  // Temporarily delete webhook to allow getUpdates (they conflict)
  // We'll re-register after fetching
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const webhookUrl = `${appUrl}/api/marketing/cs-webhook/telegram/${user.id}`

  const [infoRes, meRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`),
    fetch(`https://api.telegram.org/bot${botToken}/getMe`),
  ])

  const info = await infoRes.json()
  const me   = await meRes.json()

  // Try to get recent chat IDs via deleteWebhook + getUpdates + re-setWebhook
  let recentChats: Array<{ chatId: number; name: string; username?: string }> = []
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, { method: 'POST' })
    const updatesRes = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=20`)
    const updates = await updatesRes.json()
    if (updates.ok) {
      const seen = new Set<number>()
      for (const u of updates.result ?? []) {
        const chat = u.message?.chat ?? u.edited_message?.chat
        if (chat && !seen.has(chat.id)) {
          seen.add(chat.id)
          recentChats.push({
            chatId: chat.id,
            name: [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || String(chat.id),
            username: chat.username,
          })
        }
      }
    }
    // Re-register webhook
    await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
  } catch { /* ignore */ }

  // Self-check: verify the cs-webhook URL is publicly accessible (not 307)
  let endpointStatus: number | null = null
  try {
    const selfCheck = await fetch(webhookUrl, {
      method: 'GET',
      redirect: 'manual', // don't follow redirects — we want to see the 307
    })
    endpointStatus = selfCheck.status
  } catch { /* ignore */ }

  return NextResponse.json({ info, me, recentChats, endpointStatus })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const botToken = await getBotToken(user.id)
  if (!botToken) return NextResponse.json({ error: '尚未設定 Bot Token' }, { status: 400 })

  const { chatId, text } = await req.json()
  if (!chatId) return NextResponse.json({ error: '請提供 Chat ID' }, { status: 400 })

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text ?? '✅ AI GATE 客服系統測試訊息，Bot 運作正常！' }),
  })
  const result = await res.json()
  return NextResponse.json({ result })
}
