import { NextRequest, NextResponse } from 'next/server'
import { runRdAgent, type RdAgentType } from '@/lib/rd/agents'

export const maxDuration = 60

export async function POST(req: NextRequest) {
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
