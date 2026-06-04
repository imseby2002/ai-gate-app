import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMarketStats } from '@/lib/booking/market-price'

export const maxDuration = 60

// 同地區+日期的快取保鮮時間；房價變動不快，12 小時內共用同一份結果省 SerpApi 額度。
const CACHE_TTL_HOURS = 12

// 周邊比價：打 SerpApi Google Hotels，回傳指定地區、指定入住日的周邊房價清單與統計。
// 結果寫入 price_compare_cache（跨用戶共享），相同地區+日期在 TTL 內直接回快取。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { location, check_in, check_out, force } = await req.json()
  if (!location?.trim() || !check_in || !check_out)
    return NextResponse.json({ error: '地區、入住日、退房日必填' }, { status: 400 })

  const loc = location.trim()
  const cacheKey = `${loc.toLowerCase()}|${check_in}|${check_out}`
  const admin = createAdminClient()

  // 先查快取（除非強制重查）
  if (!force) {
    const since = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString()
    const { data: cached } = await admin
      .from('price_compare_cache')
      .select('items, stats, fetched_at')
      .eq('cache_key', cacheKey)
      .gte('fetched_at', since)
      .maybeSingle()
    if (cached) {
      return NextResponse.json({ items: cached.items, stats: cached.stats, cached: true, fetched_at: cached.fetched_at })
    }
  }

  const { items, stats, error } = await fetchMarketStats(loc, check_in, check_out)
  if (error) return NextResponse.json({ error }, { status: 502 })

  // 寫入快取（跨用戶共享）
  await admin.from('price_compare_cache').upsert({
    cache_key: cacheKey,
    location: loc,
    check_in,
    check_out,
    items,
    stats,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' })

  return NextResponse.json({ items, stats, cached: false })
}
