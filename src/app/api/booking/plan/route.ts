import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { getBookingEntitlements } from '@/lib/booking/entitlements'

// GET /api/booking/plan
// 給訂房模組的訂閱方案頁用來顯示目前方案、房源上限與功能權限。
export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'booking')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entitlements = await getBookingEntitlements(supabase, ctx.ownerId)
  return NextResponse.json(entitlements)
}
