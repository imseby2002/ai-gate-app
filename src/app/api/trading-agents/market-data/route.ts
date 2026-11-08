import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMarketData } from '@/lib/trading-agents/market-data'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const ticker = searchParams.get('ticker') || 'NVDA'

    const data = await fetchMarketData(ticker)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/trading-agents/market-data] error:', err)
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 })
  }
}
