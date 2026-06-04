export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncEmailForSetting } from '@/lib/booking/email-sync'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    // CRON_SECRET not configured — accept Vercel-internal cron calls only
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('email_settings')
    .select('id')
    .eq('sync_enabled', true)

  if (!settings?.length) return NextResponse.json({ synced: 0 })

  const results = await Promise.allSettled(
    settings.map((s: { id: string }) => syncEmailForSetting(s.id))
  )
  const done = results.filter((r: PromiseSettledResult<unknown>) => r.status === 'fulfilled').length

  return NextResponse.json({ total: settings.length, synced: done })
}
