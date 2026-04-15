/**
 * POST /api/marketing/telegram-poll
 * 使用使用者自己的 Bot Token，呼叫 getUpdates 輪詢新訊息
 * 前端每 5 秒呼叫一次（當有步驟處於 waiting 時）
 *
 * Body: { campaignId: string }
 * Response: { action: 'approved' | 'feedback' | 'none', feedback?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const APPROVE_KEYWORDS = ['核准', '通過', '同意', 'ok', 'approve', 'yes', '好', '可以', '👍', '✅']

function detectAction(text: string): 'approved' | 'feedback' {
  const lower = text.trim().toLowerCase()
  for (const kw of APPROVE_KEYWORDS) {
    if (lower === kw.toLowerCase() || lower.startsWith(kw.toLowerCase())) return 'approved'
  }
  return 'feedback'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaignId } = await req.json()
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  // 取得 campaign + user bot token + last offset
  const [{ data: campaign }, { data: profile }] = await Promise.all([
    supabase
      .from('marketing_campaigns')
      .select('id, active_step, step_statuses, feedbacks, telegram_chat_id, telegram_last_update_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', user.id)
      .single(),
  ])

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const token = profile?.telegram_bot_token
  if (!token) return NextResponse.json({ action: 'none', reason: 'no_token' })

  // 判斷哪個步驟在等待
  const telegramSteps = [5, 7, 9, 11, 13]
  const statuses: Record<string, string> = campaign.step_statuses ?? {}
  const waitingStep = telegramSteps.find(s => statuses[String(s)] === 'waiting')
  if (!waitingStep) return NextResponse.json({ action: 'none', reason: 'no_waiting_step' })

  // 使用者的 chat ID（campaign 覆蓋 > profile 預設）
  const chatId = campaign.telegram_chat_id || profile?.telegram_chat_id

  // 呼叫 getUpdates
  const offset = (campaign.telegram_last_update_id ?? 0) + 1
  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0&limit=10`
  )
  if (!tgRes.ok) return NextResponse.json({ action: 'none', reason: 'telegram_error' })

  const tgData = await tgRes.json()
  if (!tgData.ok || !tgData.result?.length) return NextResponse.json({ action: 'none' })

  // 找第一筆來自正確 chat 的文字訊息
  let lastUpdateId = campaign.telegram_last_update_id ?? 0
  let matchedAction: 'approved' | 'feedback' | null = null
  let matchedFeedback = ''

  for (const update of tgData.result) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id)
    const msg = update.message ?? update.edited_message
    if (!msg?.text) continue

    const fromChatId = String(msg.chat?.id)
    if (chatId && fromChatId !== String(chatId).replace('@', '')) {
      // 簡單比對（username 比對不精確，可接受）
      if (!chatId.startsWith('@')) continue
    }

    if (!matchedAction) {
      matchedAction = detectAction(msg.text)
      matchedFeedback = msg.text
    }
  }

  // 更新 last_update_id
  await supabase
    .from('marketing_campaigns')
    .update({ telegram_last_update_id: lastUpdateId })
    .eq('id', campaignId)

  if (!matchedAction) return NextResponse.json({ action: 'none' })

  // 根據 action 更新 campaign 狀態
  const feedbacks: Record<string, string> = campaign.feedbacks ?? {}
  const contentStep = waitingStep - 1

  if (matchedAction === 'approved') {
    const nextStep = waitingStep + 1
    const newStatuses = { ...statuses, [String(waitingStep)]: 'approved' }
    await supabase.from('marketing_campaigns').update({
      step_statuses: newStatuses,
      active_step: nextStep <= 13 ? nextStep : waitingStep,
    }).eq('id', campaignId)

    // 回覆確認
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ 已收到核准！步驟 ${waitingStep} 完成，繼續下一步。\n請返回 AI GATE 繼續流程。`,
        }),
      })
    }

    return NextResponse.json({ action: 'approved' })
  } else {
    const newStatuses = {
      ...statuses,
      [String(waitingStep)]: 'rejected',
      [String(contentStep)]: 'pending',
    }
    const newFeedbacks = { ...feedbacks, [String(contentStep)]: matchedFeedback }
    await supabase.from('marketing_campaigns').update({
      step_statuses: newStatuses,
      active_step: contentStep,
      feedbacks: newFeedbacks,
    }).eq('id', campaignId)

    if (chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔄 已收到修改意見！\n\n「${matchedFeedback}」\n\nAI 將依此重新生成，請返回 AI GATE 繼續流程。`,
        }),
      })
    }

    return NextResponse.json({ action: 'feedback', feedback: matchedFeedback, step: contentStep })
  }
}
