/**
 * GET /api/cron/geo-autopilot（每 15 分鐘）
 * 依各公司 GEO 自動巡航排程，到期就自動選題並產出一篇文章（存成草稿，出現在 GEO 歷史紀錄）。
 * 單篇約 1–3 分鐘，每次只處理一間公司，其餘留給下一輪。
 */
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import { runAutoPilot } from '@/lib/geo/autopilot'
import { isDue, localNow, pickTopic, type AutoPilotSchedule } from '@/lib/geo/autopilot-schedule'
import { precheckUsage, chargeUsage } from '@/lib/marketing/billing'

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ skipped: 'no ANTHROPIC_API_KEY' })

  const admin = createAdminClient()
  const { data: rows } = await admin.from('geo_autopilot_schedules').select('*').eq('enabled', true)
    .order('last_run_at', { ascending: true, nullsFirst: true })
  const due = ((rows ?? []) as AutoPilotSchedule[]).filter(s => isDue(s))

  const results: Array<{ owner: string; status: string }> = []
  for (const s of due.slice(0, 1)) {
    const today = localNow(s.timezone).date
    // 先標記今天已處理，避免同小時重複執行
    await admin.from('geo_autopilot_schedules').update({ last_run_date: today, last_run_at: new Date().toISOString(), last_status: 'running' }).eq('owner_id', s.owner_id)

    let status = 'ok'
    let projectId: string | null = null
    try {
      const lack = await precheckUsage(s.created_by, 0.15)
      if (lack) {
        status = 'insufficient_balance'
      } else {
        const picked = await pickTopic(admin, s)
        if (!picked) {
          status = 'no_topic'
        } else {
          const r = await runAutoPilot({ admin, db: admin, userId: s.created_by, ownerId: s.owner_id, topic: picked.topic, locale: s.locale })
          projectId = r.projectId
          await chargeUsage(s.created_by, r.cost + picked.cost, `GEO 自動巡航：${picked.topic}`)
          if ((s.topics ?? []).length) {
            await admin.from('geo_autopilot_schedules').update({ topics: picked.remaining }).eq('owner_id', s.owner_id)
          }
        }
      }
    } catch (err) {
      console.error('[cron/geo-autopilot] run failed', s.owner_id, err)
      status = 'error: ' + (err instanceof Error ? err.message : String(err)).slice(0, 200)
    }
    await admin.from('geo_autopilot_schedules').update({ last_status: status, last_project_id: projectId }).eq('owner_id', s.owner_id)
    results.push({ owner: s.owner_id, status })
  }

  return NextResponse.json({ due: due.length, processed: results.length, results })
}
