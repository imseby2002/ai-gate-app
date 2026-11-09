import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getReserveEntitlements } from '@/lib/reserve/entitlements'

// GET /api/reserve/plan → 目前預約系統方案與權限
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getReserveEntitlements(user.id))
}
