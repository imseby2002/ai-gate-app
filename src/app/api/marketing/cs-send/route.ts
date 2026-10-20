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
import { sendToCustomer, sendImageToCustomer, HUMAN_AGENT_TAG } from '@/lib/cs/send'
import { STAFF_ACTIVE_SUBJECT } from '@/lib/cs/handoff'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, to, text, industry = 'homestay', fromName, imagePath } = await req.json()
  const message = String(text ?? '').trim()
  // 圖片：先由 /api/marketing/cs-upload 存到 cs-media，這裡只收路徑；只能送自己商家資料夾裡的圖
  const image = typeof imagePath === 'string' && imagePath.startsWith(`${ctx.ownerId}/`) ? imagePath : null
  if (!platform || !to) return NextResponse.json({ error: '缺少 platform 或 to' }, { status: 400 })
  if (!message && !image) return NextResponse.json({ error: '訊息不可為空' }, { status: 400 })

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

  // 真人客服頭像與暱稱（從 unit_data[12] 取得）
  let senderProfile: { name?: string; iconUrl?: string } | undefined
  if (isLine) {
    try {
      const { data: campaign } = await admin
        .from('marketing_campaigns')
        .select('unit_data')
        .eq('user_id', ctx.ownerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const u12 = (campaign?.unit_data as Record<string, any> | undefined)?.['12']
      if (u12) {
        const name = String(u12.humanSenderName ?? '').trim()
        const iconUrl = String(u12.humanSenderIconUrl ?? '').trim()
        if (name || iconUrl) {
          senderProfile = {
            ...(name ? { name } : {}),
            ...(iconUrl ? { iconUrl } : {}),
          }
        }
      }
    } catch { /* 容錯 */ }
  }

  // 1. 推回原平台（LINE 有 token 則優先 Reply API，失敗自動 fallback Push）
  if (image) {
    // 平台伺服器要能抓到圖：給 30 天有效的簽名網址
    const { data: signed } = await admin.storage.from('cs-media').createSignedUrl(image, 30 * 86400)
    if (!signed?.signedUrl) return NextResponse.json({ error: '圖片不存在或已失效' }, { status: 400 })
    const imgResult = await sendImageToCustomer(ctx.ownerId, platform, to, signed.signedUrl, { lineReplyToken, sender: senderProfile })
    if (!imgResult.ok) return NextResponse.json({ error: imgResult.error ?? '傳圖失敗' }, { status: 502 })
    lineReplyToken = undefined  // reply token 一次性，已用在圖片
  }
  if (message) {
    const result = await sendToCustomer(ctx.ownerId, platform, to, message, {
      lineReplyToken,
      sender: senderProfile,
    })
    if (!result.ok) return NextResponse.json({ error: result.error ?? '送訊失敗' }, { status: 502 })
  }

  // reply token 一次性，無論結果如何用完即刪
  if (isLine) {
    admin.from('cs_reply_tokens').delete()
      .eq('user_id', ctx.ownerId).eq('platform', platform).eq('from_id', to)
      .then(() => {}, () => {})
  }

  // 2. 記錄 agent 回覆（供收件匣 thread 顯示，並計入指標）
  if (image) {
    await admin.from('cs_messages').insert({
      user_id: ctx.ownerId, industry, platform, from_id: to,
      from_name: fromName ?? null, message: '', reply: '【圖片】', intent: 'agent', image_path: image,
    }).then(() => {}, () => {})
  }
  if (message) {
    await admin.from('cs_messages').insert({
      user_id: ctx.ownerId, industry, platform, from_id: to,
      from_name: fromName ?? null, message: '', reply: message, intent: 'agent',
    }).then(() => {}, () => {})
  }

  // 3. 接到對話歷史（AI 之後若恢復，能看見人工說過的話）
  try {
    const { data: conv } = await admin
      .from('cs_conversations').select('history')
      .eq('user_id', ctx.ownerId).eq('customer_id', to).single()
    const history = Array.isArray(conv?.history) ? conv!.history : []
    if (image) history.push({ role: 'assistant', content: `${HUMAN_AGENT_TAG}【傳送了一張圖片】` })
    if (message) history.push({ role: 'assistant', content: `${HUMAN_AGENT_TAG}${message}` })
    await admin.from('cs_conversations').upsert(
      { user_id: ctx.ownerId, customer_id: to, history: history.slice(-60), updated_at: now },
      { onConflict: 'user_id,customer_id' }
    )
  } catch (err) { console.error('[cs-send] cs_conversations 更新失敗:', err) }

  // 4. 自動接管：確保有 open 的人工客服工單（webhook 會據此讓 AI 靜音 2 小時）
  try {
    const { data: open } = await admin
      .from('cs_tickets').select('id')
      .eq('user_id', ctx.ownerId).eq('from_id', to)
      .eq('intent', '人工客服請求').in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
    if (!open?.length) {
      await admin.from('cs_tickets').insert({
        user_id: ctx.ownerId, industry, platform, from_id: to,
        from_name: fromName ?? null, subject: STAFF_ACTIVE_SUBJECT, description: '客服人員已於收件匣接手此對話',
        priority: 'high', intent: '人工客服請求', status: 'open',
      })
    } else {
      // 專員回覆時刷新工單時間並標為員工接管，閒置計時從現在重新開始（見 lib/cs/handoff.ts）
      await admin.from('cs_tickets').update({
        subject: STAFF_ACTIVE_SUBJECT,
        created_at: now,
        updated_at: now,
        status: 'open',
      }).eq('id', open[0].id)
    }
  } catch { /* 不中斷送訊結果 */ }

  return NextResponse.json({ ok: true, sentAt: now })
}
