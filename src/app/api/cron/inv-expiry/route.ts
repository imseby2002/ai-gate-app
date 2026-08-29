import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runExpiryReminders } from '@/lib/inv/expiry'

// Vercel Cron：每日檢查原料批次到期，依「到期前天數」分級通知（門市／管理／稽核／辦公室），去重升級。
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

  const result = await runExpiryReminders(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
