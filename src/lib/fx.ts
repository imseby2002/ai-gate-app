// USD → TWD 即時匯率（綠界 TotalAmount／PeriodAmount 官方僅接受整數台幣，
// 全站帳務改為美金計價後，送給綠界的請款單仍需在此換算）。
// 快取於 fx_rates（1 小時 TTL），外部 API 失敗時退回最後一次快取值，皆無則用保守 fallback。
import { createAdminClient } from '@/lib/supabase/admin'

const PAIR = 'USD_TWD'
const CACHE_TTL_MS = 60 * 60 * 1000
const FALLBACK_RATE = 32

export async function getUsdToTwdRate(): Promise<number> {
  const admin = createAdminClient()
  const { data: cached } = await admin
    .from('fx_rates')
    .select('rate, updated_at')
    .eq('pair', PAIR)
    .maybeSingle()

  const cachedRate = cached ? Number(cached.rate) : null
  const isFresh = cached ? Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS : false
  if (isFresh && cachedRate) return cachedRate

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const json = await res.json()
      const rate = Number(json?.rates?.TWD)
      if (rate > 0) {
        await admin.from('fx_rates').upsert({ pair: PAIR, rate, updated_at: new Date().toISOString() })
        return rate
      }
    }
  } catch {
    // 外部匯率 API 失敗 → 退回快取或 fallback，不中斷付款流程
  }

  return cachedRate ?? FALLBACK_RATE
}

// 綠界 TotalAmount／PeriodAmount 僅接受整數台幣
export async function usdToTwdInteger(usd: number): Promise<{ twd: number; rate: number }> {
  const rate = await getUsdToTwdRate()
  const twd = Math.max(1, Math.round(usd * rate))
  return { twd, rate }
}
