export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMarketForUser } from '@/lib/booking/market-run'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // 只處理「有啟用 market 規則」的用戶，避免無謂消耗額度
  const { data: rules } = await admin
    .from('pricing_rules')
    .select('user_id')
    .eq('rule_type', 'market')
    .eq('enabled', true)

  const userIds = [...new Set((rules ?? []).map((r: { user_id: string }) => r.user_id))]
  if (!userIds.length) return NextResponse.json({ users: 0, snapshots: 0 })

  let snapshots = 0
  let apiCalls = 0
  let applied = 0

  for (const userId of userIds) {
    const r = await runMarketForUser(admin, userId)
    snapshots += r.snapshots
    apiCalls += r.apiCalls
    applied += r.applied
  }

  return NextResponse.json({ users: userIds.length, snapshots, apiCalls, applied })
}
