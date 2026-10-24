import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renewExpiredPaidLeases } from '@/lib/social-matrix/lease-billing'
import { verifyCronAuth } from '@/lib/cron/auth'

// Vercel Cron：每日處理到期的付費官方發文 IP——點數足夠自動續扣 30 天，不足則到期釋放。
export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const result = await renewExpiredPaidLeases(createAdminClient())
  return NextResponse.json({ ok: true, ...result })
}
