import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: roles }, { data: userRoles }] = await Promise.all([
    supabase.from('agent_roles').select('*').eq('status', 'active').order('sort'),
    supabase.from('user_agent_roles').select('*').eq('user_id', user.id),
  ])

  const userRoleMap = new Map((userRoles ?? []).map(r => [r.role_id, r]))
  const merged = (roles ?? []).map(role => ({
    ...role,
    userRole: userRoleMap.get(role.id) ?? null,
  }))

  return NextResponse.json({ roles: merged })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roleId, enabled, config, creditBudgetMonthly } = await req.json()
  if (!roleId) return NextResponse.json({ error: 'roleId required' }, { status: 400 })

  const { data: role } = await supabase.from('agent_roles').select('id').eq('id', roleId).eq('status', 'active').maybeSingle()
  if (!role) return NextResponse.json({ error: '此角色不存在或已停用' }, { status: 404 })

  const { data, error } = await supabase
    .from('user_agent_roles')
    .upsert({
      user_id: user.id,
      role_id: roleId,
      enabled: !!enabled,
      config: config ?? {},
      credit_budget_monthly: creditBudgetMonthly ?? null,
      enabled_by: user.id,
    }, { onConflict: 'user_id,role_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ userRole: data })
}
