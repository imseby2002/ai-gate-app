// 社群矩陣 API 共用的登入＋方案檢查：cron 放行；一般用戶需 socialMatrix 權限（PRO 以上）。
import { NextRequest, NextResponse } from 'next/server'
import { getCronOrUserAuth, type CronUser } from '@/lib/cron-auth'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireSocialMatrix(req: NextRequest): Promise<{ user: CronUser; res?: never } | { user?: never; res: NextResponse }> {
  const user = await getCronOrUserAuth(req)
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.isCron) return { user }
  const { plan, features } = await getMarketingEntitlements(null, user.id)
  if (!features.socialMatrix) {
    return { res: NextResponse.json({ error: '社群矩陣僅限 PRO 以上方案，請升級後使用', plan }, { status: 403 }) }
  }
  return { user }
}

export async function isPlatformAdmin(user: CronUser): Promise<boolean> {
  if (user.isCron) return false
  const { data } = await createAdminClient().from('profiles').select('user_type').eq('id', user.id).maybeSingle()
  return data?.user_type === 'admin'
}

// 官方 IP 庫存維護（上架／編輯／下架）僅限平台管理員
export async function requirePlatformAdmin(user: CronUser): Promise<NextResponse | null> {
  return (await isPlatformAdmin(user))
    ? null
    : NextResponse.json({ error: '僅平台管理員可維護官方 IP 庫存' }, { status: 403 })
}

// 官方 IP 附贈額度：方案附贈數 vs 目前有效租用數（管理員不限）
export async function getOfficialProxyQuota(user: CronUser, fallbackActiveCount: number) {
  const isAdmin = await isPlatformAdmin(user)
  const { features } = await getMarketingEntitlements(null, user.id)
  const { count, error } = await createAdminClient()
    .from('marketing_proxy_leases')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active')
  const used = error || count == null ? fallbackActiveCount : count
  return { isAdmin, quota: features.officialProxyQuota, used }
}
