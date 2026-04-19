/**
 * POST /api/marketing/telegram
 * 使用使用者自己設定的 Bot Token 傳送 Telegram 通知
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 讀取使用者的 Telegram 設定
  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('id', user.id)
    .single()

  const token = profile?.telegram_bot_token
  if (!token) {
    return NextResponse.json(
      { error: '尚未設定 Telegram Bot Token，請至「設定」頁面完成設定。' },
      { status: 422 }
    )
  }

  const { chatId: customChatId, message } = await req.json()
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  // 優先使用請求指定的 chatId，否則用 profile 預設值
  const chatId = customChatId || profile?.telegram_chat_id
  if (!chatId) {
    return NextResponse.json(
      { error: '尚未設定 Telegram Chat ID，請至「設定」頁面完成設定。' },
      { status: 422 }
    )
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  })

  const data = await res.json()
  if (!data.ok) {
    return NextResponse.json(
      { error: data.description ?? 'Telegram 傳送失敗，請確認 Bot Token 與 Chat ID 是否正確。' },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, messageId: data.result?.message_id })
}
