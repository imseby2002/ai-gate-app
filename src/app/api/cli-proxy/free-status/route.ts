import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeFreeLlmBaseUrl } from '@/lib/ai/providers/free-llm'
import { calculateModelCosts, estimateTextTokens } from '@/lib/ai/token-cost-tracker'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const apiKey  = process.env.FREE_LLM_API_KEY

  if (!rawUrl) return NextResponse.json({ ok: false, error: 'FREE_LLM_URL 未設定' })
  const baseUrl = normalizeFreeLlmBaseUrl(rawUrl)

  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) return NextResponse.json({ ok: false, error: `HTTP ${r.status}` })
    const data = await r.json()
    const models: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
    return NextResponse.json({ ok: true, models })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  const apiKey  = process.env.FREE_LLM_API_KEY

  if (!rawUrl) return NextResponse.json({ error: 'FREE_LLM_URL 未設定' })
  const baseUrl = normalizeFreeLlmBaseUrl(rawUrl)

  try {
    const prompt = '請用一句話打招呼，此為連線測試'
    const testModel = 'llama-3.3-70b'
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: testModel,
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!r.ok) {
      const txt = await r.text()
      return NextResponse.json({ ok: false, error: `HTTP ${r.status}: ${txt}` })
    }

    const data = await r.json()
    const reply = data.choices?.[0]?.message?.content ?? JSON.stringify(data)
    const inTokens = data.usage?.prompt_tokens ?? estimateTextTokens(prompt)
    const outTokens = data.usage?.completion_tokens ?? estimateTextTokens(reply)
    const modelId = `freellm:${testModel}`
    const costs = calculateModelCosts(modelId, inTokens, outTokens, 'freellm')

    const finishReasonMeta = JSON.stringify({
      source: 'freellm',
      model: modelId,
      savedUsd: costs.savedCostUsd,
      isFree: true,
      service: 'test',
    })

    await supabase.from('messages').insert({
      user_id: user.id,
      conversation_id: null,
      role: 'assistant',
      content: reply.slice(0, 500),
      model_id: modelId,
      input_tokens: inTokens,
      output_tokens: outTokens,
      cost_usd: 0,
      finish_reason: finishReasonMeta,
    })

    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: existingUd } = await supabase
        .from('usage_daily')
        .select('id, message_count, input_tokens, output_tokens')
        .eq('user_id', user.id)
        .eq('model_id', modelId)
        .eq('date', today)
        .maybeSingle()

      if (existingUd) {
        await supabase.from('usage_daily').update({
          message_count: (existingUd.message_count || 0) + 1,
          input_tokens: (existingUd.input_tokens || 0) + inTokens,
          output_tokens: (existingUd.output_tokens || 0) + outTokens,
        }).eq('id', existingUd.id)
      } else {
        await supabase.from('usage_daily').insert({
          user_id: user.id,
          model_id: modelId,
          date: today,
          message_count: 1,
          input_tokens: inTokens,
          output_tokens: outTokens,
          total_cost_usd: 0,
        })
      }
    } catch (e) {
      console.error('[free-llm-test] usage_daily update error:', e)
    }

    return NextResponse.json({ ok: true, reply, tokens: inTokens + outTokens, savedUsd: costs.savedCostUsd })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
