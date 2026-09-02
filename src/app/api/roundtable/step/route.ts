import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  executeBossStep,
  executeSynthesize,
  DOMAIN_PRESETS,
  DEFAULT_SEATS,
  DEFAULT_MODERATOR,
  type Seat,
  type RoundtableEvent,
  type RoundtableDomain,
  type Statement,
} from '@/lib/ai/roundtable'
import { loadExpertContext } from '@/lib/experts/loader'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const body = await req.json()
  const {
    sessionId,
    action, // 'continue_all' | 'call_on' | 'synthesize'
    bossGuidance = '',
    targetSeat,
    crossExamine = true,
    moderatorModel,
    synthesisStyle = 'default',
  } = body as {
    sessionId: string
    action: 'continue_all' | 'call_on' | 'synthesize'
    bossGuidance?: string
    targetSeat?: string
    crossExamine?: boolean
    moderatorModel?: string
    synthesisStyle?: SynthesisStyle
  }

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), { status: 400 })
  }

  // 讀取既有會議紀錄
  const { data: session, error: sessErr } = await supabase
    .from('roundtable_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessErr || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
  }

  const seats: Seat[] = session.seats?.length ? session.seats : DEFAULT_SEATS
  const domain: RoundtableDomain = session.domain ?? 'auto'
  const preset = DOMAIN_PRESETS[domain] ?? DOMAIN_PRESETS.auto
  const factBriefing: string = session.fact_briefing ?? ''
  const priorTranscript: Statement[] = session.transcript ?? []

  // 計算新一輪次編號 (取既有最大 round + 1)
  const maxRound = priorTranscript.reduce((max, item) => Math.max(max, item.round ?? 1), 2)
  const nextRound = maxRound + 1

  // 預先載入席位專家知識
  const expertContextMap = new Map<string, string>()
  const expertIds = [...new Set(seats.map(s => s.expertId).filter(Boolean) as string[])]
  if (expertIds.length) {
    await Promise.all(
      expertIds.map(async id => {
        const ctx = await loadExpertContext([id])
        if (ctx) expertContextMap.set(id, ctx)
      })
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let finalReport: string | null = session.report ?? null
      const newStatements: Statement[] = []
      let isWaitingBoss = false

      const emit = (e: RoundtableEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
        if (e.type === 'report') {
          finalReport = e.content
        } else if (e.type === 'waiting_boss') {
          isWaitingBoss = true
        }
      }

      try {
        if (action === 'synthesize') {
          // 結會收斂
          const moderatorToUse: Seat = {
            name: '首席幕僚長',
            model: moderatorModel || DEFAULT_MODERATOR.model,
            role: DEFAULT_MODERATOR.role,
          }
          const report = await executeSynthesize(
            session.instruction,
            factBriefing,
            priorTranscript,
            moderatorToUse,
            emit,
            synthesisStyle,
          )
          finalReport = report
        } else {
          // 老闆介入發言 (全體深化 或 點名單挑)
          const stepStatements = await executeBossStep(
            session.instruction,
            factBriefing,
            priorTranscript,
            bossGuidance,
            action,
            nextRound,
            targetSeat,
            crossExamine,
            seats,
            preset,
            emit,
            expertContextMap,
          )
          newStatements.push(...stepStatements)
          // 完成本輪後，再次暫停等待老闆後續指令
          emit({ type: 'waiting_boss', round: nextRound })
          isWaitingBoss = true
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[roundtable-step] error:', err)
        emit({ type: 'error', name: 'system', error: String(err) })
      } finally {
        // 更新資料庫
        const updatedTranscript = [...priorTranscript, ...newStatements]
        const { error: updErr } = await supabase
          .from('roundtable_sessions')
          .update({
            transcript: updatedTranscript,
            report: finalReport,
            status: isWaitingBoss ? 'waiting_boss' : 'completed',
          })
          .eq('id', sessionId)

        if (updErr) {
          // 若遠端欄位尚未執行 migration，退回基礎欄位更新
          await supabase
            .from('roundtable_sessions')
            .update({
              transcript: updatedTranscript,
              report: finalReport,
            })
            .eq('id', sessionId)
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
