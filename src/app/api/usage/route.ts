import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '30')

  // Daily breakdown
  const { data: daily } = await supabase
    .from('usage_daily')
    .select('date, model_id, message_count, input_tokens, output_tokens, total_cost_usd')
    .eq('user_id', user.id)
    .gte('date', new Date(Date.now() - days * 86400000).toISOString().split('T')[0])
    .order('date', { ascending: true })

  // Per-model summary using RPC
  const { data: byModel } = await supabase.rpc('get_usage_summary', {
    p_user_id: user.id,
    p_days: days,
  })

  // Total cost
  const totalCost = (byModel ?? []).reduce((sum: number, m: { total_cost_usd: number }) => sum + (m.total_cost_usd ?? 0), 0)
  const totalTokens = (byModel ?? []).reduce((sum: number, m: { input_tokens: number; output_tokens: number }) => sum + (m.input_tokens ?? 0) + (m.output_tokens ?? 0), 0)

  // Aggregate daily for chart (sum across models per day)
  const dailyMap = new Map<string, { date: string; cost: number; messages: number }>()
  for (const row of daily ?? []) {
    const existing = dailyMap.get(row.date) ?? { date: row.date, cost: 0, messages: 0 }
    existing.cost += row.total_cost_usd ?? 0
    existing.messages += row.message_count ?? 0
    dailyMap.set(row.date, existing)
  }

  return NextResponse.json({
    totalCostUsd: totalCost,
    totalTokens,
    byModel: byModel ?? [],
    byDay: Array.from(dailyMap.values()),
  })
}
