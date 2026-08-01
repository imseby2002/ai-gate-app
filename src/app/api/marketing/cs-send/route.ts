/**
 * POST /api/marketing/cs-send
 * 客服人員從網頁收件匣主動回覆客戶（推回 LINE / WhatsApp / Telegram … 原平台）。
 *
 * - 權限：登入且具當前商家的客服存取權（getBnbContext 'cs'）
 * - 送訊：sendToCustomer（各平台主動推播）
 * - 記錄：寫入 cs_messages（intent='agent'）+ 接到 cs_conversations.history
 * - 接管：自動建立 open 的「人工客服請求」工單 → AI 在此期間停止自動回覆
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { sendToCustomer } from '@/lib/cs/send'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, to, text, industry = 'homestay', fromName } = await req.json()
  const message = String(text ?? '').trim()
  if (!platform || !to) return NextResponse.json({ error: '缺少 platform 或 to' }, { status: 400 })
  if (!message) return NextResponse.json({ error: '訊息不可為空' }, { status: 400 })

  const admin = await createAdminClient()
  const now = new Date().toISOString()

  // LINE 省額度：取客戶最近未用的 reply token，1 分鐘內可走免費 Reply API
  let lineReplyToken: string | undefined
  const isLine = platform === 'line' || platform === 'line-oa'
  if (isLine) {
    try {
      const { data: tok } = await admin
        .from('cs_reply_tokens').select('reply_token, created_at')
        .eq('user_id', ctx.ownerId).eq('platform', platform).eq('from_id', to)
        .maybeSingle()
      if (tok?.reply_token && Date.now() - new Date(tok.created_at).getTime() < 60_000) {
        lineReplyToken = tok.reply_token
      }
    } catch { /* 表未建立 → 略過，直接 Push */ }
  }

  // 1. 推回原平台（LINE 有 token 則優先 Reply API，失敗自動 fallback Push）
  const result = await sendToCustomer(ctx.ownerId, platform, to, message, { lineReplyToken })
  if (!result.ok) return NextResponse.json({ error: result.error ?? '送訊失敗' }, { status: 502 })

  // reply token 一次性，無論結果如何用完即刪
  if (isLine) {
    admin.from('cs_reply_tokens').delete()
      .eq('user_id', ctx.ownerId).eq('platform', platform).eq('from_id', to)
      .then(() => {}, () => {})
  }

  // 2. 記錄 agent 回覆（供收件匣 thread 顯示，並計入指標）
  await admin.from('cs_messages').insert({
    user_id: ctx.ownerId, industry, platform, from_id: to,
    from_name: fromName ?? null, message: '', reply: message, intent: 'agent',
  }).then(() => {}, () => {})

  // 3. 接到對話歷史（AI 之後若恢復，能看見人工說過的話）
  try {
    const { data: conv } = await admin
      .from('cs_conversations').select('history')
      .eq('user_id', ctx.ownerId).eq('customer_id', to).single()
    const history = Array.isArray(conv?.history) ? conv!.history : []
    history.push({ role: 'assistant', content: message })
    await admin.from('cs_conversations').upsert(
      { user_id: ctx.ownerId, customer_id: to, history: history.slice(-20), updated_at: now },
      { onConflict: 'user_id,customer_id' }
    )
  } catch (err) { console.error('[cs-send] cs_conversations 更新失敗:', err) }

  // 4. 自動接管：確保有 open 的人工客服工單（webhook 會據此讓 AI 靜音）
  try {
    const { data: open } = await admin
      .from('cs_tickets').select('id')
      .eq('user_id', ctx.ownerId).eq('from_id', to)
      .eq('intent', '人工客服請求').in('status', ['open', 'in_progress'])
      .limit(1)
    if (!open?.length) {
      await admin.from('cs_tickets').insert({
        user_id: ctx.ownerId, industry, platform, from_id: to,
        from_name: fromName ?? null, subject: '真人接管中', description: '客服人員已於收件匣接手此對話',
        priority: 'high', intent: '人工客服請求', status: 'open',
      })
    }
  } catch { /* 不中斷送訊結果 */ }

  return NextResponse.json({ ok: true, sentAt: now })
}
