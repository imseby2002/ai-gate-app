import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasModuleAccess } from '@/lib/module-access'
import { getBalance } from '@/lib/skills/billing'
import { generateMissionPlan, resolveMissionOwner } from '@/lib/agents/missions'

export const maxDuration = 300

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('agent_missions')
    .select('id, role_id, objective, budget_amount, budget_currency, budget_spent, deadline, status, kpis, created_at, last_error')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ missions: data ?? [] })
}

// 建立目標任務並立即產出計畫書：{ roleId, objective, budgetAmount, budgetCurrency?, deadline? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  const b = await req.json().catch(() => ({}))
  const roleId = String(b.roleId ?? '').trim()
  const objective = String(b.objective ?? '').trim()
  const budgetAmount = Number(b.budgetAmount)
  const budgetCurrency = String(b.budgetCurrency ?? 'TWD').trim().toUpperCase().slice(0, 8) || 'TWD'
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(b.deadline ?? '')) ? String(b.deadline) : null
  if (!roleId || !objective) return NextResponse.json({ error: 'roleId, objective required' }, { status: 400 })
  if (!Number.isFinite(budgetAmount) || budgetAmount < 0) return NextResponse.json({ error: '預算需為 0 以上的數字' }, { status: 400 })

  const { data: userRole } = await supabase
    .from('user_agent_roles')
    .select('enabled')
    .eq('user_id', user.id)
    .eq('role_id', roleId)
    .maybeSingle()
  if (!userRole?.enabled) return NextResponse.json({ error: '請先在「角色設定」啟用此角色' }, { status: 403 })
  if (await getBalance(user.id) <= 0) return NextResponse.json({ error: '點數餘額不足' }, { status: 402 })

  const admin = createAdminClient()
  const ownerId = await resolveMissionOwner(admin, user.id)
  const { data: mission, error } = await admin
    .from('agent_missions')
    .insert({
      user_id: user.id,
      owner_id: ownerId,
      role_id: roleId,
      objective,
      budget_amount: budgetAmount,
      budget_currency: budgetCurrency,
      deadline,
      status: 'planning',
    })
    .select('id')
    .single()
  if (error || !mission) return NextResponse.json({ error: error?.message ?? '建立失敗' }, { status: 500 })

  try {
    const planned = await generateMissionPlan(mission.id)
    return NextResponse.json({ mission: planned })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), missionId: mission.id }, { status: 500 })
  }
}
