import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncEmailForSetting } from '@/lib/booking/email-sync'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const done = results.filter(r => r.status === 'fulfilled').length

  return NextResponse.json({ total: settings.length, synced: done })
}
