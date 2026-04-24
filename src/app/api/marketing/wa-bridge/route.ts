/**
 * /api/marketing/wa-bridge
 *
 * Proxy 到 Oracle Cloud 上的 Baileys Bridge 伺服器
 * 需要 Vercel 環境變數:
 *   WHATSAPP_BRIDGE_URL      例: http://1.2.3.4:3001
 *   WHATSAPP_BRIDGE_API_KEY  Bridge 的 API 金鑰
 *
 * GET  ?action=qr&userId=xxx     → 取得 QR code
 * GET  ?action=status&userId=xxx → 取得連線狀態
 * POST { action:'start', userId } → 啟動 session
 * POST { action:'disconnect', userId } → 中斷連線
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getBridgeUrl() {
  return process.env.WHATSAPP_BRIDGE_URL?.replace(/\/$/, '') ?? ''
}
function getBridgeKey() {
  return process.env.WHATSAPP_BRIDGE_API_KEY ?? ''
}

async function bridgeFetch(path: string, init?: RequestInit) {
  const url = getBridgeUrl()
  const key = getBridgeKey()
  if (!url) throw new Error('WHATSAPP_BRIDGE_URL not configured')
  return fetch(`${url}${path}`, {
    ...init,
    headers: { 'x-api-key': key, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const userId = user.id  // always use authenticated user's ID

  try {
    if (action === 'qr' || action === 'status') {
      const r = await bridgeFetch(`/${action}?userId=${userId}`)
      const data = await r.json()
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body
  const userId = user.id

  try {
    if (action === 'start') {
      const r = await bridgeFetch('/start', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      const data = await r.json()
      return NextResponse.json(data)
    }

    if (action === 'disconnect') {
      const r = await bridgeFetch('/disconnect', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      // Also clear credentials
      await supabase
        .from('social_platform_credentials')
        .update({ credentials: {}, is_connected: false })
        .eq('user_id', userId)
        .eq('platform', 'whatsapp_personal')
      const data = await r.json()
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
