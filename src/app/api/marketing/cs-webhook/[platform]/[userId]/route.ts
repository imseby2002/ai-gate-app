/**
 * POST /api/marketing/cs-webhook/[platform]/[userId]
 * 用戶專屬客服 Webhook 接收端點（從 Supabase 讀取 API 憑證）
 *
 * 使用 service role key 繞過 RLS，因為 webhook 來自外部平台（無用戶 session）
 * AI 直接在此呼叫，不轉發至 cs-chat（cs-chat 需要 session auth）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

// ── Supabase service role client ───────────────────────────────────────────────
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Load credentials from DB ──────────────────────────────────────────────────
async function loadCredentials(userId: string, platform: string): Promise<Record<string, string>> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('social_platform_credentials')
    .select('credentials')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single()
  return (data?.credentials as Record<string, string>) ?? {}
}

// ── Load CS knowledge base (unit_data[12]) + company data ────────────────────
interface CsKnowledge {
  systemPrompt: string
  knowledgeBase: string
  escalationThreshold: 'medium' | 'high'
  replyLanguage: string
}

async function loadCsKnowledge(userId: string): Promise<CsKnowledge> {
  const supabase = getServiceClient()

  // Load most recently updated campaign unit_data[12]
  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('unit_data, updated_at')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(10)

  let systemPrompt = ''
  let escalationThreshold: 'medium' | 'high' = 'high'
  let replyLanguage = 'auto'
  const knowledgeParts: string[] = []

  // Find first campaign that has unit_data[12] with content
  if (campaigns?.length) {
    for (const camp of campaigns) {
      const unit12 = (camp.unit_data as Record<string, unknown>)?.[12] as Record<string, unknown> | undefined
      if (!unit12) continue

      if (unit12.systemPrompt) systemPrompt = String(unit12.systemPrompt)
      if (unit12.escalationThreshold) escalationThreshold = unit12.escalationThreshold as 'medium' | 'high'
      if (unit12.replyLanguage) replyLanguage = String(unit12.replyLanguage)

      // Direct text knowledge input
      if (unit12.knowledgeBase) knowledgeParts.push(`【直接輸入知識】\n${String(unit12.knowledgeBase)}`)

      // Dialogue files (CS-specific)
      const dialogueFiles = (unit12.dialogueFiles ?? []) as Array<{ name: string; textContent?: string }>
      for (const f of dialogueFiles) {
        if (f.textContent) {
          knowledgeParts.push(`【知識庫｜${f.name}】\n${f.textContent}`)
        }
      }

      if (systemPrompt || knowledgeParts.length > 0) break
    }
  }

  // Load company data as fallback knowledge
  const { data: companyRow } = await supabase
    .from('company_data')
    .select('data')
    .eq('user_id', userId)
    .single()

  if (companyRow?.data) {
    const cd = companyRow.data as Record<string, unknown>
    // Company FAQ files
    const files = (cd.files ?? []) as Array<{ name: string; textContent?: string }>
    for (const f of files) {
      if (f.textContent) {
        knowledgeParts.push(`【公司資料｜${f.name}】\n${f.textContent}`)
      }
    }
    // Company info text
    if (cd.companyInfo) {
      knowledgeParts.push(`【公司簡介】\n${cd.companyInfo}`)
    }
  }

  return {
    systemPrompt,
    knowledgeBase: knowledgeParts.join('\n\n').slice(0, 8000),
    escalationThreshold,
    replyLanguage,
  }
}

// ── AI reply (直接呼叫 Gemini / Claude，不經過 cs-chat 路由) ─────────────────
async function getAIReply(
  message: string,
  knowledge: CsKnowledge,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const FALLBACK = '感謝您的訊息，我們的客服人員將盡快與您聯繫。'

  try {
    const langInstruction = knowledge.replyLanguage === 'auto'
      ? '請使用與客戶相同的語言回覆。'
      : `請使用 ${knowledge.replyLanguage} 回覆。`

    const baseInstructions = knowledge.systemPrompt?.trim()
      ? knowledge.systemPrompt.trim()
      : '你是一個專業的客服 AI 助理，代表公司提供售後支援。語氣親切專業，回答簡潔明瞭，不捏造資訊。'

    const systemPrompt = `${baseInstructions}

【重要格式規定】
- 禁止使用 Markdown 語法（禁用 **粗體**、*斜體*、# 標題、--- 分隔線）
- ${langInstruction}
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測${knowledge.knowledgeBase ? `\n\n【知識庫參考資料】\n${knowledge.knowledgeBase}` : ''}`

    const messages = [
      ...history.slice(-6),
      { role: 'user' as const, content: message },
    ]

    const geminiKey = process.env.GOOGLE_AI_API_KEY
    if (!geminiKey) return FALLBACK

    const google = createGoogleGenerativeAI({ apiKey: geminiKey })

    // High risk → try Claude first
    const HIGH_RISK_KEYWORDS = ['退款', '退貨', '投訴', '抱怨', '法律', 'refund', 'complaint', 'lawsuit']
    const isHighRisk = HIGH_RISK_KEYWORDS.some(kw => message.toLowerCase().includes(kw.toLowerCase()))

    if (isHighRisk) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey) {
        try {
          const anthropic = createAnthropic({ apiKey: anthropicKey })
          const { text } = await generateText({
            model: anthropic('claude-sonnet-4-5'),
            system: systemPrompt,
            messages,
          })
          return text || FALLBACK
        } catch { /* fall through to Gemini */ }
      }
    }

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages,
    })
    return text || FALLBACK
  } catch {
    return FALLBACK
  }
}

// ── LINE signature verification ───────────────────────────────────────────────
async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return signature === expected
  } catch { return false }
}

// ── Send reply helpers ────────────────────────────────────────────────────────
async function replyLine(replyToken: string, text: string, token: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  })
}

async function replyWhatsApp(to: string, text: string, phoneId: string, token: string) {
  await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  })
}

async function replyTelegram(chatId: string | number, text: string, botToken: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; userId: string }> }
) {
  const { platform, userId } = await params

  // Load CS knowledge base once for all platforms
  const knowledge = await loadCsKnowledge(userId)

  // ── LINE ──────────────────────────────────────────────────────────────────
  if (platform === 'line' || platform === 'line-oa') {
    const creds = await loadCredentials(userId, platform)
    const token     = creds.line_channel_access_token ?? ''
    const secret    = creds.line_channel_secret ?? ''
    const signature = req.headers.get('x-line-signature') ?? ''
    const rawBody   = await req.text()

    if (secret && !(await verifyLineSignature(rawBody, signature, secret))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const events = body?.events ?? []
    for (const event of events) {
      if (event.type !== 'message' || event.message?.type !== 'text') continue
      const text: string = event.message.text
      const replyToken: string = event.replyToken
      const reply = await getAIReply(text, knowledge)
      if (token && replyToken) await replyLine(replyToken, reply, token)
    }
    return NextResponse.json({ ok: true })
  }

  // ── WhatsApp / WhatsApp Business ──────────────────────────────────────────
  if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
    const creds   = await loadCredentials(userId, platform)
    const phoneId = creds.whatsapp_phone_number_id ?? ''
    const token   = creds.whatsapp_access_token ?? ''
    const body    = await req.json()
    const entry   = body?.entry?.[0]
    const changes = entry?.changes?.[0]?.value
    const msgs    = changes?.messages ?? []

    for (const msg of msgs) {
      if (msg.type !== 'text') continue
      const text: string = msg.text?.body ?? ''
      const to: string   = msg.from
      const reply = await getAIReply(text, knowledge)
      if (token && phoneId && to) await replyWhatsApp(to, reply, phoneId, token)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (platform === 'telegram') {
    const creds        = await loadCredentials(userId, 'telegram')
    const botToken     = creds.telegram_bot_token ?? ''
    const adminChatId  = creds.telegram_admin_chat_id ?? ''
    const body         = await req.json()

    // ── Pipeline approval: inline button callback_query ────────────────────
    const cq = body?.callback_query
    if (cq && botToken) {
      const chatId  = String(cq.message?.chat?.id ?? '')
      const cqId    = cq.id as string
      const cqData  = cq.data as string
      const msgId   = cq.message?.message_id as number | undefined

      const ackText = cqData === 'approve' ? '✅ 已核准！' : cqData === 'reject' ? '❌ 已拒絕' : '請輸入修改意見'
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cqId, text: ackText }),
      }).catch(() => {})

      const supabase = getServiceClient()
      const q = supabase
        .from('telegram_approvals')
        .select('id, status')
        .eq('chat_id', chatId)
        .in('status', ['pending', 'awaiting_feedback'])
        .order('created_at', { ascending: false })
        .limit(1)
      if (msgId) q.eq('message_id', msgId)
      const { data: approvals } = await q
      const approval = approvals?.[0]

      if (approval) {
        if (cqData === 'approve') {
          await supabase.from('telegram_approvals').update({ status: 'approved' }).eq('id', approval.id)
        } else if (cqData === 'reject') {
          await supabase.from('telegram_approvals').update({ status: 'rejected' }).eq('id', approval.id)
        } else if (cqData === 'modify') {
          await supabase.from('telegram_approvals').update({ status: 'awaiting_feedback' }).eq('id', approval.id)
          await replyTelegram(chatId, '📝 請輸入您的修改意見：', botToken)
        }
      }
      return NextResponse.json({ ok: true })
    }

    // ── Pipeline approval: text feedback (after tapping ✏️ modify) ─────────
    const message      = body?.message ?? body?.edited_message
    if (message?.text && botToken) {
      const chatId: string | number = message.chat?.id
      const text: string = message.text
      const supabase = getServiceClient()
      const { data: awaitingApprovals } = await supabase
        .from('telegram_approvals')
        .select('id')
        .eq('chat_id', String(chatId))
        .eq('status', 'awaiting_feedback')
        .order('created_at', { ascending: false })
        .limit(1)
      if (awaitingApprovals?.[0]) {
        await supabase.from('telegram_approvals')
          .update({ status: 'feedback', feedback: text })
          .eq('id', awaitingApprovals[0].id)
        await replyTelegram(chatId, `🔄 已收到修改意見！\n\n「${text}」\n\nAI 將依此重新生成，請返回 AI GATE 繼續流程。`, botToken)
        return NextResponse.json({ ok: true })
      }
    }

    if (message?.text && botToken) {
      const chatId: string | number = message.chat?.id
      const text: string            = message.text
      const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || '客戶'
      const isAdmin = adminChatId && String(chatId) === String(adminChatId)

      // ── Admin replying to a forwarded customer message ──────────────────
      if (isAdmin && message.reply_to_message?.text) {
        // Extract customer chat ID embedded in the forwarded message
        const match = message.reply_to_message.text.match(/🆔 ChatID: (-?\d+)/)
        if (match) {
          const customerChatId = match[1]
          await replyTelegram(customerChatId, text, botToken)
        }
        return NextResponse.json({ ok: true })
      }

      // ── Regular customer message ────────────────────────────────────────
      if (chatId && text && !text.startsWith('/') && !isAdmin) {
        // 1. AI auto-reply to customer
        const reply = await getAIReply(text, knowledge)
        await replyTelegram(chatId, reply, botToken)

        // 2. Forward to admin if configured
        if (adminChatId) {
          const forwardMsg =
            `💬 客戶訊息\n` +
            `👤 ${senderName}\n` +
            `🆔 ChatID: ${chatId}\n\n` +
            `「${text}」\n\n` +
            `🤖 AI 已回覆：\n${reply}\n\n` +
            `─────────────\n` +
            `↩️ 直接回覆此訊息可代替 AI 回覆客戶`
          await replyTelegram(adminChatId, forwardMsg, botToken)
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Zalo / Zalo OA ───────────────────────────────────────────────────────
  if (platform === 'zalo' || platform === 'zalo-oa') {
    const creds   = await loadCredentials(userId, platform)
    const oaToken = creds.zalo_oa_access_token ?? ''
    const body    = await req.json()
    const event   = body?.event_name ?? ''
    if (event === 'user_send_text') {
      const text: string     = body?.message?.text ?? ''
      const senderId: string = body?.sender?.id ?? ''
      if (text) {
        const reply = await getAIReply(text, knowledge)
        if (oaToken && senderId) {
          await fetch('https://openapi.zalo.me/v2.0/oa/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: oaToken },
            body: JSON.stringify({ recipient: { user_id: senderId }, message: { text: reply } }),
          })
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── WeChat ────────────────────────────────────────────────────────────────
  if (platform === 'wechat') {
    const rawBody = await req.text()
    const msgMatch  = rawBody.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)
    const fromMatch = rawBody.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)
    const toMatch   = rawBody.match(/<ToUserName><!\[CDATA\[(.*?)\]\]><\/ToUserName>/)

    const text = msgMatch?.[1] ?? ''
    const from = fromMatch?.[1] ?? ''
    const to   = toMatch?.[1] ?? ''

    if (text && from && to) {
      const reply = await getAIReply(text, knowledge)
      const xmlReply = `<xml>
<ToUserName><![CDATA[${from}]]></ToUserName>
<FromUserName><![CDATA[${to}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${reply}]]></Content>
</xml>`
      return new NextResponse(xmlReply, { headers: { 'Content-Type': 'text/xml' } })
    }
    return new NextResponse('success')
  }

  // ── WhatsApp Personal (Baileys Bridge) ───────────────────────────────────
  if (platform === 'whatsapp-personal' || platform === 'whatsapp_personal') {
    const body       = await req.json()
    const text: string = body?.text ?? ''
    const fromJid: string = body?.fromJid ?? (body?.from ? `${body.from}@s.whatsapp.net` : '')

    if (text && fromJid) {
      const reply = await getAIReply(text, knowledge)

      // Reply via Bridge
      const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL?.replace(/\/$/, '')
      const bridgeKey = process.env.WHATSAPP_BRIDGE_API_KEY ?? ''
      if (bridgeUrl && bridgeKey) {
        await fetch(`${bridgeUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': bridgeKey },
          body: JSON.stringify({ userId, to: fromJid, text: reply }),
        }).catch(() => {})
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  if (platform === 'linkedin') {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `不支援的平台: ${platform}` }, { status: 400 })
}

// GET: webhook verification (WhatsApp / LINE require GET verification)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; userId: string }> }
) {
  const { platform, userId } = await params
  const { searchParams } = new URL(req.url)

  // WhatsApp verification
  if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
    const creds       = await loadCredentials(userId, platform)
    const mode        = searchParams.get('hub.mode')
    const token       = searchParams.get('hub.verify_token')
    const challenge   = searchParams.get('hub.challenge')
    const verifyToken = creds.whatsapp_verify_token ?? ''
    if (mode === 'subscribe' && token === verifyToken) {
      return new NextResponse(challenge ?? '', { status: 200 })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Zalo OA verification
  if (platform === 'zalo' || platform === 'zalo-oa') {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true, platform, userId, status: 'webhook active' })
}
