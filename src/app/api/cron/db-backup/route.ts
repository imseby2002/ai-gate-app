/**
 * GET /api/cron/db-backup（Vercel Cron，每日）
 * 全資料庫匯出至 Google Drive，細節見 src/lib/backup/db-backup.ts
 */
import { NextResponse } from 'next/server'
import { runDbBackup } from '@/lib/backup/db-backup'
import { verifyCronAuth } from '@/lib/cron/auth'

export const maxDuration = 300

export async function GET(req: Request) {
  // 與其他 cron 一致的驗證
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const result = await runDbBackup()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
