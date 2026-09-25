import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { BOOKING_PLAN_FEATURES, type BookingPlan } from '@/lib/booking/entitlements'

const VALID_PLANS = Object.keys(BOOKING_PLAN_FEATURES) as BookingPlan[]

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  return profile?.user_type === 'admin' ? user : null
}

// GET /api/admin/booking-plans?q=email 片段搜尋
export async function GET(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const supabase = await createAdminClient()

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, booking_subscriptions(plan, billing_cycle, status, current_period_end)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) query = query.ilike('email', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

// PATCH { userId, plan, currentPeriodEnd? }
// 手動指定方案一律設為 active；currentPeriodEnd 不給＝不到期。extra_properties、feature_overrides 等其他欄位不動。
export async function PATCH(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, plan, currentPeriodEnd } = await req.json() as {
    userId?: string; plan?: string; currentPeriodEnd?: string | null
  }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!plan || !VALID_PLANS.includes(plan as BookingPlan)) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('booking_subscriptions')
    .upsert({
      user_id: userId,
      plan,
      status: 'active',
      current_period_end: currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
