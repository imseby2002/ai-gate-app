/**
 * POST /api/marketing/telegram-poll
 *
 * Mode A — approvalId (interactive approval via inline buttons):
 *   Body: { approvalId: string }
 *   - Polls getUpdates on user's bot token
 *   - Detects callback_query (button tap) or text feedback
 *   - Updates telegram_approvals table
 *   - Returns { action: 'none'|'approved'|'rejected'|'feedback'|'awaiting_feedback', feedback? }
 *
 * Mode B — campaignId (legacy campaign step flow):
 *   Body: { campaignId: string }
 *   - Same as before: polls for campaign step_statuses
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

async function answerCallback(token: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {/* silent */})
}

async function sendTgMessage(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {/* silent */})
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { approvalId, campaignId } = body

  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('id', user.id)
    .single()

  const token = profile?.telegram_bot_token
  if (!token) return NextResponse.json({ action: 'none', reason: 'no_token' })

  // ── Mode A: approvalId ────────────────────────────────────────────────────
  if (approvalId) {
    const { data: approval } = await supabase
      .from('telegram_approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('user_id', user.id)
      .single()

    if (!approval) return NextResponse.json({ action: 'none' })

    // Already resolved — return immediately
    if (!['pending', 'awaiting_feedback'].includes(approval.status)) {
      return NextResponse.json({ action: approval.status, feedback: approval.feedback })
    }

    // Poll Telegram getUpdates
    const offset = ((approval.last_update_id as number) ?? 0) + 1
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0&limit=20`
    )
    if (!tgRes.ok) return NextResponse.json({ action: 'none', reason: 'telegram_error' })

    const tgData = await tgRes.json()
    if (!tgData.ok || !tgData.result?.length) {
      return NextResponse.json({ action: 'none' })
    }

    let lastUpdateId = (approval.last_update_id as number) ?? 0
    let resultAction: string | null = null
    let resultFeedback = ''

    for (const update of tgData.result as Record<string, unknown>[]) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id as number)

      // ── callback_query (button tap) ──────────────────────────────────────
      const cq = update.callback_query as Record<string, unknown> | undefined
      if (cq) {
        const cqMsg = cq.message as Record<string, unknown> | undefined
        const cqMsgId = cqMsg?.message_id as number | undefined
        const cqChatId = String((cqMsg?.chat as Record<string, unknown> | undefined)?.id ?? '')

        // Match by message_id (if stored) or fallback to chatId match
        const matchesMsg = approval.message_id
          ? cqMsgId === approval.message_id
          : cqChatId === approval.chat_id

        if (!matchesMsg) continue

        const cqData = cq.data as string
        const cqId   = cq.id as string

        if (cqData === 'approve') {
          await answerCallback(token, cqId, '✅ 已核准！')
          resultAction = 'approved'
          break
        } else if (cqData === 'reject') {
          await answerCallback(token, cqId, '❌ 已拒絕')
          resultAction = 'rejected'
          break
        } else if (cqData === 'modify') {
          await answerCallback(token, cqId, '請輸入修改意見')
          await sendTgMessage(token, approval.chat_id as string, '📝 請輸入您的修改意見：')
          await supabase.from('telegram_approvals').update({
            status: 'awaiting_feedback',
            last_update_id: lastUpdateId,
          }).eq('id', approvalId)
          return NextResponse.json({ action: 'awaiting_feedback' })
        }
        continue
      }

      // ── text message (awaiting_feedback mode) ────────────────────────────
      if (approval.status === 'awaiting_feedback') {
        const msg = (update.message ?? update.edited_message) as Record<string, unknown> | undefined
        if (msg?.text) {
          const fromChatId = String((msg.chat as Record<string, unknown> | undefined)?.id ?? '')
          if (fromChatId === approval.chat_id) {
            resultAction  = 'feedback'
            resultFeedback = msg.text as string
            break
          }
        }
      }
    }

    // Persist and return
    if (resultAction) {
      await supabase.from('telegram_approvals').update({
        status:         resultAction,
        feedback:       resultFeedback || null,
        last_update_id: lastUpdateId,
      }).eq('id', approvalId)
      return NextResponse.json({ action: resultAction, feedback: resultFeedback || undefined })
    }

    await supabase.from('telegram_approvals').update({
      last_update_id: lastUpdateId,
    }).eq('id', approvalId)

    return NextResponse.json({ action: 'none' })
  }

  // ── Mode B: campaignId (legacy) ───────────────────────────────────────────
  if (!campaignId) return NextResponse.json({ error: 'approvalId or campaignId required' }, { status: 400 })

  const [{ data: campaign }] = await Promise.all([
    supabase
      .from('marketing_campaigns')
      .select('id, active_step, step_statuses, feedbacks, telegram_chat_id, telegram_last_update_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single(),
  ])

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const telegramSteps = [5, 7, 9, 11, 13]
  const statuses: Record<string, string> = campaign.step_statuses ?? {}
  const waitingStep = telegramSteps.find(s => statuses[String(s)] === 'waiting')
  if (!waitingStep) return NextResponse.json({ action: 'none', reason: 'no_waiting_step' })

  const chatId = campaign.telegram_chat_id || profile?.telegram_chat_id
  const offset = ((campaign.telegram_last_update_id as number) ?? 0) + 1

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0&limit=10`
  )
  if (!tgRes.ok) return NextResponse.json({ action: 'none', reason: 'telegram_error' })

  const tgData = await tgRes.json()
  if (!tgData.ok || !tgData.result?.length) return NextResponse.json({ action: 'none' })

  let lastUpdateId = (campaign.telegram_last_update_id as number) ?? 0
  let matchedAction: 'approved' | 'feedback' | null = null
  let matchedFeedback = ''

  for (const update of tgData.result as Record<string, unknown>[]) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id as number)

    // Handle inline button taps for campaign flow
    const cq = update.callback_query as Record<string, unknown> | undefined
    if (cq) {
      const cqChatId = String(((cq.message as Record<string, unknown> | undefined)?.chat as Record<string, unknown> | undefined)?.id ?? '')
      if (chatId && cqChatId !== String(chatId)) continue
      const cqData = cq.data as string
      const cqId   = cq.id as string
      if (cqData === 'approve') {
        await answerCallback(token, cqId, '✅ 已核准！')
        matchedAction = 'approved'
        break
      } else if (cqData === 'reject') {
        await answerCallback(token, cqId, '❌ 已拒絕')
        matchedFeedback = '拒絕'
        matchedAction = 'feedback'
        break
      } else if (cqData === 'modify') {
        await answerCallback(token, cqId, '請輸入修改意見')
        await sendTgMessage(token, String(chatId), '📝 請輸入您的修改意見：')
      }
      continue
    }

    const msg = (update.message ?? update.edited_message) as Record<string, unknown> | undefined
    if (!msg?.text) continue
    const fromChatId = String((msg.chat as Record<string, unknown> | undefined)?.id ?? '')
    if (chatId && fromChatId !== String(chatId).replace('@', '')) {
      if (!String(chatId).startsWith('@')) continue
    }
    if (!matchedAction) {
      matchedAction   = detectAction(msg.text as string)
      matchedFeedback = msg.text as string
    }
  }

  await supabase
    .from('marketing_campaigns')
    .update({ telegram_last_update_id: lastUpdateId })
    .eq('id', campaignId)

  if (!matchedAction) return NextResponse.json({ action: 'none' })

  const feedbacks: Record<string, string> = campaign.feedbacks ?? {}
  const contentStep = waitingStep - 1

  if (matchedAction === 'approved') {
    const nextStep = waitingStep + 1
    const newStatuses = { ...statuses, [String(waitingStep)]: 'approved' }
    await supabase.from('marketing_campaigns').update({
      step_statuses: newStatuses,
      active_step: nextStep <= 13 ? nextStep : waitingStep,
    }).eq('id', campaignId)

    if (chatId) {
      await sendTgMessage(token, String(chatId),
        `✅ 已收到核准！步驟 ${waitingStep} 完成，繼續下一步。\n請返回 AI GATE 繼續流程。`)
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
      await sendTgMessage(token, String(chatId),
        `🔄 已收到修改意見！\n\n「${matchedFeedback}」\n\nAI 將依此重新生成，請返回 AI GATE 繼續流程。`)
    }
    return NextResponse.json({ action: 'feedback', feedback: matchedFeedback, step: contentStep })
  }
}
