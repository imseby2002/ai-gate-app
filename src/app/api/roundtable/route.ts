import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runRoundtable, DEFAULT_SEATS, DEFAULT_MODERATOR, type Seat, type RoundtableEvent } from '@/lib/ai/roundtable'

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

  // 圓桌會議跨多模型多輪，成本較高 → 外部用戶需有足夠餘額
  if (profile.user_type === 'external') {
    const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })
    if ((balance ?? 0) < 0.1) {
      return new Response(JSON.stringify({ error: 'insufficient_credits' }), { status: 402 })
    }
  }

  const body = await req.json()
  const { instruction, seats, seatExpertIds, rebuttal } = body as {
    instruction: string
    seats?: Seat[]
    seatExpertIds?: (string | null)[]
    rebuttal?: boolean
  }

  if (!instruction?.trim()) {
    return new Response(JSON.stringify({ error: 'Instruction required' }), { status: 400 })
  }

  // 沒有自訂 seats 時，把每個席位選的 expertId 合併進 DEFAULT_SEATS
  let resolvedSeats: Seat[] | undefined = seats
  if (!resolvedSeats && seatExpertIds?.length) {
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const transcript: { round: number; name: string; role: string; content: string }[] = []
      let report: string | null = null
      const emit = (e: RoundtableEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
        if (e.type === 'seat-start') {
          transcript.push({ round: e.round, name: e.name, role: roleByName.get(e.name) ?? '', content: '' })
        } else if (e.type === 'delta') {
          const block = [...transcript].reverse().find(b => b.round === e.round && b.name === e.name)
          if (block) block.content += e.content
        } else if (e.type === 'report') {
          report = e.content
        }
      }
      try {
        await runRoundtable({ bossInstruction: instruction, seats: resolvedSeats, rebuttal }, emit)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[roundtable] error:', err)
        emit({ type: 'error', name: 'system', error: String(err) })
      } finally {
        // 存檔失敗不影響已經串流給前端的結果，只記 log；serverless 環境下
        // 必須在 close() 前 await，不然函式執行環境可能在寫入完成前就被回收。
        const { error } = await supabase.from('roundtable_sessions').insert({
          user_id: user.id,
          instruction,
          seats: finalSeats,
          rebuttal: rebuttal !== false,
          transcript,
          report,
        })
        if (error) console.error('[roundtable] save session failed:', error)
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
