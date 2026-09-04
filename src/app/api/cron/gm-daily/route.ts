import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateGmReport } from '@/lib/gm/report'

export const maxDuration = 300

// Vercel Cron：每日產生總經理室經營快報，站內＋Telegram＋Email 推播。
// 收件對象＝有設定 gm 管道（affair_settings.gm_telegram/gm_email）的 owner。
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

  const admin = createAdminClient()
  const { data: settings } = await admin.from('affair_settings').select('owner_id, gm_telegram, gm_email')
  const owners = [...new Set((settings ?? [])
    .filter(s => (s.gm_telegram && String(s.gm_telegram).trim()) || (s.gm_email && String(s.gm_email).trim()))
    .map(s => s.owner_id as string))]

  let done = 0
  const errors: string[] = []
  for (const ownerId of owners) {
    try { await generateGmReport(admin, ownerId, 'daily'); done++ }
    catch (e) { errors.push(`${ownerId}: ${e instanceof Error ? e.message : e}`) }
  }
  return NextResponse.json({ ok: true, owners: owners.length, done, errors })
}
