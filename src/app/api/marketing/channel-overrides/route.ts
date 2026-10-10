/**
 * GET /api/marketing/channel-overrides
 * 行銷發文中已改由公司官方帳號接手的平台（平台 id → 官方帳號名稱），供平台設定頁隱藏舊欄位。
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { loadMarketingPublishAccounts } from '@/lib/channels/resolve'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  // 與 /api/social/credentials 相同的 ownerId
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accounts = await loadMarketingPublishAccounts(ctx.ownerId)
  return NextResponse.json({
    platforms: Object.fromEntries(Object.entries(accounts).map(([p, a]) => [p, a.name])),
  })
}
