/**
 * POST /api/marketing/telegram
 * 使用使用者自己設定的 Bot Token 傳送 Telegram 通知
 *
 * Body:
 *   message: string           — 訊息內文
 *   chatId?: string           — 覆蓋 profile 預設 chat id
 *   withApprovalButtons?: boolean — 是否附帶「允許 / 修改 / 拒絕」inline keyboard
 *   context?: object          — 任意 JSON，儲存至 telegram_approvals.context
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const APPROVAL_KEYBOARD = {
  inline_keyboard: [[
    { text: '✅ 允許',    callback_data: 'approve' },
    { text: '✏️ 修改意見', callback_data: 'modify'  },
    { text: '❌ 拒絕',    callback_data: 'reject'  },
  ]],
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const { chatId: customChatId, message, withApprovalButtons, context } = await req.json()
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const chatId = customChatId || profile?.telegram_chat_id
  if (!chatId) {
    return NextResponse.json(
      { error: '尚未設定 Telegram Chat ID，請至「設定」頁面完成設定。' },
      { status: 422 }
    )
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
  }
  if (withApprovalButtons) {
    body.reply_markup = APPROVAL_KEYBOARD
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!data.ok) {
    return NextResponse.json(
      { error: data.description ?? 'Telegram 傳送失敗，請確認 Bot Token 與 Chat ID 是否正確。' },
      { status: 400 }
    )
  }

  const messageId: number = data.result?.message_id

  // Create approval record for interactive flows
  let approvalId: string | undefined
  if (withApprovalButtons) {
    const { data: approval } = await supabase
      .from('telegram_approvals')
      .insert({
        user_id:    user.id,
        chat_id:    String(chatId),
        message_id: messageId,
        context:    context ?? {},
        status:     'pending',
      })
      .select('id')
      .single()
    approvalId = approval?.id
  }

  return NextResponse.json({ ok: true, messageId, approvalId })
}
