/**
 * GET /api/cron/share-schedules（Vercel Cron，每 5 分鐘）
 * 到期的個人 LINE／Zalo 群組行銷排程 → 通知持有人一鍵帶入
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import { runShareSchedule } from '@/lib/marketing/share-drafts'

export const maxDuration = 120

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  const { data: due } = await createAdminClient().from('marketing_share_schedules')
    .select('id, user_id, app, group_name, text, holder_id, next_run_at, repeat')
    .eq('status', 'active').lte('next_run_at', new Date().toISOString())
    .order('next_run_at').limit(50)
  const results = []
  for (const s of due ?? []) results.push(await runShareSchedule(s).catch(() => null))
  return NextResponse.json({ processed: results.filter(Boolean).length })
}
