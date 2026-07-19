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
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { getCsEntitlements } from '@/lib/cs/entitlements'

// WhatsApp 個人版為 PRO 以上方案功能：連線前先確認方案是否開放（以 ownerId 判斷）
async function ensureWhatsappPersonalAllowed(ownerId: string) {
  const { features } = await getCsEntitlements(createAdminClient(), ownerId)
  if (!features.whatsappPersonal) {
    return { ok: false as const, status: 403, error: 'WhatsApp 個人版為 PRO 以上方案功能，請升級方案後使用。' }
  }
  return { ok: true as const }
}

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
  // WhatsApp 個人版 session 綁在「民宿擁有者」：協作者與總管理員代操時都以 ownerId 為準
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const userId = ctx.ownerId

  try {
    if (action === 'qr' || action === 'status') {
      if (action === 'qr') {
        const gate = await ensureWhatsappPersonalAllowed(ctx.ownerId)
        if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
      }
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
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body
  const userId = ctx.ownerId

  try {
    if (action === 'start') {
      const gate = await ensureWhatsappPersonalAllowed(ctx.ownerId)
      if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
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
