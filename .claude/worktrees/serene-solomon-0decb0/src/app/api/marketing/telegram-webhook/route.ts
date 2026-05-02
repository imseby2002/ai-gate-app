/**
 * Telegram Webhook — receives messages and callback_query from the Telegram bot
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

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const APPROVE_KEYWORDS = ['核准', '通過', '同意', 'ok', 'OK', 'approve', 'yes', '好', '可以', '👍', '✅']

function detectAction(text: string): 'approved' | 'feedback' {
  const lower = text.trim().toLowerCase()
  for (const kw of APPROVE_KEYWORDS) {
    if (lower === kw.toLowerCase() || lower.startsWith(kw.toLowerCase())) return 'approved'
  }
  return 'feedback'
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

async function answerCallback(callbackQueryId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = getServiceClient()

  // ── Handle inline button callback_query ──────────────────────────────────
  const cq = body?.callback_query
  if (cq) {
    const chatId      = String(cq.message?.chat?.id ?? '')
    const cqId        = cq.id as string
    const cqData      = cq.data as string
    const cqMsgId     = cq.message?.message_id as number | undefined
    const fromUser    = cq.from?.username ?? cq.from?.first_name ?? 'unknown'

    // Find matching telegram_approval (pipeline interactive flow)
    const approvalQuery = supabase
      .from('telegram_approvals')
      .select('id, status')
      .eq('chat_id', chatId)
      .in('status', ['pending', 'awaiting_feedback'])
      .order('created_at', { ascending: false })
      .limit(1)
    if (cqMsgId) approvalQuery.eq('message_id', cqMsgId)
    const { data: approvals } = await approvalQuery
    const approval = approvals?.[0]

    // Find running campaign for this chat
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('id, active_step, step_statuses, feedbacks')
      .eq('telegram_chat_id', chatId)
      .eq('status', 'running')
      .order('updated_at', { ascending: false })
      .limit(1)

    const campaign = campaigns?.[0]

    if (cqData === 'approve') {
      await answerCallback(cqId, '✅ 已核准！')

      // Update telegram_approvals so the polling loop can resolve
      if (approval) {
        await supabase.from('telegram_approvals')
          .update({ status: 'approved' })
          .eq('id', approval.id)
      }

      if (campaign) {
        const telegramSteps = [5, 7, 9, 11, 13]
        const statuses: Record<string, string> = campaign.step_statuses ?? {}
        const waitingStep = telegramSteps.find(s => statuses[String(s)] === 'waiting')
        if (waitingStep) {
          const newStatuses = { ...statuses, [String(waitingStep)]: 'approved' }
          const nextStep = waitingStep + 1
          await supabase.from('marketing_campaigns').update({
            step_statuses: newStatuses,
            active_step: nextStep <= 13 ? nextStep : waitingStep,
          }).eq('id', campaign.id)
          await supabase.from('marketing_telegram_events').insert({
            campaign_id: campaign.id, step_id: waitingStep,
            telegram_user: fromUser, message_text: 'approve (button)', action: 'approved',
          })
          await sendTelegramReply(chatId, `✅ 已核准！步驟 ${waitingStep} 完成，繼續下一步。`)
        }
      }

    } else if (cqData === 'reject') {
      await answerCallback(cqId, '❌ 已拒絕')

      // Update telegram_approvals so the polling loop can resolve
      if (approval) {
        await supabase.from('telegram_approvals')
          .update({ status: 'rejected' })
          .eq('id', approval.id)
      }

      if (campaign) {
        const telegramSteps = [5, 7, 9, 11, 13]
        const statuses: Record<string, string> = campaign.step_statuses ?? {}
        const waitingStep = telegramSteps.find(s => statuses[String(s)] === 'waiting')
        if (waitingStep) {
          const contentStep = waitingStep - 1
          const newStatuses = {
            ...statuses,
            [String(waitingStep)]: 'rejected',
            [String(contentStep)]: 'pending',
          }
          const feedbacks = { ...(campaign.feedbacks ?? {}), [String(contentStep)]: '拒絕' }
          await supabase.from('marketing_campaigns').update({
            step_statuses: newStatuses,
            active_step: contentStep,
            feedbacks,
          }).eq('id', campaign.id)
          await supabase.from('marketing_telegram_events').insert({
            campaign_id: campaign.id, step_id: waitingStep,
            telegram_user: fromUser, message_text: 'reject (button)', action: 'feedback',
          })
          await sendTelegramReply(chatId, `❌ 已拒絕，AI 將重新生成，請返回 AI GATE 繼續流程。`)
        }
      }

    } else if (cqData === 'modify') {
      await answerCallback(cqId, '請輸入修改意見')
      await sendTelegramReply(chatId, '📝 請輸入您的修改意見：')

      // Update telegram_approvals to awaiting_feedback
      if (approval) {
        await supabase.from('telegram_approvals')
          .update({ status: 'awaiting_feedback' })
          .eq('id', approval.id)
      }

      if (campaign) {
        const telegramSteps = [5, 7, 9, 11, 13]
        const statuses: Record<string, string> = campaign.step_statuses ?? {}
        const waitingStep = telegramSteps.find(s => statuses[String(s)] === 'waiting')
        if (waitingStep) {
          await supabase.from('marketing_campaigns').update({
            step_statuses: { ...statuses, [String(waitingStep)]: 'awaiting_feedback' },
          }).eq('id', campaign.id)
        }
      }
    }

    return NextResponse.json({ ok: true })
  }

  // ── Handle text message ──────────────────────────────────────────────────
  const message = body?.message ?? body?.edited_message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId   = String(message.chat?.id)
  const fromUser = message.from?.username ?? message.from?.first_name ?? 'unknown'
  const text: string = message.text

  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('id, active_step, step_statuses, feedbacks')
    .eq('telegram_chat_id', chatId)
    .eq('status', 'running')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (!campaigns || campaigns.length === 0) return NextResponse.json({ ok: true })

  const campaign = campaigns[0]
  const telegramSteps = [5, 7, 9, 11, 13]
  const statuses: Record<string, string> = campaign.step_statuses ?? {}

  // Find pending telegram_approval for this chat (for pipeline polling resolution)
  const { data: pendingApprovals } = await supabase
    .from('telegram_approvals')
    .select('id, status')
    .eq('chat_id', chatId)
    .in('status', ['pending', 'awaiting_feedback'])
    .order('created_at', { ascending: false })
    .limit(1)
  const pendingApproval = pendingApprovals?.[0]

  // Check for awaiting_feedback state (user tapped ✏️ and is now typing)
  const awaitingStep = telegramSteps.find(s => statuses[String(s)] === 'awaiting_feedback')
  if (awaitingStep) {
    const contentStep = awaitingStep - 1
    const newStatuses = {
      ...statuses,
      [String(awaitingStep)]: 'rejected',
      [String(contentStep)]: 'pending',
    }
    const feedbacks = { ...(campaign.feedbacks ?? {}), [String(contentStep)]: text }
    await supabase.from('marketing_campaigns').update({
      step_statuses: newStatuses,
      active_step: contentStep,
      feedbacks,
    }).eq('id', campaign.id)
    await supabase.from('marketing_telegram_events').insert({
      campaign_id: campaign.id, step_id: awaitingStep,
      telegram_user: fromUser, message_text: text, action: 'feedback',
    })
    // Resolve the polling loop
    if (pendingApproval) {
      await supabase.from('telegram_approvals')
        .update({ status: 'feedback', feedback: text })
        .eq('id', pendingApproval.id)
    }
    await sendTelegramReply(chatId, `🔄 已收到修改意見！\n\n「${text}」\n\nAI 將依此重新生成，請返回 AI GATE 繼續流程。`)
    return NextResponse.json({ ok: true })
  }

  // Normal keyword detection for waiting step
  const waitingStep = telegramSteps.find(s => statuses[String(s)] === 'waiting')
  if (!waitingStep) return NextResponse.json({ ok: true })

  const action = detectAction(text)
  const feedbacks: Record<string, string> = campaign.feedbacks ?? {}

  await supabase.from('marketing_telegram_events').insert({
    campaign_id: campaign.id, step_id: waitingStep,
    telegram_user: fromUser, message_text: text, action,
  })

  if (action === 'approved') {
    const newStatuses = { ...statuses, [String(waitingStep)]: 'approved' }
    const nextStep = waitingStep + 1
    await supabase.from('marketing_campaigns').update({
      step_statuses: newStatuses,
      active_step: nextStep <= 13 ? nextStep : waitingStep,
    }).eq('id', campaign.id)
    await sendTelegramReply(chatId, `✅ 已收到核准！步驟 ${waitingStep} 完成，繼續下一步。\n\n請返回 AI GATE 繼續流程。`)
  } else {
    const contentStep = waitingStep - 1
    const newStatuses = {
      ...statuses,
      [String(waitingStep)]: 'rejected',
      [String(contentStep)]: 'pending',
    }
    const newFeedbacks = { ...feedbacks, [String(contentStep)]: text }
    await supabase.from('marketing_campaigns').update({
      step_statuses: newStatuses,
      active_step: contentStep,
      feedbacks: newFeedbacks,
    }).eq('id', campaign.id)
    await sendTelegramReply(chatId, `🔄 已收到修改意見！\n\n「${text}」\n\nAI 將根據您的建議重新生成，請返回 AI GATE 繼續流程。`)
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: 'Telegram webhook endpoint for AI GATE Marketing Automation',
    setup: 'POST https://api.telegram.org/bot{TOKEN}/setWebhook?url={APP_URL}/api/marketing/telegram-webhook',
  })
}
