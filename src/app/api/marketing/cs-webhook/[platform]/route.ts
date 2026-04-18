/**
 * POST /api/marketing/cs-webhook/[platform]
 * 統一客服 Webhook 接收端點
 *
 * 支援平台：line | whatsapp | zalo | line-oa | whatsapp-biz | zalo-oa | linkedin | wechat
 *
 * 各平台 Webhook URL（設定到各平台後台）：
 *   https://your-domain.com/api/marketing/cs-webhook/line
 *   https://your-domain.com/api/marketing/cs-webhook/whatsapp
 *   ... etc.
 *
 * 收到訊息後 → 呼叫 /api/marketing/cs-chat → 回覆給客戶
 */
import { NextRequest, NextResponse } from 'next/server'

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

// ── Fetch AI reply ────────────────────────────────────────────────────────────
async function getAIReply(message: string, baseUrl: string, knowledgeBase: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/api/marketing/cs-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, knowledgeBase }),
    })
    if (!res.ok) return '感謝您的訊息，我們的客服人員將盡快與您聯繫。'
    const data = await res.json()
    return data.reply ?? '感謝您的訊息，我們的客服人員將盡快與您聯繫。'
  } catch {
    return '感謝您的訊息，我們的客服人員將盡快與您聯繫。'
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const knowledgeBase = process.env.CS_KNOWLEDGE_BASE ?? ''

  // ── LINE ──────────────────────────────────────────────────────────────────
  if (platform === 'line' || platform === 'line-oa') {
    const token     = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''
    const secret    = process.env.LINE_CHANNEL_SECRET ?? ''
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
      const reply = await getAIReply(text, baseUrl, knowledgeBase)
      if (token && replyToken) await replyLine(replyToken, reply, token)
    }
    return NextResponse.json({ ok: true })
  }

  // ── WhatsApp / WhatsApp Business ──────────────────────────────────────────
  if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
    const token   = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
    const body    = await req.json()
    const entry   = body?.entry?.[0]
    const changes = entry?.changes?.[0]?.value
    const msgs    = changes?.messages ?? []

    for (const msg of msgs) {
      if (msg.type !== 'text') continue
      const text: string = msg.text?.body ?? ''
      const to: string   = msg.from
      const reply = await getAIReply(text, baseUrl, knowledgeBase)
      if (token && phoneId && to) await replyWhatsApp(to, reply, phoneId, token)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Zalo / Zalo OA ───────────────────────────────────────────────────────
  if (platform === 'zalo' || platform === 'zalo-oa') {
    const oaToken = process.env.ZALO_OA_ACCESS_TOKEN ?? ''
    const body = await req.json()
    const event = body?.event_name ?? ''
    if (event === 'user_send_text') {
      const text: string   = body?.message?.text ?? ''
      const senderId: string = body?.sender?.id ?? ''
      if (text) {
        const reply = await getAIReply(text, baseUrl, knowledgeBase)
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
    // WeChat uses XML, basic passive reply
    const rawBody = await req.text()
    const msgMatch = rawBody.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)
    const fromMatch = rawBody.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)
    const toMatch   = rawBody.match(/<ToUserName><!\[CDATA\[(.*?)\]\]><\/ToUserName>/)

    const text   = msgMatch?.[1] ?? ''
    const from   = fromMatch?.[1] ?? ''
    const to     = toMatch?.[1] ?? ''

    if (text && from && to) {
      const reply = await getAIReply(text, baseUrl, knowledgeBase)
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

  // ── LinkedIn (incoming only — no direct reply API for general messages) ───
  if (platform === 'linkedin') {
    // LinkedIn Message Events API — log only
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `不支援的平台: ${platform}` }, { status: 400 })
}

// GET: webhook verification (WhatsApp / LINE require GET verification)
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  const { searchParams } = new URL(req.url)

  // WhatsApp verification
  if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
    const mode      = searchParams.get('hub.mode')
    const token     = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? ''
    if (mode === 'subscribe' && token === verifyToken) {
      return new NextResponse(challenge ?? '', { status: 200 })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Zalo OA verification
  if (platform === 'zalo' || platform === 'zalo-oa') {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true, platform, status: 'webhook active' })
}
