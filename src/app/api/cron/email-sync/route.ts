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

  // A. 錯峰取批：每次只處理「最久沒同步的 N 個」（last_synced_at 由 syncEmailForSetting
  //    每輪結束自動推進，故 nullsFirst+ascending 會自然輪轉，不會獨厚或餓死任何帳號）。
  //    避免幾百個帳號在單一函數內同時開跑造成 OOM / 逾時。
  // B. 並發上限：同時最多 CONCURRENCY 個帳號在跑，控制 IMAP 連線與 AI 請求峰值。
  const BATCH = Math.max(1, Number(process.env.EMAIL_SYNC_BATCH ?? 50))
  const CONCURRENCY = Math.max(1, Number(process.env.EMAIL_SYNC_CONCURRENCY ?? 5))

  const { data: settings } = await supabase
    .from('email_settings')
    .select('id')
    .eq('sync_enabled', true)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(BATCH)

  if (!settings?.length) return NextResponse.json({ synced: 0 })

  // 簡易並發池（不依賴外部套件）：CONCURRENCY 條 worker 共享同一索引依序取任務。
  let cursor = 0
  let done = 0
  const list = settings as { id: string }[]
  async function worker() {
    while (cursor < list.length) {
      const item = list[cursor++]
      try {
        await syncEmailForSetting(item.id)
        done++
      } catch { /* syncEmailForSetting 內部已自行記錄錯誤；單帳號失敗不影響其他 */ }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, list.length) }, () => worker())
  )

  return NextResponse.json({ picked: list.length, synced: done, concurrency: CONCURRENCY })
}
