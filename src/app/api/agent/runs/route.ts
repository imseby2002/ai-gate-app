import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
