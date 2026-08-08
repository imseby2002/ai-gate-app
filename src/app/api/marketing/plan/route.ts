/**
 * GET /api/marketing/plan — 目前帳號的行銷方案與解析後權限（給前端鎖定 UI 用）
 * Infinity 無法進 JSON，序列化為 null（前端視為無限）。
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  const serialized = Object.fromEntries(
    Object.entries(features).map(([k, v]) => [k, v === Infinity ? null : v]),
  )
  return NextResponse.json({ plan, features: serialized })
}
