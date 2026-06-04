export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMarketStats, type MarketStats } from '@/lib/booking/market-price'

// 抓取未來幾天的周邊行情（每天一筆入住日）。額度敏感：天數 × 啟用市場規則的用戶數。
const FORECAST_DAYS = 30
const CACHE_TTL_HOURS = 12

type Admin = ReturnType<typeof createAdminClient>

function ymd(base: Date, addDays: number): string {
  return new Date(base.getTime() + addDays * 86400000).toISOString().slice(0, 10)
}

interface MarketRule {
  property_id: string | null
  adjustment_type: string
  adjustment_value: number
  priority: number
  conditions: { basis?: string; floor?: number | null; ceil?: number | null }
}

// 依 market 規則，把行情換算成每日定價並寫入 room_date_settings.price_override。
// 只覆蓋價格，保留既有 booking_status / 押金 / 加床欄位。
async function applyMarketRules(admin: Admin, userId: string, statsByDate: Record<string, MarketStats>) {
  const dates = Object.keys(statsByDate).sort()
  if (!dates.length) return 0

  const { data: rulesData } = await admin
    .from('pricing_rules')
    .select('property_id, adjustment_type, adjustment_value, priority, conditions')
    .eq('user_id', userId)
    .eq('rule_type', 'market')
    .eq('enabled', true)
  const rules = (rulesData ?? []) as MarketRule[]
  if (!rules.length) return 0

  const { data: props } = await admin
    .from('properties')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
  const allPropIds = (props ?? []).map((p: { id: string }) => p.id)
  if (!allPropIds.length) return 0

  // 既有設定（合併用）
  const { data: existing } = await admin
    .from('room_date_settings')
    .select('property_id, date, booking_status, deposit, notes, extra_person_fee, extra_large_bed, extra_small_bed')
    .eq('user_id', userId)
    .gte('date', dates[0])
    .lte('date', dates[dates.length - 1])
  const exMap = new Map<string, Record<string, unknown>>()
  for (const s of existing ?? []) exMap.set(`${s.property_id}:${s.date}`, s)

  // 低優先級先寫、高優先級後覆蓋
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  const rowMap = new Map<string, number>()
  for (const rule of sorted) {
    const basis = (rule.conditions?.basis ?? 'median') as keyof MarketStats
    const targets = rule.property_id ? [rule.property_id] : allPropIds
    for (const date of dates) {
      const stats = statsByDate[date]
      const baseVal = (stats[basis] as number) ?? stats.median
      let price = rule.adjustment_type === 'percent'
        ? baseVal * (1 + rule.adjustment_value / 100)
        : baseVal + rule.adjustment_value
      price = Math.round(price)
      if (rule.conditions?.floor != null) price = Math.max(price, rule.conditions.floor)
      if (rule.conditions?.ceil != null) price = Math.min(price, rule.conditions.ceil)
      for (const pid of targets) rowMap.set(`${pid}:${date}`, price)
    }
  }

  const rows = [...rowMap.entries()].map(([key, price]) => {
    const [property_id, date] = key.split(':')
    const ex = exMap.get(key)
    return {
      user_id: userId,
      property_id,
      date,
      price_override: price,
      booking_status: (ex?.booking_status as string) ?? 'open',
      deposit: (ex?.deposit as number | null) ?? null,
      notes: (ex?.notes as string | null) ?? null,
      extra_person_fee: (ex?.extra_person_fee as number | null) ?? null,
      extra_large_bed: (ex?.extra_large_bed as number | null) ?? null,
      extra_small_bed: (ex?.extra_small_bed as number | null) ?? null,
      updated_at: new Date().toISOString(),
    }
  })

  if (rows.length) {
    await admin.from('room_date_settings').upsert(rows, { onConflict: 'user_id,property_id,date' })
  }
  return rows.length
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

  // 只處理「有啟用 market 規則」的用戶，避免無謂消耗額度
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
  let applied = 0

  for (const userId of userIds) {
    const { data: profile } = await admin
      .from('bnb_profiles')
      .select('city, address')
      .eq('user_id', userId)
      .maybeSingle()

    const location = [profile?.city, profile?.address].filter(Boolean).join(' ').trim()
    if (!location) continue

    const statsByDate: Record<string, MarketStats> = {}

    for (let d = 0; d < FORECAST_DAYS; d++) {
      const stayDate = ymd(today, d)
      const nextDate = ymd(today, d + 1)
      const cacheKey = `${location.toLowerCase()}|${stayDate}|${nextDate}`

      // 先查跨用戶共享快取，命中就不打 SerpApi
      let stats: MarketStats | null = null
      const { data: cached } = await admin
        .from('price_compare_cache')
        .select('stats, fetched_at')
        .eq('cache_key', cacheKey)
        .gte('fetched_at', since)
        .maybeSingle()

      if (cached?.stats) {
        stats = cached.stats as MarketStats
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
        statsByDate[stayDate] = stats
        snapshots++
      }
    }

    applied += await applyMarketRules(admin, userId, statsByDate)
  }

  return NextResponse.json({ users: userIds.length, snapshots, apiCalls, applied })
}
