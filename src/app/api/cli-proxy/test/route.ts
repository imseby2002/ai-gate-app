import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateModelCosts, estimateTextTokens } from '@/lib/ai/token-cost-tracker'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  const apiKey = process.env.CLI_PROXY_API_KEY

  if (!apiUrl) return NextResponse.json({ error: 'CLI_PROXY_API_URL 未設定' })

  try {
    const prompt = '用一句話說你好，測試連線用'
    const r = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) {
      const txt = await r.text()
      return NextResponse.json({ error: `HTTP ${r.status}: ${txt}` })
    }
    const data = await r.json()
    const reply = data.choices?.[0]?.message?.content ?? JSON.stringify(data)

    const inTokens = data.usage?.prompt_tokens ?? estimateTextTokens(prompt)
    const outTokens = data.usage?.completion_tokens ?? estimateTextTokens(reply)
    const modelId = 'cliproxy:claude-haiku-4-5-20251001'
    const costs = calculateModelCosts(modelId, inTokens, outTokens, 'cliproxy')

    const finishReasonMeta = JSON.stringify({
      source: 'cliproxy',
      model: modelId,
      savedUsd: costs.savedCostUsd,
      isFree: true,
      service: 'test',
    })

    // Record test call in messages
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

    // Update usage_daily
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
      console.error('[cli-proxy-test] usage_daily update error:', e)
    }

    return NextResponse.json({ reply, tokens: inTokens + outTokens, savedUsd: costs.savedCostUsd })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}
