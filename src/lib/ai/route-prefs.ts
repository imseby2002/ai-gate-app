/**
 * 每日比價與免費通道模型清單（由 /api/cron/model-prices 每天寫入 ai_route_prefs）。
 *
 * AI 呼叫端用 loadRoutePrefs() 取得，記憶體快取 1 小時；讀不到就回傳 null，
 * 呼叫端改用預設順序（直連 → OpenRouter、清單未知的模型照樣嘗試），不影響任何功能。
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface OpenRouterPrice {
  /** USD / 1M tokens */
  input: number
  output: number
  /** 選中的供應商（開源模型才有；依價格挑、排除低精度量化） */
  provider?: string
}

export interface RoutePrefs {
  updatedAt: string
  /** CLIProxy /models 回傳的模型 id；null = 當天沒抓到 */
  cliProxyModels: string[] | null
  /** OpenRouter 免費模型（id 結尾 :free） */
  openRouterFree: { id: string; name: string }[] | null
  /** OpenRouter 模型價格（key 為 OpenRouter model id） */
  openRouterPrices: Record<string, OpenRouterPrice>
  /** 同一模型直連與 OpenRouter 哪個先用（key 為 pair 名稱） */
  pairOrder: Record<string, 'direct' | 'openrouter'>
}

const CACHE_MS = 60 * 60 * 1000
let cached: { prefs: RoutePrefs | null; at: number } | null = null
let inflight: Promise<RoutePrefs | null> | null = null

export async function loadRoutePrefs(): Promise<RoutePrefs | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.prefs
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const admin = createAdminClient()
      const { data } = await admin.from('ai_route_prefs').select('data').eq('id', 'current').maybeSingle()
      const prefs = (data?.data as RoutePrefs | undefined) ?? null
      cached = { prefs, at: Date.now() }
      return prefs
    } catch {
      // 讀取失敗：沿用上一次的快取（若有），否則 null（呼叫端走預設順序）
      cached = { prefs: cached?.prefs ?? null, at: Date.now() }
      return cached.prefs
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** 同步取得最近一次載入的結果（計費等不方便 await 的地方用） */
export function getCachedRoutePrefs(): RoutePrefs | null {
  return cached?.prefs ?? null
}
