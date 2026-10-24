import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasModuleAccess } from '@/lib/module-access'
import { isSuperAdminUser } from '@/lib/auth/admin-check'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 })
  }

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

  // 工具輸入／輸出的原始資料只給平台管理員除錯用
  const { data: profile } = await supabase.from('profiles').select('user_type, email').eq('id', user.id).maybeSingle()
  const canDebug = isSuperAdminUser(user, profile)
  const view = (steps ?? []).map(st => {
    const { tool_input, tool_output, ...rest } = st as Record<string, unknown>
    const base = { ...rest, summary: summarizeOutput(tool_output) }
    return canDebug ? { ...base, tool_input, tool_output } : base
  })
  return NextResponse.json({ run, steps: view, canDebug })
}

// 從工具輸出擷取給一般使用者看的簡短文字（不顯示原始資料）
function summarizeOutput(out: unknown): string {
  if (out == null) return ''
  if (typeof out === 'string') return out.slice(0, 300)
  if (typeof out !== 'object') return ''
  const o = out as Record<string, unknown>
  for (const k of ['message', 'summary', 'error', 'result', 'title', 'status']) {
    if (typeof o[k] === 'string' && (o[k] as string).trim()) return (o[k] as string).slice(0, 300)
  }
  return ''
}
