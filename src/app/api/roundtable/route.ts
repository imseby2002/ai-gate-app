import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  runRoundtable,
  DEFAULT_SEATS,
  DEFAULT_MODERATOR,
  type Seat,
  type RoundtableEvent,
  type RoundtableDomain,
  type Statement,
  type SynthesisStyle,
  type VerbosityMode,
} from '@/lib/ai/roundtable'

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

  if (profile.user_type === 'external') {
    const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })
    if ((balance ?? 0) < 0.1) {
      return new Response(JSON.stringify({ error: 'insufficient_credits' }), { status: 402 })
    }
  }

  const body = await req.json()
  const {
    instruction,
    domain,
    seats,
    seatExpertIds,
    rebuttal,
    interactive = true, // 預設啟用老闆介入互動機制
    moderator,
    synthesisStyle,
    verbosity = 'standard_300',
  } = body as {
    instruction: string
    domain?: RoundtableDomain
    seats?: Seat[]
    seatExpertIds?: (string | null)[]
    rebuttal?: boolean
    interactive?: boolean
    moderator?: Seat
    synthesisStyle?: SynthesisStyle
    verbosity?: VerbosityMode
  }

  if (!instruction?.trim()) {
    return new Response(JSON.stringify({ error: 'Instruction required' }), { status: 400 })
  }

  let resolvedSeats: Seat[] | undefined = seats
  if (resolvedSeats && seatExpertIds?.length) {
    resolvedSeats = resolvedSeats.map((seat, i) => ({
      ...seat,
      expertId: seat.expertId ?? seatExpertIds[i] ?? undefined,
    }))
  } else if (!resolvedSeats && seatExpertIds?.length) {
    resolvedSeats = DEFAULT_SEATS.map((seat, i) => ({
      ...seat,
      expertId: seatExpertIds[i] ?? undefined,
    }))
  }
  const finalSeats = resolvedSeats ?? DEFAULT_SEATS
  const roleByName = new Map<string, string>([
    ...finalSeats.map(s => [s.name, s.role] as const),
    [DEFAULT_MODERATOR.name, DEFAULT_MODERATOR.role],
  ])

  const sessionId = crypto.randomUUID()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // 廣播 sessionId 給前端
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session-created', sessionId })}\n\n`))

      const transcript: Statement[] = []
      let factBriefing = ''
      let detectedDomain: RoundtableDomain = domain ?? 'auto'
      let report: string | null = null
      let isWaitingBoss = false

      const emit = (e: RoundtableEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))

        if (e.type === 'domain-detected') {
          detectedDomain = e.domain
        } else if (e.type === 'briefing-end') {
          factBriefing = e.content
        } else if (e.type === 'seat-start') {
          transcript.push({
            round: e.round,
            name: e.name,
            role: roleByName.get(e.name) ?? '',
            stance: e.stance,
            content: '',
          })
        } else if (e.type === 'delta') {
          const block = [...transcript].reverse().find(b => b.round === e.round && b.name === e.name)
          if (block) block.content += e.content
        } else if (e.type === 'waiting_boss') {
          isWaitingBoss = true
        } else if (e.type === 'report') {
          report = e.content
        }
      }

      try {
        await runRoundtable(
          {
            bossInstruction: instruction,
            domain,
            seats: resolvedSeats,
            rebuttal,
            interactive,
            moderator,
            synthesisStyle,
            verbosity,
          },
          emit,
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[roundtable] error:', err)
        emit({ type: 'error', name: 'system', error: String(err) })
      } finally {
        // 嘗試寫入完整資料庫記錄 (相容新舊欄位)
        const payload: Record<string, unknown> = {
          id: sessionId,
          user_id: user.id,
          instruction,
          seats: finalSeats,
          rebuttal: rebuttal !== false,
          transcript,
          report,
          domain: detectedDomain,
          fact_briefing: factBriefing,
          status: isWaitingBoss ? 'waiting_boss' : 'completed',
        }

        const { error } = await supabase.from('roundtable_sessions').upsert(payload)
        if (error) {
          // 若遠端欄位尚未執行 migration，退回基礎欄位寫入以防存檔失敗
          console.warn('[roundtable] upsert with v2 fields failed, falling back to basic columns:', error.message)
          const fallbackPayload = {
            id: sessionId,
            user_id: user.id,
            instruction,
            seats: finalSeats,
            rebuttal: rebuttal !== false,
            transcript: [
              ...(factBriefing ? [{ round: 0, name: '資料專員', role: '會前客觀事實簡報', content: factBriefing }] : []),
              ...transcript,
            ],
            report,
          }
          const { error: fbErr } = await supabase.from('roundtable_sessions').upsert(fallbackPayload)
          if (fbErr) console.error('[roundtable] save session fallback failed:', fbErr)
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
