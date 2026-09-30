/**
 * GET /api/cron/db-backup（Vercel Cron，每日）
 * 全資料庫匯出至 Google Drive，細節見 src/lib/backup/db-backup.ts
 */
import { NextResponse } from 'next/server'
import { runDbBackup } from '@/lib/backup/db-backup'

export const maxDuration = 300

export async function GET(req: Request) {
  // 與其他 cron 一致的驗證
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await runDbBackup()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
