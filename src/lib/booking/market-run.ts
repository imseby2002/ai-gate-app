import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMarketStats, type MarketStats } from './market-price'

// 抓取未來幾天的周邊行情並依 market 規則寫入每日定價。cron 與手動觸發共用。
export const FORECAST_DAYS = 30
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
async function applyMarketRules(admin: Admin, userId: string, statsByDate: Record<string, MarketStats>): Promise<number> {
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

export interface MarketRunResult {
  location: string | null
  snapshots: number
  apiCalls: number
  applied: number
}

// 對單一用戶：抓行情存快照 + 依 market 規則寫入每日定價。
export async function runMarketForUser(admin: Admin, userId: string): Promise<MarketRunResult> {
  const { data: profile } = await admin
    .from('bnb_profiles')
    .select('city, address')
    .eq('user_id', userId)
    .maybeSingle()

  const location = [profile?.city, profile?.address].filter(Boolean).join(' ').trim()
  if (!location) return { location: null, snapshots: 0, apiCalls: 0, applied: 0 }

  const today = new Date()
  const since = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString()
  const statsByDate: Record<string, MarketStats> = {}
  let snapshots = 0
  let apiCalls = 0

  for (let d = 0; d < FORECAST_DAYS; d++) {
    const stayDate = ymd(today, d)
    const nextDate = ymd(today, d + 1)
    const cacheKey = `${location.toLowerCase()}|${stayDate}|${nextDate}`

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

  const applied = await applyMarketRules(admin, userId, statsByDate)
  return { location, snapshots, apiCalls, applied }
}
