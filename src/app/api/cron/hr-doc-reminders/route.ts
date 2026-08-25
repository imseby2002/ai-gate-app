import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDocReminders } from '@/lib/hr/doc-reminders'

// Vercel Cron：每週檢查人員缺件（未上傳→通知個人；正本紙本未收→通知個人＋人事）。
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
  const result = await runDocReminders(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
