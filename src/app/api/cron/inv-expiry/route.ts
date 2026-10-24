import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runExpiryReminders } from '@/lib/inv/expiry'
import { verifyCronAuth } from '@/lib/cron/auth'

// Vercel Cron：每日檢查原料批次到期，依「到期前天數」分級通知（門市／管理／稽核／辦公室），去重升級。
export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const result = await runExpiryReminders(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
