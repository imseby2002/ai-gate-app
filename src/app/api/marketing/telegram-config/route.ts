/**
 * GET /api/marketing/telegram-config
 * 回傳目前使用者的 Telegram 設定是否完整
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('id', user.id)
    .single()

  const configured = !!(profile?.telegram_bot_token && profile?.telegram_chat_id)

  return NextResponse.json({
    configured,
    hasBotToken: !!profile?.telegram_bot_token,
    hasChatId: !!profile?.telegram_chat_id,
  })
}
