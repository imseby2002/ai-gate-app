import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasModuleAccess } from '@/lib/module-access'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('agent_approvals')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['pending', 'awaiting_feedback'])
    .order('requested_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ approvals: data })
}
