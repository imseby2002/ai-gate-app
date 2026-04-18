/**
 * Cron-aware auth helper
 *
 * API routes 呼叫此函數取得 user。
 * 若帶有 X-Cron-Secret header 且匹配 CRON_SECRET，
 * 則改用 service role client 取得第一個管理員 user。
 *
 * 正常情況下 cron 只呼叫已有 campaignId 的 route，
 * 所以我們不需要特定 userId，只需要 DB 權限（service role 已足夠）。
 */
import { NextRequest } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export interface CronUser {
  id: string
  isCron: boolean
}

export async function getCronOrUserAuth(req: NextRequest): Promise<CronUser | null> {
  // Check cron secret
  const cronSecret = req.headers.get('X-Cron-Secret')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    // Use a fixed service sentinel user id — cron uses service role for DB ops directly
    return { id: 'cron-service', isCron: true }
  }

  // Normal cookie auth
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, isCron: false }
}

export function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
