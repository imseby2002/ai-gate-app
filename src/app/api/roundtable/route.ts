import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runRoundtable, type Seat, type RoundtableEvent } from '@/lib/ai/roundtable'

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
  const { instruction, seats, rebuttal } = body as {
    instruction: string
    seats?: Seat[]
    rebuttal?: boolean
  }

  if (!instruction?.trim()) {
    return new Response(JSON.stringify({ error: 'Instruction required' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: RoundtableEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      try {
        await runRoundtable({ bossInstruction: instruction, seats, rebuttal }, emit)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[roundtable] error:', err)
        emit({ type: 'error', name: 'system', error: String(err) })
      } finally {
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
