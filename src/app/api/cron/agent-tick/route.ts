/**
 * GET /api/cron/agent-tick
 * Vercel Cron Job — 每分鐘執行，搶佔到期的 agent_runs 並各推進一個 tick。
 *
 * 認證比照 src/app/api/cron/pipeline/route.ts：Vercel 呼叫時帶
 * `Authorization: Bearer CRON_SECRET`。核准回覆流程（resumeRunAfterApproval）
 * 觸發立即續跑時，也是送這個 header，不是 X-Cron-Secret（那是給
 * route-to-route 內部呼叫用，見 src/lib/cron-auth.ts）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tickRun, type AgentRunRow } from '@/lib/agents/engine'
import { sendPendingApprovalReminders } from '@/lib/agents/approvals'

export const maxDuration = 60

const CLAIM_BATCH_SIZE = 5

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const workerId = `tick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = Date.now()
  const budgetMs = 50_000

  // 待核准提醒查詢頻率不需要跟 tick 一樣每分鐘跑，整點才跑一次即可
  if (new Date().getMinutes() === 0) {
    await sendPendingApprovalReminders().catch(() => { /* 提醒失敗不影響本次 tick */ })
  }

  let totalTicked = 0

  while (Date.now() - startedAt < budgetMs) {
    const { data: dueRuns, error } = await admin.rpc('claim_due_agent_runs', {
      p_limit: CLAIM_BATCH_SIZE,
      p_worker: workerId,
    })
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, ticked: totalTicked })
    }
    const runs = (dueRuns ?? []) as AgentRunRow[]
    if (runs.length === 0) break

    for (const run of runs) {
      await tickRun(run)
      totalTicked++
      if (Date.now() - startedAt >= budgetMs) break
    }
  }

  return NextResponse.json({ ok: true, ticked: totalTicked, timestamp: new Date().toISOString() })
}
