import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renewExpiredManaged } from '@/lib/connector/managed-billing'
import { renewExpiredCompanyManaged } from '@/lib/connector/company-resources'
import { verifyCronAuth } from '@/lib/cron/auth'

// Vercel Cron：每日處理到期的 AdsPower 代管（個人＋公司共享）——點數足夠自動續扣，不足或關閉自動續費則暫停。
export async function GET(req: Request) {
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const admin = createAdminClient()
  const personal = await renewExpiredManaged(admin)
  const company = await renewExpiredCompanyManaged(admin)
  return NextResponse.json({ ok: true, personal, company })
}
