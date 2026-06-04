import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

interface SerpProperty {
  name?: string
  type?: string
  rate_per_night?: { extracted_lowest?: number }
  extracted_price?: number
  overall_rating?: number
  reviews?: number
}

interface CompareItem {
  name: string
  type: string | null
  price: number | null
  rating: number | null
  reviews: number | null
}

// 周邊比價：打 SerpApi Google Hotels，回傳指定地區、指定入住日的周邊房價清單與統計。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) return NextResponse.json({ error: '未設定 SERPAPI_API_KEY 環境變數' }, { status: 500 })

  const { location, check_in, check_out } = await req.json()
  if (!location?.trim() || !check_in || !check_out)
    return NextResponse.json({ error: '地區、入住日、退房日必填' }, { status: 400 })

  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: location,
    check_in_date: check_in,
    check_out_date: check_out,
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
    return NextResponse.json({ error: `SerpApi 請求失敗: ${String(e)}` }, { status: 502 })
  }

  if (data.error) return NextResponse.json({ error: `SerpApi: ${data.error}` }, { status: 502 })

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
  const stats = prices.length
    ? {
        count: prices.length,
        min: prices[0],
        max: prices[prices.length - 1],
        avg: Math.round(prices.reduce((s, n) => s + n, 0) / prices.length),
        median: prices[Math.floor(prices.length / 2)],
      }
    : null

  return NextResponse.json({ items, stats })
}
