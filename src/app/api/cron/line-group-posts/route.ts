/**
 * GET /api/cron/line-group-posts（Vercel Cron，每 5 分鐘）
 * 送出到期的 LINE 官方帳號群組排程推播
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/cron/auth'
import { sendLineGroupPost } from '@/lib/marketing/line-groups'

export const maxDuration = 300
const MAX_PER_RUN = 30

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const { data: due } = await createAdminClient().from('marketing_line_group_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(MAX_PER_RUN)

  const results = []
  for (const p of due ?? []) {
    const r = await sendLineGroupPost(p.id as string).catch(e => ({ status: 'error', error: String(e) }))
    results.push({ id: p.id, ...(r ?? { status: 'skipped' }) })
  }
  return NextResponse.json({ processed: results.length, results })
}
