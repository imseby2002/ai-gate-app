import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDocReminders } from '@/lib/hr/doc-reminders'
import { verifyCronAuth } from '@/lib/cron/auth'

// Vercel Cron：每週檢查人員缺件（未上傳→通知個人；正本紙本未收→通知個人＋人事）。
export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError
  const result = await runDocReminders(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
