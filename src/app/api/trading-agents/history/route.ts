import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecentTradingSessions, settleTradingDecision } from '@/lib/trading-agents/storage'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessions = await getRecentTradingSessions(user.id, 30)
    return NextResponse.json({ sessions })
  } catch (err) {
    console.error('[api/trading-agents/history] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId, settlePrice } = body
    if (!sessionId || typeof settlePrice !== 'number') {
      return NextResponse.json({ error: 'sessionId and settlePrice are required' }, { status: 400 })
    }

    const settlement = await settleTradingDecision(sessionId, user.id, settlePrice)
    if (!settlement) {
      return NextResponse.json({ error: 'Failed to settle session' }, { status: 404 })
    }

    return NextResponse.json({ settlement })
  } catch (err) {
    console.error('[api/trading-agents/history] POST error:', err)
    return NextResponse.json({ error: 'Failed to settle decision' }, { status: 500 })
  }
}
