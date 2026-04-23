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

  const [infoRes, meRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`),
    fetch(`https://api.telegram.org/bot${botToken}/getMe`),
  ])

  const info = await infoRes.json()
  const me   = await meRes.json()

  return NextResponse.json({ info, me })
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
