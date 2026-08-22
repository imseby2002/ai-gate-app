import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAffairReminders } from '@/lib/affairs/reminders'

// Vercel Cron：每日檢查外務文件到期／租約繳費，依角色管道提醒並去重。
// 到期 → 外務＋總務；租約每月繳費日 → 出納。
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

  const result = await runAffairReminders(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
