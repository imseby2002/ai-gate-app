import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamFreeLlm } from '@/lib/ai/providers/free-llm'
import { streamCliProxy } from '@/lib/ai/providers/cli-proxy'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Authenticate user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Get user profile to check if active
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) {
    return new Response(JSON.stringify({ error: 'Account suspended' }), { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      provider, // 'free-llm' | 'cli-proxy'
      modelId,
      messages,
      systemPrompt,
      maxTokens = 4096,
    } = body as {
      provider: 'free-llm' | 'cli-proxy'
      modelId: string
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      systemPrompt?: string
      maxTokens?: number
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), { status: 400 })
    }

    let streamResult
    if (provider === 'free-llm') {
      streamResult = await streamFreeLlm({
        modelId,
        messages,
        systemPrompt,
        maxTokens,
        model: modelId,
      })
    } else {
      streamResult = await streamCliProxy({
        modelId,
        messages,
        systemPrompt,
        maxTokens,
      })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          for await (const part of streamResult.fullStream) {
            if (part.type === 'text-delta') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: part.text })}\n\n`)
              )
            } else if (part.type === 'error') {
              throw part.error
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('[programing-completion] stream error:', err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`)
          )
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
  } catch (error) {
    console.error('Programming completion API error:', error)
    return new Response(JSON.stringify({ error: 'AI service unavailable' }), { status: 503 })
  }
}
