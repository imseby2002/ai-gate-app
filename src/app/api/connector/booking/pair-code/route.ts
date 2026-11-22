// POST /api/connector/booking/pair-code — 民宿主在網頁端產生 10 分鐘有效的配對碼，
// 貼到 Booking.com 讀後台瀏覽器外掛完成配對。配對本身走共用的 /api/connector/pair。
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { generatePairCode, sha256, PAIR_CODE_TTL_MINUTES } from '@/lib/connector/auth'

export async function POST() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canSettings) return NextResponse.json({ error: '只有擁有者或管理員可配對裝置' }, { status: 403 })

  const code = generatePairCode()
  const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MINUTES * 60 * 1000).toISOString()
  const { error } = await createAdminClient().from('marketing_connector_pair_codes').insert({
    user_id: ctx.ownerId,
    code_hash: sha256(code),
    expires_at: expiresAt,
  })
  if (error) return NextResponse.json({ error: `產生配對碼失敗：${error.message}` }, { status: 500 })
  return NextResponse.json({ code, expires_at: expiresAt, ttl_minutes: PAIR_CODE_TTL_MINUTES })
}
