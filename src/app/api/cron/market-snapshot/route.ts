export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMarketStats } from '@/lib/booking/market-price'

// 抓取未來幾天的周邊行情（每天一筆入住日）。額度敏感：天數 × 啟用市場規則的用戶數。
const FORECAST_DAYS = 30
const CACHE_TTL_HOURS = 12

function ymd(base: Date, addDays: number): string {
  return new Date(base.getTime() + addDays * 86400000).toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // 只抓「有啟用 market 規則」的用戶，避免無謂消耗額度
  const { data: rules } = await admin
    .from('pricing_rules')
    .select('user_id')
    .eq('rule_type', 'market')
    .eq('enabled', true)

  const userIds = [...new Set((rules ?? []).map((r: { user_id: string }) => r.user_id))]
  if (!userIds.length) return NextResponse.json({ users: 0, snapshots: 0 })

  const today = new Date()
  const since = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString()
  let snapshots = 0
  let apiCalls = 0

  for (const userId of userIds) {
    const { data: profile } = await admin
      .from('bnb_profiles')
      .select('city, address')
      .eq('user_id', userId)
      .maybeSingle()

    const location = [profile?.city, profile?.address].filter(Boolean).join(' ').trim()
    if (!location) continue

    for (let d = 0; d < FORECAST_DAYS; d++) {
      const stayDate = ymd(today, d)
      const nextDate = ymd(today, d + 1)
      const cacheKey = `${location.toLowerCase()}|${stayDate}|${nextDate}`

      // 先查跨用戶共享快取，命中就不打 SerpApi
      let stats: { count: number; min: number; max: number; avg: number; median: number } | null = null
      const { data: cached } = await admin
        .from('price_compare_cache')
        .select('stats, fetched_at')
        .eq('cache_key', cacheKey)
        .gte('fetched_at', since)
        .maybeSingle()

      if (cached?.stats) {
        stats = cached.stats as typeof stats
      } else {
        const r = await fetchMarketStats(location, stayDate, nextDate)
        apiCalls++
        stats = r.stats
        if (r.stats) {
          await admin.from('price_compare_cache').upsert({
            cache_key: cacheKey, location, check_in: stayDate, check_out: nextDate,
            items: r.items, stats: r.stats, fetched_at: new Date().toISOString(),
          }, { onConflict: 'cache_key' })
        }
      }

      if (stats) {
        await admin.from('market_price_snapshots').upsert({
          user_id: userId, location, stay_date: stayDate,
          median: stats.median, min: stats.min, max: stats.max, avg: stats.avg, count: stats.count,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'user_id,stay_date' })
        snapshots++
      }
    }
  }

  return NextResponse.json({ users: userIds.length, snapshots, apiCalls })
}
