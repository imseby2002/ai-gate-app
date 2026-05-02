/**
 * POST /api/marketing/telegram-setup
 * 主動向 Telegram 註冊 Webhook，並回傳目前的 Webhook 狀態
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load bot token from credentials
  const { data: cred } = await supabase
    .from('social_platform_credentials')
    .select('credentials')
    .eq('user_id', user.id)
    .eq('platform', 'telegram')
    .single()

  const botToken = (cred?.credentials as Record<string, string> | null)?.telegram_bot_token ?? ''
  if (!botToken) {
    return NextResponse.json({ error: '尚未設定 Bot Token' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (!appUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL 環境變數未設定' }, { status: 500 })
  }

  const webhookUrl = `${appUrl}/api/marketing/cs-webhook/telegram/${user.id}`

  // Register webhook
  let setResult: Record<string, unknown> = {}
  try {
    const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    setResult = await setRes.json()
  } catch (e) {
    return NextResponse.json({ error: `setWebhook 呼叫失敗：${String(e)}` }, { status: 500 })
  }

  // Get current webhook info to confirm
  let infoResult: Record<string, unknown> = {}
  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    infoResult = await infoRes.json()
  } catch { /* ignore */ }

  return NextResponse.json({
    webhookUrl,
    setResult,
    infoResult,
  })
}
