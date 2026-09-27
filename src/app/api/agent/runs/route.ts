import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasModuleAccess } from '@/lib/module-access'
import {
  getModuleEntitlements, planRequiredResponse, quotaExceededResponse, currentPeriodStart,
} from '@/lib/module-plans/entitlements'
import { minPlanLabel, AGENT_CODE_ROLE_ID } from '@/lib/module-plans/definitions'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  const roleId = req.nextUrl.searchParams.get('roleId')
  let query = supabase
    .from('agent_runs')
    .select('id, role_id, status, goal, trigger_type, total_credits_spent, created_at, completed_at, last_error')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (roleId) query = query.eq('role_id', roleId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ runs: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  const { roleId, goal, input } = await req.json()
  if (!roleId || !goal) return NextResponse.json({ error: 'roleId, goal required' }, { status: 400 })

  const { data: userRole } = await supabase
    .from('user_agent_roles')
    .select('id, enabled')
    .eq('user_id', user.id)
    .eq('role_id', roleId)
    .maybeSingle()
  if (!userRole?.enabled) {
    return NextResponse.json({ error: '請先在「角色設定」啟用此角色' }, { status: 403 })
  }

  // ── AI Agent 方案（lib/module-plans/definitions.ts；內部帳號為 MAX）──────────
  const { plan, features } = await getModuleEntitlements(user.id, 'agent')
  if (!features.enabled) {
    return planRequiredResponse(`AI Agent 需 ${minPlanLabel('agent', f => f.enabled)}方案`, plan)
  }
  if (roleId === AGENT_CODE_ROLE_ID && !features.codeAgent) {
    return planRequiredResponse(`軟體開發專員角色需 AI Agent ${minPlanLabel('agent', f => f.codeAgent)}方案`, plan)
  }
  const { count: activeCount, error: activeErr } = await supabase
    .from('agent_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['queued', 'running', 'waiting_approval', 'waiting_input', 'paused'])
  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 })
  if ((activeCount ?? 0) >= features.concurrentRuns) {
    return quotaExceededResponse(`同時執行中的任務已達上限 ${features.concurrentRuns} 個，請等待完成或取消後再建立`, plan)
  }
  if (features.monthlyRunLimit !== Infinity || features.roleLimit !== Infinity) {
    const { data: monthRuns, error: monthErr } = await supabase
      .from('agent_runs')
      .select('role_id')
      .eq('user_id', user.id)
      .gte('created_at', currentPeriodStart().toISOString())
    if (monthErr) return NextResponse.json({ error: monthErr.message }, { status: 500 })
    if ((monthRuns?.length ?? 0) >= features.monthlyRunLimit) {
      return quotaExceededResponse(`本月任務 ${features.monthlyRunLimit} 次已用完，PRO 以上不限次數`, plan)
    }
    const usedRoles = new Set((monthRuns ?? []).map(r => r.role_id))
    if (!usedRoles.has(roleId) && usedRoles.size >= features.roleLimit) {
      return planRequiredResponse(`本月已使用 ${features.roleLimit} 個角色，使用全部角色需 ${minPlanLabel('agent', f => f.roleLimit === Infinity)}方案`, plan)
    }
  }

  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      user_id: user.id,
      role_id: roleId,
      user_role_id: userRole.id,
      status: 'queued',
      trigger_type: 'manual',
      goal,
      input: input ?? {},
      next_tick_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ run: data })
}
