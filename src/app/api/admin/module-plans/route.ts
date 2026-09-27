import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { MODULE_PLANS, isPlanModule, type ModulePlan } from '@/lib/module-plans/definitions'
import { getCompanyPlansForUsers } from '@/lib/company/entitlements'

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

// GET /api/admin/module-plans?module=chat&q=email 片段搜尋
export async function GET(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const moduleId = req.nextUrl.searchParams.get('module') ?? ''
  if (!isPlanModule(moduleId)) return NextResponse.json({ error: '無效的模組' }, { status: 400 })
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const supabase = await createAdminClient()

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, user_type')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) query = query.ilike('email', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = (data ?? []).map(u => u.id)

  const [{ data: subs, error: subErr }, { members, grants }] = await Promise.all([
    ids.length
      ? supabase.from('module_subscriptions').select('user_id, plan, billing_cycle, status, current_period_end').eq('module', moduleId).in('user_id', ids)
      : Promise.resolve({ data: [], error: null }),
    // 外部公司成員隨公司：公司開通此模組（公司版／專屬客製-企業版）為 MAX，否則 FREE
    getCompanyPlansForUsers(ids, moduleId),
  ])
  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })

  const subMap = new Map((subs ?? []).map(s => [s.user_id, s]))

  return NextResponse.json({
    users: (data ?? []).map(u => ({
      ...u,
      subscription: subMap.get(u.id) ?? null,
      company_grant: grants.get(u.id) ?? null,
      // 公司成員隨公司方案，個人方案不生效（lib/module-plans/entitlements.ts）
      company_name: members.get(u.id) ?? null,
    })),
  })
}

// PATCH { userId, module, plan, currentPeriodEnd? }
// 手動指定方案一律設為 active；currentPeriodEnd 不給＝不到期。feature_overrides 等其他欄位不動。
export async function PATCH(req: NextRequest) {
  const admin = await assertAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, module: moduleId, plan, currentPeriodEnd } = await req.json() as {
    userId?: string; module?: string; plan?: string; currentPeriodEnd?: string | null
  }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!moduleId || !isPlanModule(moduleId)) return NextResponse.json({ error: '無效的模組' }, { status: 400 })
  if (!plan || !MODULE_PLANS.includes(plan as ModulePlan)) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  const supabase = await createAdminClient()
  const { data: target } = await supabase.from('profiles').select('user_type, company_id').eq('id', userId).maybeSingle()
  if (target?.user_type === 'external' && target.company_id) return NextResponse.json({ error: '公司成員隨公司方案，請到公司管理調整' }, { status: 400 })

  const { error } = await supabase
    .from('module_subscriptions')
    .upsert({
      user_id: userId,
      module: moduleId,
      plan,
      status: 'active',
      current_period_end: currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,module' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
