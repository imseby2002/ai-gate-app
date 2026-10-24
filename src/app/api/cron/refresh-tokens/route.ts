/**
 * GET /api/cron/refresh-tokens（Vercel Cron，每 30 分鐘；Zalo access token 可能只有 1 小時效期）
 * 自動更新會過期的平台權杖（Zalo、TikTok、Threads、LinkedIn），細節見 src/lib/marketing/token-refresh.ts
 */
import { NextResponse } from 'next/server'
import { refreshExpiringTokens } from '@/lib/marketing/token-refresh'
import { verifyCronAuth } from '@/lib/cron/auth'

export const maxDuration = 120

export async function GET(req: Request) {
  // 與其他 cron 一致的驗證
  const authError = verifyCronAuth(req)
  if (authError) return authError

  const results = await refreshExpiringTokens()
  return NextResponse.json({ refreshed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), total: results.length })
}
