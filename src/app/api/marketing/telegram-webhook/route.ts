/**
 * Telegram Webhook — receives messages from the Telegram bot
 *
 * Setup (one-time):
 *   curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
 *        -d "url=https://your-domain.com/api/marketing/telegram-webhook" \
 *        -d "secret_token=YOUR_WEBHOOK_SECRET"
 *
 * ENV required:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET   (optional but recommended)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service-role client — webhook has no user session
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Keywords for approval
const APPROVE_KEYWORDS = ['核准', '通過', '同意', 'ok', 'OK', 'approve', 'yes', '好', '可以', '👍', '✅']

function detectAction(text: string): 'approved' | 'feedback' {
  const lower = text.trim().toLowerCase()
  for (const kw of APPROVE_KEYWORDS) {
    if (lower === kw.toLowerCase() || lower.startsWith(kw.toLowerCase())) {
      return 'approved'
    }
  }
  return 'feedback'
}

// Parse campaign_id and step_id from message context
// Bot sends messages with a hidden tag: [campaign:UUID:step:N]
function parseContext(text: string): { campaignId: string; stepId: number } | null {
  const match = text.match(/\[campaign:([a-f0-9-]{36}):step:(\d+)\]/i)
  if (!match) return null
  return { campaignId: match[1], stepId: parseInt(match[2]) }
}

export async function POST(req: NextRequest) {
  // Verify secret token
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const message = body?.message ?? body?.edited_message
  if (!message?.text) {
    return NextResponse.json({ ok: true }) // ignore non-text updates
  }

  const chatId = String(message.chat?.id)
  const fromUser = message.from?.username ?? message.from?.first_name ?? 'unknown'
  const text: string = message.text

  const supabase = getServiceClient()

  // Find campaign by telegram_chat_id
  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('id, active_step, step_statuses, feedbacks')
    .eq('telegram_chat_id', chatId)
    .eq('status', 'running')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (!campaigns || campaigns.length === 0) {
    // No active campaign for this chat — ignore silently
    return NextResponse.json({ ok: true })
  }

  const campaign = campaigns[0]

  // Determine which step is waiting for Telegram approval
  // Telegram steps: 5, 7, 9, 11, 13
  const telegramSteps = [5, 7, 9, 11, 13]
  const statuses: Record<string, string> = campaign.step_statuses ?? {}
  const waitingStep = telegramSteps.find(s => statuses[String(s)] === 'waiting')

  if (!waitingStep) {
    return NextResponse.json({ ok: true }) // nothing waiting
  }

  const action = detectAction(text)
  const feedbacks: Record<string, string> = campaign.feedbacks ?? {}

  // Record the event
  await supabase.from('marketing_telegram_events').insert({
    campaign_id: campaign.id,
    step_id: waitingStep,
    telegram_user: fromUser,
    message_text: text,
    action,
  })

  if (action === 'approved') {
    // Advance: mark step approved, set next step active
    const newStatuses = { ...statuses, [String(waitingStep)]: 'approved' }
    const nextStep = waitingStep + 1
    await supabase
      .from('marketing_campaigns')
      .update({
        step_statuses: newStatuses,
        active_step: nextStep <= 13 ? nextStep : waitingStep,
      })
      .eq('id', campaign.id)

    // Reply on Telegram
    await sendTelegramReply(chatId, `✅ 已收到核准！步驟 ${waitingStep} 完成，繼續下一步驟。\n\n請返回 AI GATE 繼續流程。`)
  } else {
    // Feedback: mark step rejected, store feedback, go back to content step
    const contentStep = waitingStep - 1
    const newStatuses = {
      ...statuses,
      [String(waitingStep)]: 'rejected',
      [String(contentStep)]: 'pending',
    }
    const newFeedbacks = { ...feedbacks, [String(contentStep)]: text }
    await supabase
      .from('marketing_campaigns')
      .update({
        step_statuses: newStatuses,
        active_step: contentStep,
        feedbacks: newFeedbacks,
      })
      .eq('id', campaign.id)

    await sendTelegramReply(chatId, `🔄 已收到修改意見！\n\n「${text}」\n\nAI 將根據您的建議重新生成，請返回 AI GATE 繼續流程。`)
  }

  return NextResponse.json({ ok: true })
}

async function sendTelegramReply(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

// GET: used for webhook health check / manual setup info
export async function GET() {
  return NextResponse.json({
    ok: true,
    info: 'Telegram webhook endpoint for AI GATE Marketing Automation',
    setup: 'POST https://api.telegram.org/bot{TOKEN}/setWebhook?url={APP_URL}/api/marketing/telegram-webhook',
  })
}
