import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamFreeLlm } from '@/lib/ai/providers/free-llm'
import { streamCliProxy } from '@/lib/ai/providers/cli-proxy'
import { calculateModelCosts, cleanModelId, estimateTextTokens, type SourceChannel } from '@/lib/ai/token-cost-tracker'

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

    const startTime = Date.now()
    const cleanId = cleanModelId(modelId)
    const channel: SourceChannel = provider === 'free-llm' ? 'freellm' : 'cliproxy'
    const normalizedModelId = `${channel}:${cleanId}`

    let streamResult
    if (provider === 'free-llm') {
      streamResult = await streamFreeLlm({
        modelId: cleanId,
        messages,
        systemPrompt,
        maxTokens,
        model: cleanId,
      })
    } else {
      streamResult = await streamCliProxy({
        modelId: cleanId,
        messages,
        systemPrompt,
        maxTokens,
      })
    }

    let fullContent = ''
    let inputTokens = 0
    let outputTokens = 0

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          for await (const part of streamResult.fullStream) {
            if (part.type === 'text-delta') {
              fullContent += part.text
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: part.text })}\n\n`)
              )
            } else if (part.type === 'error') {
              throw part.error
            } else if (part.type === 'finish') {
              inputTokens = part.totalUsage?.inputTokens ?? 0
              outputTokens = part.totalUsage?.outputTokens ?? 0
            }
          }

          // Fallback token estimation if provider did not return usage in stream
          if (inputTokens === 0) {
            const promptText = (systemPrompt ? systemPrompt + ' ' : '') + messages.map(m => m.content).join(' ')
            inputTokens = estimateTextTokens(promptText)
          }
          if (outputTokens === 0) {
            outputTokens = estimateTextTokens(fullContent)
          }

          const latencyMs = Date.now() - startTime
          const costs = calculateModelCosts(normalizedModelId, inputTokens, outputTokens, channel)

          const finishReasonMeta = JSON.stringify({
            source: channel,
            model: normalizedModelId,
            savedUsd: costs.savedCostUsd,
            isFree: true,
            service: 'programming',
          })

          // Save usage to messages table (will also trigger aggregate_usage_on_message into usage_daily)
          const { error: insertErr } = await supabase.from('messages').insert({
            user_id: user.id,
            conversation_id: null,
            role: 'assistant',
            content: fullContent.slice(0, 1000), // compact excerpt
            model_id: normalizedModelId,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: 0,
            latency_ms: latencyMs,
            finish_reason: finishReasonMeta,
          })

          if (insertErr && (insertErr.code === '23503' || insertErr.message?.includes('foreign key'))) {
            // Foreign key fallback: insert with model_id: null and directly upsert into usage_daily
            await supabase.from('messages').insert({
              user_id: user.id,
              conversation_id: null,
              role: 'assistant',
              content: fullContent.slice(0, 1000),
              model_id: null,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cost_usd: 0,
              latency_ms: latencyMs,
              finish_reason: finishReasonMeta,
            })
          }

          // Also directly ensure usage_daily is incremented
          try {
            const today = new Date().toISOString().split('T')[0]
            const { data: existingUd } = await supabase
              .from('usage_daily')
              .select('id, message_count, input_tokens, output_tokens, total_cost_usd')
              .eq('user_id', user.id)
              .eq('model_id', normalizedModelId)
              .eq('date', today)
              .maybeSingle()

            if (existingUd) {
              await supabase.from('usage_daily').update({
                message_count: (existingUd.message_count || 0) + 1,
                input_tokens: (existingUd.input_tokens || 0) + inputTokens,
                output_tokens: (existingUd.output_tokens || 0) + outputTokens,
              }).eq('id', existingUd.id)
            } else {
              await supabase.from('usage_daily').insert({
                user_id: user.id,
                model_id: normalizedModelId,
                date: today,
                message_count: 1,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                total_cost_usd: 0,
              })
            }
          } catch (udErr) {
            console.error('[programing-completion] usage_daily upsert error:', udErr)
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', inputTokens, outputTokens })}\n\n`))
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
