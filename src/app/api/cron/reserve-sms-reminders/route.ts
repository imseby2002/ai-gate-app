/**
 * GET /api/cron/reserve-sms-reminders（Vercel Cron，每 15 分鐘）
 * 預約開始前 N 小時發簡訊提醒客人（店家於預約系統設定開啟）
 */
import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/auth'
import { runReserveSmsReminders } from '@/lib/reserve/sms-reminders'

export const maxDuration = 300

export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  return NextResponse.json(await runReserveSmsReminders())
}
