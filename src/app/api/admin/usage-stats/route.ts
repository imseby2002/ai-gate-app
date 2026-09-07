import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  detectSourceChannel,
  cleanModelId,
  getModelDisplayName,
  calculateModelCosts,
  CHANNEL_CONFIG,
  type SourceChannel,
} from '@/lib/ai/token-cost-tracker'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', supabase: null, user: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (profile?.user_type !== 'admin') {
    return { error: 'Forbidden', supabase: null, user: null }
  }

  return { error: null, supabase, user }
}

export async function GET(req: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) {
    return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  }

  const { searchParams } = new URL(req.url)
  const daysParam = searchParams.get('days') ?? 'all'
  const filterChannel = searchParams.get('channel') ?? 'all'

  let startDateStr: string | null = null
  if (daysParam !== 'all') {
    const days = parseInt(daysParam, 10) || 30
    startDateStr = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  }

  // 1. Fetch usage_daily
  let dailyQuery = supabase!
    .from('usage_daily')
    .select('date, model_id, total_cost_usd, message_count, input_tokens, output_tokens')
    .order('date', { ascending: true })

  if (startDateStr) {
    dailyQuery = dailyQuery.gte('date', startDateStr)
  }

  const { data: dailyRows } = await dailyQuery

  // 2. Fetch messages to get recent granular / metadata records (including finish_reason source tags)
  let msgQuery = supabase!
    .from('messages')
    .select('created_at, model_id, input_tokens, output_tokens, cost_usd, finish_reason')
    .eq('role', 'assistant')
    .not('model_id', 'is', null)
    .order('created_at', { ascending: true })

  if (startDateStr) {
    msgQuery = msgQuery.gte('created_at', `${startDateStr}T00:00:00.000Z`)
  }

  const { data: messageRows } = await msgQuery

  // Structure for per-(model, channel) aggregates
  interface ModelStat {
    model_id: string
    display_name: string
    source_channel: SourceChannel
    channel_label: string
    is_free: boolean
    requests: number
    input_tokens: number
    output_tokens: number
    total_tokens: number
    cost_usd: number
    cost_twd: number
    saved_usd: number
    saved_twd: number
  }

  const modelMap = new Map<string, ModelStat>()

  // Structure for channel aggregates
  const channelTotals: Record<SourceChannel, {
    requests: number
    input_tokens: number
    output_tokens: number
    total_tokens: number
    cost_usd: number
    cost_twd: number
    saved_usd: number
    saved_twd: number
    is_free: boolean
    label: string
    sub_label: string
  }> = {
    cliproxy: { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: true, label: CHANNEL_CONFIG.cliproxy.label, sub_label: CHANNEL_CONFIG.cliproxy.subLabel },
    freellm:  { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: true, label: CHANNEL_CONFIG.freellm.label, sub_label: CHANNEL_CONFIG.freellm.subLabel },
    groq:     { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: true, label: CHANNEL_CONFIG.groq.label, sub_label: CHANNEL_CONFIG.groq.subLabel },
    direct:   { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: false, label: CHANNEL_CONFIG.direct.label, sub_label: CHANNEL_CONFIG.direct.subLabel },
  }

  // Daily timeline tracking
  const dayMap = new Map<string, {
    date: string
    cost_usd: number
    cliproxy_tokens: number
    cliproxy_requests: number
    freellm_tokens: number
    freellm_requests: number
    groq_tokens: number
    groq_requests: number
    direct_tokens: number
    direct_requests: number
    total_tokens: number
    requests: number
  }>()

  // Process usage_daily (primary source for historical aggregates)
  for (const row of dailyRows ?? []) {
    const rawModel = row.model_id ?? ''
    const channel = detectSourceChannel(rawModel)
    const cleanId = cleanModelId(rawModel)
    const key = `${channel}:${cleanId}`

    const inTokens = row.input_tokens ?? 0
    const outTokens = row.output_tokens ?? 0
    const reqCount = row.message_count ?? 0
    const dbCost = row.total_cost_usd ?? 0

    const costs = calculateModelCosts(rawModel, inTokens, outTokens, channel)
    // If DB has a recorded cost for direct, use it, otherwise use calculated
    const finalCostUsd = channel === 'direct' ? (dbCost > 0 ? dbCost : costs.actualCostUsd) : 0
    const finalCostTwd = finalCostUsd * 32.0

    const entry = modelMap.get(key) ?? {
      model_id: cleanId,
      display_name: getModelDisplayName(rawModel, channel),
      source_channel: channel,
      channel_label: CHANNEL_CONFIG[channel].label,
      is_free: CHANNEL_CONFIG[channel].isFree,
      requests: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      cost_twd: 0,
      saved_usd: 0,
      saved_twd: 0,
    }

    entry.requests += reqCount
    entry.input_tokens += inTokens
    entry.output_tokens += outTokens
    entry.total_tokens += (inTokens + outTokens)
    entry.cost_usd += finalCostUsd
    entry.cost_twd += finalCostTwd
    entry.saved_usd += costs.savedCostUsd
    entry.saved_twd += costs.savedCostTwd
    modelMap.set(key, entry)

    // Add to channel totals
    channelTotals[channel].requests += reqCount
    channelTotals[channel].input_tokens += inTokens
    channelTotals[channel].output_tokens += outTokens
    channelTotals[channel].total_tokens += (inTokens + outTokens)
    channelTotals[channel].cost_usd += finalCostUsd
    channelTotals[channel].cost_twd += finalCostTwd
    channelTotals[channel].saved_usd += costs.savedCostUsd
    channelTotals[channel].saved_twd += costs.savedCostTwd

    // Day map
    const day = dayMap.get(row.date) ?? {
      date: row.date,
      cost_usd: 0,
      cliproxy_tokens: 0,
      cliproxy_requests: 0,
      freellm_tokens: 0,
      freellm_requests: 0,
      groq_tokens: 0,
      groq_requests: 0,
      direct_tokens: 0,
      direct_requests: 0,
      total_tokens: 0,
      requests: 0,
    }

    day.cost_usd += finalCostUsd
    day.total_tokens += (inTokens + outTokens)
    day.requests += reqCount

    if (channel === 'cliproxy') {
      day.cliproxy_tokens += (inTokens + outTokens)
      day.cliproxy_requests += reqCount
    } else if (channel === 'freellm') {
      day.freellm_tokens += (inTokens + outTokens)
      day.freellm_requests += reqCount
    } else if (channel === 'groq') {
      day.groq_tokens += (inTokens + outTokens)
      day.groq_requests += reqCount
    } else {
      day.direct_tokens += (inTokens + outTokens)
      day.direct_requests += reqCount
    }

    dayMap.set(row.date, day)
  }

  // Cross-check recent messages for any proxy calls that may not be in usage_daily yet
  // (e.g. If finish_reason contains proxy metadata)
  for (const msg of messageRows ?? []) {
    let msgChannel: SourceChannel | null = null
    let msgCleanModel = cleanModelId(msg.model_id ?? '')
    let savedUsd = 0

    if (msg.finish_reason && msg.finish_reason.startsWith('{')) {
      try {
        const meta = JSON.parse(msg.finish_reason)
        if (meta.source === 'cli-proxy' || meta.source === 'cliproxy') msgChannel = 'cliproxy'
        if (meta.source === 'free-llm' || meta.source === 'freellm') msgChannel = 'freellm'
        if (meta.model) msgCleanModel = cleanModelId(meta.model)
        if (meta.savedUsd) savedUsd = Number(meta.savedUsd) || 0
      } catch {
        // ignore parse error
      }
    }

    if (!msgChannel && msg.model_id) {
      msgChannel = detectSourceChannel(msg.model_id)
    }

    // If this message belongs to cliproxy or freellm and isn't captured in dailyRows
    if (msgChannel && (msgChannel === 'cliproxy' || msgChannel === 'freellm')) {
      const key = `${msgChannel}:${msgCleanModel}`
      const existing = modelMap.get(key)
      if (!existing) {
        const inTokens = msg.input_tokens ?? 0
        const outTokens = msg.output_tokens ?? 0
        const costs = calculateModelCosts(msgCleanModel, inTokens, outTokens, msgChannel)
        const sUsd = savedUsd > 0 ? savedUsd : costs.savedCostUsd

        modelMap.set(key, {
          model_id: msgCleanModel,
          display_name: getModelDisplayName(msgCleanModel, msgChannel),
          source_channel: msgChannel,
          channel_label: CHANNEL_CONFIG[msgChannel].label,
          is_free: true,
          requests: 1,
          input_tokens: inTokens,
          output_tokens: outTokens,
          total_tokens: inTokens + outTokens,
          cost_usd: 0,
          cost_twd: 0,
          saved_usd: sUsd,
          saved_twd: sUsd * 32.0,
        })

        channelTotals[msgChannel].requests += 1
        channelTotals[msgChannel].input_tokens += inTokens
        channelTotals[msgChannel].output_tokens += outTokens
        channelTotals[msgChannel].total_tokens += (inTokens + outTokens)
        channelTotals[msgChannel].saved_usd += sUsd
        channelTotals[msgChannel].saved_twd += sUsd * 32.0
      }
    }
  }

  // Prepopulate standard models so the admin sees the full capability matrix even before first call
  const standardShowcase: Array<{ model_id: string; channel: SourceChannel }> = [
    { model_id: 'gemini-3-flash', channel: 'cliproxy' },
    { model_id: 'kimi-k2.5', channel: 'cliproxy' },
    { model_id: 'gpt-5.4-mini', channel: 'cliproxy' },
    { model_id: 'grok-3-mini', channel: 'cliproxy' },
    { model_id: 'llama-3.3-70b', channel: 'freellm' },
    { model_id: 'glm-4.7-flash', channel: 'freellm' },
    { model_id: 'qwen3-32b', channel: 'freellm' },
  ]

  for (const item of standardShowcase) {
    const key = `${item.channel}:${item.model_id}`
    if (!modelMap.has(key)) {
      modelMap.set(key, {
        model_id: item.model_id,
        display_name: getModelDisplayName(item.model_id, item.channel),
        source_channel: item.channel,
        channel_label: CHANNEL_CONFIG[item.channel].label,
        is_free: true,
        requests: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        cost_twd: 0,
        saved_usd: 0,
        saved_twd: 0,
      })
    }
  }

  // Convert map to sorted list
  let allModels = Array.from(modelMap.values())

  // Apply channel filter if specified
  if (filterChannel !== 'all') {
    allModels = allModels.filter(m => m.source_channel === filterChannel)
  }

  // Sort: active models with requests/cost first, then by requests descending
  allModels.sort((a, b) => {
    if (a.requests > 0 && b.requests === 0) return -1
    if (a.requests === 0 && b.requests > 0) return 1
    if (b.cost_usd !== a.cost_usd) return b.cost_usd - a.cost_usd
    return b.requests - a.requests
  })

  // Global summary metrics
  const totalCostUsd = Object.values(channelTotals).reduce((s, c) => s + c.cost_usd, 0)
  const totalCostTwd = totalCostUsd * 32.0
  const totalSavedUsd = channelTotals.cliproxy.saved_usd + channelTotals.freellm.saved_usd
  const totalSavedTwd = totalSavedUsd * 32.0
  const totalTokens = Object.values(channelTotals).reduce((s, c) => s + c.total_tokens, 0)
  const totalInputTokens = Object.values(channelTotals).reduce((s, c) => s + c.input_tokens, 0)
  const totalOutputTokens = Object.values(channelTotals).reduce((s, c) => s + c.output_tokens, 0)
  const totalRequests = Object.values(channelTotals).reduce((s, c) => s + c.requests, 0)

  const freeRequests = channelTotals.cliproxy.requests + channelTotals.freellm.requests + channelTotals.groq.requests
  const freeRatio = totalRequests > 0 ? Number(((freeRequests / totalRequests) * 100).toFixed(1)) : 0

  // Calculate percentages on each model item
  const byModelAndSource = allModels.map(m => ({
    ...m,
    cost_share_pct: totalCostUsd > 0 ? Number(((m.cost_usd / totalCostUsd) * 100).toFixed(1)) : 0,
    token_share_pct: totalTokens > 0 ? Number(((m.total_tokens / totalTokens) * 100).toFixed(1)) : 0,
  }))

  const dailyTrend = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    summary: {
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      totalCostTwd: Number(totalCostTwd.toFixed(2)),
      totalSavedUsd: Number(totalSavedUsd.toFixed(6)),
      totalSavedTwd: Number(totalSavedTwd.toFixed(2)),
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalRequests,
      freeRequests,
      freeRatio,
    },
    channels: channelTotals,
    byModelAndSource,
    dailyTrend,
  })
}
