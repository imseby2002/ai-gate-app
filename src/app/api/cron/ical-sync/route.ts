import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncICalForSetting } from '@/lib/booking/ical-sync'

// Vercel Cron: 每小時執行，同步所有啟用的 iCal 設定
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 取出所有啟用且距上次同步超過 sync_interval 分鐘的設定
  const { data: settings } = await supabase
    .from('ical_settings')
    .select('id, user_id, platform_name, sync_interval, last_synced_at')
    .eq('sync_enabled', true)

  if (!settings?.length) return NextResponse.json({ synced: 0 })

  interface SettingRow { id: string; last_synced_at: string | null; sync_interval: number | null }
  const now = Date.now()
  const due = (settings as SettingRow[]).filter(s => {
    if (!s.last_synced_at) return true
    const elapsed = (now - new Date(s.last_synced_at).getTime()) / 60000
    return elapsed >= (s.sync_interval ?? 60)
  })

  const results = await Promise.allSettled(due.map((s: SettingRow) => syncICalForSetting(s.id)))
  const done = results.filter(r => r.status === 'fulfilled').length

  return NextResponse.json({ total: settings.length, due: due.length, synced: done })
}
