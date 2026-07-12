import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectIntent, resolveModel, getProviderFromModel, calculateCost, isImageModel, isVideoModel, INTENT_CHAIN } from '@/lib/ai/router'
import { buildSystemPrompt, formatMessagesForContext } from '@/lib/ai/context-builder'
import { streamDeepSeek } from '@/lib/ai/providers/deepseek'
import { streamGemini } from '@/lib/ai/providers/gemini'
import { streamClaude } from '@/lib/ai/providers/claude'
import { streamPerplexity } from '@/lib/ai/providers/perplexity'
import { streamOpenRouter } from '@/lib/ai/providers/openrouter'
import { streamGroq } from '@/lib/ai/providers/groq'
import { streamByChain } from '@/lib/ai/proxy-fallback'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Get user profile + subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, is_active, monthly_budget')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) {
    return new Response(JSON.stringify({ error: 'Account suspended' }), { status: 403 })
  }

  // Check credits for external users
  if (profile.user_type === 'external') {
    const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })
    if ((balance ?? 0) < 0.01) {
      return new Response(JSON.stringify({ error: 'insufficient_credits' }), { status: 402 })
    }
  }

  const body = await req.json()
  const {
    conversationId,
    assistantId,
    modelOverride,
    message,
    imageBase64,
  } = body as {
    conversationId?: string
    assistantId?: string
    modelOverride?: string
    message: string
    imageBase64?: string
  }

  if (!message?.trim() && !imageBase64) {
    return new Response(JSON.stringify({ error: 'Message required' }), { status: 400 })
  }

  // Load assistant + files if provided (must belong to current user)
  let assistant = null
  let assistantFiles: Array<{ extracted_text: string | null; file_name: string }> = []

  if (assistantId) {
    const { data: asst } = await supabase
      .from('assistants')
      .select('*')
      .eq('id', assistantId)
      .eq('user_id', user.id)
      .single()
    if (!asst) {
      return new Response(JSON.stringify({ error: 'Assistant not found' }), { status: 404 })
    }
    assistant = asst

    const { data: files } = await supabase
      .from('assistant_files')
      .select('file_name, extracted_text, processing_status')
      .eq('assistant_id', assistantId)
      .eq('processing_status', 'done')
    assistantFiles = files ?? []
  }

  // Detect intent + resolve model
  const intent = detectIntent(message, !!imageBase64, assistant?.routing_tags ?? undefined)
  const modelId = resolveModel(intent, modelOverride ?? assistant?.default_model)
  const provider = getProviderFromModel(modelId)

  // Reject image/video models in chat endpoint (before any writes)
  if (isImageModel(modelId) || isVideoModel(modelId)) {
    return new Response(
      JSON.stringify({ error: 'Use /api/image/generate or /api/video/generate for media generation' }),
      { status: 400 }
    )
  }

  // Load conversation history (must belong to current user)
  let conversationMessages: Array<{ role: string; content: string }> = []
  let activeConversationId = conversationId

  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()
    if (!conv) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 })
    }

    // Latest 20 messages in chronological order
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20)
    conversationMessages = (msgs ?? []).reverse()
  } else {
    // Create new conversation
    const title = message.trim().slice(0, 60) || '圖片對話'
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        assistant_id: assistantId ?? null,
        title,
      })
      .select('id')
      .single()
    if (!newConv?.id) {
      return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 })
    }
    activeConversationId = newConv.id
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(assistant, assistantFiles as Parameters<typeof buildSystemPrompt>[1])
  const formattedMessages = formatMessagesForContext([
    ...conversationMessages,
    { role: 'user', content: message }
  ])

  // Save user message first
  const { data: userMsg } = await supabase
    .from('messages')
    .insert({
      conversation_id: activeConversationId,
      user_id: user.id,
      role: 'user',
      content: message,
    })
    .select('id')
    .single()

  // Update conversation updated_at
  if (activeConversationId) {
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString(), model_id: modelId })
      .eq('id', activeConversationId)
  }

  const startTime = Date.now()

  try {
    // Stream from appropriate provider
    let streamResult
    // Actual model used for cost tracking (fallback chain may pick a different one)
    let effectiveModelId = modelId

    const chatParams = {
      modelId,
      messages: formattedMessages,
      systemPrompt: systemPrompt || undefined,
      maxTokens: 4096,
    }

    // ── Proxy fallback chain (free first, paid last) ─────────────────────────
    const chainName = !modelOverride ? INTENT_CHAIN[intent] : undefined

    if (chainName && intent !== 'vision') {
      // Use fallback chain: CLI Proxy → FreeLLMAPI → Direct paid API
      const imageMimeType = imageBase64?.match(/^data:(image\/\w+);base64,/)?.[1] ?? 'image/jpeg'
      const imageInput = imageBase64
        ? { base64: imageBase64.replace(/^data:image\/\w+;base64,/, ''), mimeType: imageMimeType }
        : undefined
      const fallback = await streamByChain(chainName, chatParams, imageInput)
      streamResult = fallback.stream
      // Free proxy models cost 0 (unknown ids fall through calculateCost → 0)
      effectiveModelId = fallback.usedVia === 'direct' ? fallback.usedModel : `proxy:${fallback.usedModel}`
    } else if (provider === 'perplexity') {
      // Legal/web search → always direct Perplexity (needs real web)
      streamResult = await streamPerplexity(chatParams)
    } else if (provider === 'google' || intent === 'vision') {
      // Vision or Google → direct Gemini (multimodal needs native support)
      streamResult = await streamGemini({ ...chatParams, imageBase64 })
    } else if (provider === 'deepseek') {
      streamResult = await streamDeepSeek(chatParams)
    } else if (provider === 'anthropic') {
      streamResult = await streamClaude(chatParams)
    } else if (provider === 'openrouter') {
      streamResult = await streamOpenRouter(chatParams)
    } else if (provider === 'groq') {
      streamResult = await streamGroq(chatParams)
    } else {
      // Final fallback: DeepSeek direct
      streamResult = await streamDeepSeek({ ...chatParams, modelId: 'deepseek-chat' })
    }

    // Build streaming response + track usage after completion
    let fullContent = ''
    let inputTokens = 0
    let outputTokens = 0

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // Send metadata first
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'meta', conversationId: activeConversationId, modelId: effectiveModelId })}\n\n`
        ))

        try {
          for await (const part of streamResult.fullStream) {
            if (part.type === 'text-delta') {
              fullContent += part.text
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'delta', content: part.text })}\n\n`
              ))
            } else if (part.type === 'error') {
              throw part.error
            } else if (part.type === 'finish') {
              inputTokens = part.totalUsage?.inputTokens ?? 0
              outputTokens = part.totalUsage?.outputTokens ?? 0
            }
          }

          const costUsd = calculateCost(effectiveModelId, inputTokens, outputTokens)
          const latencyMs = Date.now() - startTime

          // Save assistant message
          await supabase.from('messages').insert({
            conversation_id: activeConversationId,
            user_id: user.id,
            role: 'assistant',
            content: fullContent,
            model_id: effectiveModelId,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: costUsd,
            latency_ms: latencyMs,
          })

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              conversationId: activeConversationId,
              modelId: effectiveModelId,
              inputTokens,
              outputTokens,
              costUsd,
              latencyMs,
            })}\n\n`
          ))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error(`[chat] stream error (model=${effectiveModelId}):`, err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`
          ))
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
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'AI service unavailable' }), { status: 503 })
  }
}
