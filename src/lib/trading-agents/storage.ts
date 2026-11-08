import { createClient } from '@/lib/supabase/server'
import type { TradingAgentsSession } from './types'

export async function saveTradingSession(session: Partial<TradingAgentsSession> & { id: string; userId: string; ticker: string }): Promise<boolean> {
  try {
    const supabase = await createClient()
    const payload = {
      id: session.id,
      user_id: session.userId,
      ticker: session.ticker,
      analysis_date: session.analysisDate ?? new Date().toISOString().split('T')[0],
      market_data: session.marketData ?? {},
      portfolio_context: session.portfolio ?? null,
      analysts: session.analysts ?? {},
      valuation_suite: session.valuationSuite ?? null,
      debate: session.debate ?? {},
      trader_proposal: session.traderProposal ?? null,
      risk_assessment: session.riskAssessment ?? null,
      final_decision: session.finalDecision ?? null,
      full_report_html: session.fullReportHtml ?? null,
      status: session.status ?? 'completed',
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('trading_sessions').upsert(payload)
    if (error) {
      console.warn('[trading-agents] saveTradingSession error:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[trading-agents] saveTradingSession exception:', err)
    return false
  }
}

export async function getRecentTradingSessions(userId: string, limit = 20) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('trading_sessions')
      .select('id, ticker, analysis_date, status, final_decision, market_data, created_at, settlement')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[trading-agents] getRecentTradingSessions warning:', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.warn('[trading-agents] getRecentTradingSessions exception:', err)
    return []
  }
}

export async function getTradingSessionById(sessionId: string, userId: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.warn('[trading-agents] getTradingSessionById warning:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('[trading-agents] getTradingSessionById exception:', err)
    return null
  }
}

export async function settleTradingDecision(sessionId: string, userId: string, settlePrice: number) {
  try {
    const supabase = await createClient()
    const session = await getTradingSessionById(sessionId, userId)
    if (!session || !session.market_data) return null

    const initialPrice = session.market_data.currentPrice || 1
    const returnPct = Math.round(((settlePrice - initialPrice) / initialPrice) * 100 * 10) / 10
    const action = session.final_decision?.action ?? 'BUY'

    const success = (action.includes('BUY') && returnPct > 0) || (action.includes('SELL') && returnPct < 0)
    const reflection = success
      ? `標的 ${session.ticker} 依「${action}」策略執行獲利結算，結算價 ${settlePrice}，實現報酬率 ${returnPct > 0 ? '+' : ''}${returnPct}%。驗證多 Agent 團隊在趨勢判斷與風控線設定上精準，後續可沿用相似技術指標權重。`
      : `標的 ${session.ticker} 依「${action}」策略執行，結算價 ${settlePrice}，實現報酬率 ${returnPct}%。反思：應進一步加強對支撐阻力位破位的敏感度，並在震盪盤中適度調降曝險部位。`

    const settlement = {
      isSettled: true,
      settlePrice,
      returnPct,
      reflection,
      settledAt: new Date().toISOString(),
    }

    await supabase
      .from('trading_sessions')
      .update({ settlement, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)

    return settlement
  } catch (err) {
    console.warn('[trading-agents] settleTradingDecision exception:', err)
    return null
  }
}
