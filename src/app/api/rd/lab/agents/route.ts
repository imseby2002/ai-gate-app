import { NextRequest, NextResponse } from 'next/server'
import { runRdAgent, type RdAgentType } from '@/lib/rd/agents'
import { getUnitContext } from '@/lib/auth/unit-access'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  }
  try {
    const body = await req.json()
    const { agent, prompt, context } = body as {
      agent: RdAgentType
      prompt: string
      context?: any
    }

    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 })
    }

    const result = await runRdAgent({
      agent: agent || 'knowledge',
      prompt,
      context,
    })

    return NextResponse.json({
      ok: true,
      agent: result.agent,
      reply: result.reply,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
