// 周邊行情擷取（SerpApi Google Hotels）。compare API 與排程 cron 共用。

interface SerpProperty {
  name?: string
  type?: string
  rate_per_night?: { extracted_lowest?: number }
  extracted_price?: number
  overall_rating?: number
  reviews?: number
}

export interface CompareItem {
  name: string
  type: string | null
  price: number | null
  rating: number | null
  reviews: number | null
}

export interface MarketStats {
  count: number
  min: number
  max: number
  avg: number
  median: number
}

export interface MarketResult {
  items: CompareItem[]
  stats: MarketStats | null
  error?: string
}

// 打 SerpApi 取得指定地區、指定入住日的周邊房價清單與統計。
export async function fetchMarketStats(location: string, checkIn: string, checkOut: string): Promise<MarketResult> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) return { items: [], stats: null, error: '未設定 SERPAPI_API_KEY 環境變數' }

  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: location,
    check_in_date: checkIn,
    check_out_date: checkOut,
    currency: 'TWD',
    gl: 'tw',
    hl: 'zh-tw',
    api_key: apiKey,
  })

  let data: { error?: string; properties?: SerpProperty[]; ads?: SerpProperty[] }
  try {
    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(30000),
    })
    data = await res.json()
  } catch (e) {
    return { items: [], stats: null, error: `SerpApi 請求失敗: ${String(e)}` }
  }

  if (data.error) return { items: [], stats: null, error: `SerpApi: ${data.error}` }

  const raw: SerpProperty[] = [...(data.properties ?? []), ...(data.ads ?? [])]
  const items: CompareItem[] = raw
    .map((p): CompareItem => ({
      name: p.name ?? '(未具名)',
      type: p.type ?? null,
      price: p.rate_per_night?.extracted_lowest ?? p.extracted_price ?? null,
      rating: p.overall_rating ?? null,
      reviews: p.reviews ?? null,
    }))
    .filter(i => i.price != null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))

  const prices = items.map(i => i.price as number)
  const stats: MarketStats | null = prices.length
    ? {
        count: prices.length,
        min: prices[0],
        max: prices[prices.length - 1],
        avg: Math.round(prices.reduce((s, n) => s + n, 0) / prices.length),
        median: prices[Math.floor(prices.length / 2)],
      }
    : null

  return { items, stats }
}
