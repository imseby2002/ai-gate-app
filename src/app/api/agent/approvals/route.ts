import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMissionOwner, otherCompanyMissionScope } from '@/lib/agents/missions'
import { hasModuleAccess } from '@/lib/module-access'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  // 切換公司後，不顯示屬於其他公司目標任務的待核准事項
  const admin = createAdminClient()
  const { runIds } = await otherCompanyMissionScope(admin, user.id, await resolveMissionOwner(admin, user.id))
  let query = supabase
    .from('agent_approvals')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['pending', 'awaiting_feedback'])
    .order('requested_at', { ascending: false })
  if (runIds.length) query = query.or(`run_id.is.null,run_id.not.in.(${runIds.join(',')})`)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ approvals: data })
}
