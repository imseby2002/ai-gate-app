import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runTradingAgents } from '@/lib/trading-agents/engine'
import { saveTradingSession } from '@/lib/trading-agents/storage'
import type { TradingAgentsEvent, TradingAgentsSession, PortfolioContext } from '@/lib/trading-agents/types'
import type { RunTradingAgentsParams } from '@/lib/trading-agents/engine'

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
