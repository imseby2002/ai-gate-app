/**
 * GET /api/cron/refresh-tokens（Vercel Cron，每小時）
 * 自動更新會過期的平台權杖（Zalo、TikTok、Threads、LinkedIn），細節見 src/lib/marketing/token-refresh.ts
 */
import { NextResponse } from 'next/server'
import { refreshExpiringTokens } from '@/lib/marketing/token-refresh'

export const maxDuration = 120

export async function GET(req: Request) {
  // 與其他 cron 一致的驗證
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results = await refreshExpiringTokens()
  return NextResponse.json({ refreshed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), total: results.length })
}
