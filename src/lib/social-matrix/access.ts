// 社群矩陣 API 共用的登入＋方案檢查：cron 放行；一般用戶需 socialMatrix 權限（PRO 以上）。
import { NextRequest, NextResponse } from 'next/server'
import { getCronOrUserAuth, type CronUser } from '@/lib/cron-auth'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'

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
