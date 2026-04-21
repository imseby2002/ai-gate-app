/**
 * POST /api/marketing/cs-webhook/[platform]/[userId]
 * 用戶專屬客服 Webhook 接收端點（從 Supabase 讀取 API 憑證）
 *
 * 使用 service role key 繞過 RLS，因為 webhook 來自外部平台（無用戶 session）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; userId: string }> }
) {
  const { platform, userId } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const knowledgeBase = ''

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
      const reply = await getAIReply(text, baseUrl, knowledgeBase)
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
      const reply = await getAIReply(text, baseUrl, knowledgeBase)
      if (token && phoneId && to) await replyWhatsApp(to, reply, phoneId, token)
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
    const rawBody = await req.text()
    const msgMatch  = rawBody.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)
    const fromMatch = rawBody.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)
    const toMatch   = rawBody.match(/<ToUserName><!\[CDATA\[(.*?)\]\]><\/ToUserName>/)

    const text = msgMatch?.[1] ?? ''
    const from = fromMatch?.[1] ?? ''
    const to   = toMatch?.[1] ?? ''

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
