import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasModuleAccess } from '@/lib/module-access'
import { getBalance } from '@/lib/skills/billing'
import { generateMissionPlan, loadMission, startMissionExecution } from '@/lib/agents/missions'

export const maxDuration = 300

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!await hasModuleAccess(supabase, user.id, 'agent')) {
    return { res: NextResponse.json({ error: '尚未開通 Agent 模組' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await auth()
  if (a.res) return a.res

  const admin = createAdminClient()
  const mission = await loadMission(admin, id)
  if (!mission || mission.user_id !== a.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: expenses }, { data: run }] = await Promise.all([
    admin.from('agent_mission_expenses').select('*').eq('mission_id', id).order('created_at', { ascending: false }),
    mission.run_id
      ? admin.from('agent_runs').select('id, status, tick_count, total_credits_spent, next_tick_at, last_error').eq('id', mission.run_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return NextResponse.json({ mission, expenses: expenses ?? [], run })
}

// 動作：{ action: 'execute' | 'replan' | 'pause' | 'resume' | 'cancel', feedback? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await auth()
  if (a.res) return a.res

  const admin = createAdminClient()
  const mission = await loadMission(admin, id)
  if (!mission || mission.user_id !== a.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { action, feedback } = await req.json().catch(() => ({}))

  try {
    if (action === 'execute') {
      if (mission.status !== 'plan_ready') return NextResponse.json({ error: '計畫書尚未就緒或已在執行' }, { status: 400 })
      if (await getBalance(a.user.id) <= 0) return NextResponse.json({ error: '點數餘額不足' }, { status: 402 })
      const runId = await startMissionExecution(mission)
      return NextResponse.json({ ok: true, runId })
    }

    if (action === 'replan') {
      if (!['plan_ready', 'failed', 'paused'].includes(mission.status)) {
        return NextResponse.json({ error: '執行中的任務請先暫停再重新規劃' }, { status: 400 })
      }
      if (await getBalance(a.user.id) <= 0) return NextResponse.json({ error: '點數餘額不足' }, { status: 402 })
      await admin.from('agent_missions').update({ plan_feedback: String(feedback ?? '').trim() || null }).eq('id', id)
      if (mission.run_id) await admin.from('agent_runs').update({ status: 'cancelled' }).eq('id', mission.run_id)
      await admin.from('agent_missions').update({ run_id: null }).eq('id', id)
      const planned = await generateMissionPlan(id)
      return NextResponse.json({ ok: true, mission: planned })
    }

    if (action === 'pause') {
      if (mission.status !== 'executing') return NextResponse.json({ error: '任務未在執行中' }, { status: 400 })
      await admin.from('agent_missions').update({ status: 'paused' }).eq('id', id)
      if (mission.run_id) {
        await admin.from('agent_runs').update({ status: 'paused' }).eq('id', mission.run_id).in('status', ['queued', 'running'])
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'resume') {
      if (mission.status !== 'paused') return NextResponse.json({ error: '任務未暫停' }, { status: 400 })
      if (await getBalance(a.user.id) <= 0) return NextResponse.json({ error: '點數餘額不足' }, { status: 402 })
      if (!mission.run_id) {
        await admin.from('agent_missions').update({ status: 'plan_ready' }).eq('id', id)
        const runId = await startMissionExecution({ ...mission, status: 'plan_ready' })
        return NextResponse.json({ ok: true, runId })
      }
      await admin.from('agent_missions').update({ status: 'executing', last_error: null }).eq('id', id)
      // 等待核准中的 run 維持原狀，核准回覆後自然續跑；其餘狀態重新排入 cron
      await admin.from('agent_runs')
        .update({ status: 'queued', attempt_count: 0, last_error: null, next_tick_at: new Date().toISOString() })
        .eq('id', mission.run_id)
        .in('status', ['paused', 'failed', 'cancelled'])
      return NextResponse.json({ ok: true })
    }

    if (action === 'cancel') {
      await admin.from('agent_missions').update({ status: 'cancelled' }).eq('id', id)
      if (mission.run_id) await admin.from('agent_runs').update({ status: 'cancelled' }).eq('id', mission.run_id)
      await admin.from('agent_mission_expenses').update({ status: 'cancelled' }).eq('mission_id', id).eq('status', 'proposed')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: '未知的動作' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
