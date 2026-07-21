import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: run, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: steps } = await supabase
    .from('agent_run_steps')
    .select('*')
    .eq('run_id', id)
    .order('step_index', { ascending: true })

  return NextResponse.json({ run, steps: steps ?? [] })
}
