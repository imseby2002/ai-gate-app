import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import type { CsPlan } from '@/lib/cs/entitlements'

const VALID_PLANS: CsPlan[] = ['free', 'core', 'pro', 'max']

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

// GET /api/admin/cs-plans?q=email 片段搜尋
export async function GET(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const supabase = await createAdminClient()

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, cs_subscriptions(plan, billing_cycle, status, current_period_end)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) query = query.ilike('email', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

// PATCH { userId, plan, billingCycle?, currentPeriodEnd? }
export async function PATCH(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, plan, billingCycle, currentPeriodEnd } = await req.json() as {
    userId?: string; plan?: string; billingCycle?: string; currentPeriodEnd?: string | null
  }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!plan || !VALID_PLANS.includes(plan as CsPlan)) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('cs_subscriptions')
    .upsert({
      user_id: userId,
      plan,
      billing_cycle: billingCycle ?? 'monthly',
      status: 'active',
      current_period_end: currentPeriodEnd ?? null,
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
