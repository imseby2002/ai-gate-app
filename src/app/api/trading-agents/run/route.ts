import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runTradingAgents } from '@/lib/trading-agents/engine'
import { saveTradingSession } from '@/lib/trading-agents/storage'
import type { TradingAgentsEvent, TradingAgentsSession, PortfolioContext } from '@/lib/trading-agents/types'
import type { RunTradingAgentsParams } from '@/lib/trading-agents/engine'
import { chargeUsage, precheckUsage } from '@/lib/marketing/billing'
import { calculateModelCosts } from '@/lib/ai/token-cost-tracker'

// 每次分析呼叫多個模型（分析師、多空辯論、交易員、經理），依實際 token 用量扣點；開始前先確認餘額
const PRECHECK_USD = 0.1

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, is_active')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) {
    return new Response(JSON.stringify({ error: 'Account suspended' }), { status: 403 })
  }

  const body = await req.json()
  const {
    ticker,
    analysisDate = new Date().toISOString().split('T')[0],
    portfolio,
    config,
  } = body as {
    ticker: string
    analysisDate?: string
    portfolio?: PortfolioContext
    config?: RunTradingAgentsParams['config']
  }

  if (!ticker || !ticker.trim()) {
    return new Response(JSON.stringify({ error: 'Ticker symbol is required' }), { status: 400 })
  }

  const blocked = await precheckUsage(user.id, PRECHECK_USD)
  if (blocked) return new Response(JSON.stringify(blocked), { status: 402 })

  let costUsd = 0
  const onUsage = (modelId: string, usage: { inputTokens?: number; outputTokens?: number }) => {
    costUsd += calculateModelCosts(modelId, usage.inputTokens ?? 0, usage.outputTokens ?? 0).actualCostUsd
  }

  const sessionId = crypto.randomUUID()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: TradingAgentsEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      let executionResult: Awaited<ReturnType<typeof runTradingAgents>> | null = null

      try {
        executionResult = await runTradingAgents(
          {
            ticker: ticker.trim().toUpperCase(),
            analysisDate,
            portfolio,
            config,
            onUsage,
          },
          emit
        )

        emit({ type: 'done', sessionId })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[trading-agents/run] stream error:', err)
        emit({ type: 'error', message: String(err) })
      } finally {
        if (executionResult) {
          const sessionPayload: Partial<TradingAgentsSession> & { id: string; userId: string; ticker: string } = {
            id: sessionId,
            userId: user.id,
            ticker: ticker.trim().toUpperCase(),
            analysisDate,
            status: 'completed',
            marketData: executionResult.marketData,
            portfolio,
            valuationSuite: executionResult.valuationSuite,
            analysts: executionResult.analysts,
            debate: executionResult.debate,
            traderProposal: executionResult.traderProposal,
            riskAssessment: executionResult.riskAssessment,
            finalDecision: executionResult.finalDecision,
            fullReportHtml: executionResult.reportHtml,
          }
          await saveTradingSession(sessionPayload)
        }
        // 不論成功或中途失敗，已用掉的模型成本都要扣
        if (costUsd > 0) await chargeUsage(user.id, costUsd, `[trading-agents] ${ticker.trim().toUpperCase()} 投資分析`).catch(() => {})
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
