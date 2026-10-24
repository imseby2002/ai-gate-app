import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAffairReminders } from '@/lib/affairs/reminders'
import { verifyCronAuth } from '@/lib/cron/auth'

// Vercel Cron：每日檢查外務文件到期／租約繳費，依角色管道提醒並去重。
// 到期 → 外務＋總務；租約每月繳費日 → 出納。
export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const result = await runAffairReminders(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
