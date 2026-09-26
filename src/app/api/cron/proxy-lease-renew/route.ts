import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renewExpiredPaidLeases } from '@/lib/social-matrix/lease-billing'

// Vercel Cron：每日處理到期的付費官方發文 IP——點數足夠自動續扣 30 天，不足則到期釋放。
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await renewExpiredPaidLeases(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
