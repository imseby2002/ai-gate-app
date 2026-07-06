import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { getCsEntitlements } from '@/lib/cs/entitlements'

// GET /api/marketing/cs-plan
// 給前端（marketing-auto CS 設定台）用來決定哪些分頁要顯示鎖定／升級提示。
export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, features } = await getCsEntitlements(supabase, ctx.ownerId)
  return NextResponse.json({ plan, features })
}
