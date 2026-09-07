import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  detectSourceChannel,
  cleanModelId,
  getModelDisplayName,
  calculateModelCosts,
  estimateTextTokens,
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
  const filterService = searchParams.get('service') ?? 'all' // 'all' | 'roundtable' | 'chat'

  let startDateStr: string | null = null
  let startTimestamp: number | null = null
  if (daysParam !== 'all') {
    const days = parseInt(daysParam, 10) || 30
    startTimestamp = Date.now() - days * 86400000
    startDateStr = new Date(startTimestamp).toISOString().split('T')[0]
  }

  // Structure for per-(model, channel) aggregates
  interface ModelStat {
    model_id: string
    display_name: string
    source_channel: SourceChannel
    channel_label: string
    service_module: 'all' | 'roundtable' | 'chat'
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
    cliproxy:   { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: true,  label: CHANNEL_CONFIG.cliproxy.label,   sub_label: CHANNEL_CONFIG.cliproxy.subLabel },
    freellm:    { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: true,  label: CHANNEL_CONFIG.freellm.label,    sub_label: CHANNEL_CONFIG.freellm.subLabel },
    groq:       { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: true,  label: CHANNEL_CONFIG.groq.label,       sub_label: CHANNEL_CONFIG.groq.subLabel },
    google:     { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: false, label: CHANNEL_CONFIG.google.label,     sub_label: CHANNEL_CONFIG.google.subLabel },
    anthropic:  { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: false, label: CHANNEL_CONFIG.anthropic.label,  sub_label: CHANNEL_CONFIG.anthropic.subLabel },
    openai:     { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: false, label: CHANNEL_CONFIG.openai.label,     sub_label: CHANNEL_CONFIG.openai.subLabel },
    deepseek:   { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: false, label: CHANNEL_CONFIG.deepseek.label,   sub_label: CHANNEL_CONFIG.deepseek.subLabel },
    openrouter: { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, cost_twd: 0, saved_usd: 0, saved_twd: 0, is_free: false, label: CHANNEL_CONFIG.openrouter.label, sub_label: CHANNEL_CONFIG.openrouter.subLabel },
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

  let totalRoundtableTokens = 0
  let totalRoundtableCostUsd = 0
  let totalRoundtableRequests = 0
  let totalChatTokens = 0
  let totalChatCostUsd = 0
  let totalChatRequests = 0

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. 處理「AI 智慧圓桌會議 (Roundtable)」所有會話與發言
  // ─────────────────────────────────────────────────────────────────────────────
  if (filterService === 'all' || filterService === 'roundtable') {
    let rtQuery = supabase!
      .from('roundtable_sessions')
      .select('id, created_at, instruction, domain, fact_briefing, seats, transcript, report')
      .order('created_at', { ascending: true })

    if (startDateStr) {
      rtQuery = rtQuery.gte('created_at', `${startDateStr}T00:00:00.000Z`)
    }

    const { data: rtSessions } = await rtQuery

    for (const session of rtSessions ?? []) {
      const dateStr = session.created_at ? session.created_at.split('T')[0] : new Date().toISOString().split('T')[0]

      const defaultSeats = session.seats || [
        { name: '員工A', model: 'anthropic/claude-sonnet-4-6' },
        { name: '員工B', model: 'openai/gpt-5' },
        { name: '員工C', model: 'google/gemini-2.5-pro' },
      ]
      const seatMap = Object.fromEntries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultSeats.map((st: any) => [st.name, st.model])
      )

      const addEntry = (rawModel: string, inTokens: number, outTokens: number) => {
        const channel = detectSourceChannel(rawModel)
        const cleanId = cleanModelId(rawModel)
        const key = `${channel}:${cleanId}`

        const costs = calculateModelCosts(rawModel, inTokens, outTokens, channel)
        const costUsd = costs.actualCostUsd
        const costTwd = costs.actualCostTwd

        totalRoundtableTokens += (inTokens + outTokens)
        totalRoundtableCostUsd += costUsd
        totalRoundtableRequests += 1

        const entry = modelMap.get(key) ?? {
          model_id: cleanId,
          display_name: getModelDisplayName(rawModel, channel),
          source_channel: channel,
          channel_label: CHANNEL_CONFIG[channel]?.label ?? channel,
          service_module: 'roundtable',
          is_free: CHANNEL_CONFIG[channel]?.isFree ?? false,
          requests: 0,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
          cost_twd: 0,
          saved_usd: 0,
          saved_twd: 0,
        }

        entry.requests += 1
        entry.input_tokens += inTokens
        entry.output_tokens += outTokens
        entry.total_tokens += (inTokens + outTokens)
        entry.cost_usd += costUsd
        entry.cost_twd += costTwd
        entry.saved_usd += costs.savedCostUsd
        entry.saved_twd += costs.savedCostTwd
        modelMap.set(key, entry)

        if (channelTotals[channel]) {
          channelTotals[channel].requests += 1
          channelTotals[channel].input_tokens += inTokens
          channelTotals[channel].output_tokens += outTokens
          channelTotals[channel].total_tokens += (inTokens + outTokens)
          channelTotals[channel].cost_usd += costUsd
          channelTotals[channel].cost_twd += costTwd
          channelTotals[channel].saved_usd += costs.savedCostUsd
          channelTotals[channel].saved_twd += costs.savedCostTwd
        }

        // Timeline
        const day = dayMap.get(dateStr) ?? {
          date: dateStr,
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

        day.cost_usd += costUsd
        day.total_tokens += (inTokens + outTokens)
        day.requests += 1

        if (channel === 'cliproxy') {
          day.cliproxy_tokens += (inTokens + outTokens)
          day.cliproxy_requests += 1
        } else if (channel === 'freellm') {
          day.freellm_tokens += (inTokens + outTokens)
          day.freellm_requests += 1
        } else if (channel === 'groq') {
          day.groq_tokens += (inTokens + outTokens)
          day.groq_requests += 1
        } else {
          day.direct_tokens += (inTokens + outTokens)
          day.direct_requests += 1
        }

        dayMap.set(dateStr, day)
      }

      // 1. Fact briefing (資料專員 - Gemini 2.5 Flash)
      if (session.fact_briefing) {
        const inTokens = estimateTextTokens(session.instruction) + 2500
        const outTokens = estimateTextTokens(session.fact_briefing)
        addEntry('google/gemini-2.5-flash', inTokens, outTokens)
      }

      // 2. Transcript rounds (各合夥人發言)
      let contextSoFar = (session.instruction || '') + '\n' + (session.fact_briefing || '')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of (session.transcript || []) as any[]) {
        if (t.name === '資料專員' || t.name === '老闆指令' || !t.content) continue
        const rawModel = seatMap[t.name] || (
          t.name === '員工A' ? 'anthropic/claude-sonnet-4-6' :
          t.name === '員工B' ? 'openai/gpt-5' :
          'google/gemini-2.5-pro'
        )
        const inTokens = estimateTextTokens(contextSoFar) + 800
        const outTokens = estimateTextTokens(t.content)
        contextSoFar += '\n' + t.content
        addEntry(rawModel, inTokens, outTokens)
      }

      // 3. Final synthesis report (首席幕僚長 - Claude Opus 4.8 / 3.7)
      if (session.report) {
        const inTokens = estimateTextTokens(contextSoFar) + 1200
        const outTokens = estimateTextTokens(session.report)
        addEntry('anthropic/claude-opus-4-8', inTokens, outTokens)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 處理「智慧對話 (Chat)」使用量 (usage_daily & messages)
  // ─────────────────────────────────────────────────────────────────────────────
  if (filterService === 'all' || filterService === 'chat') {
    let dailyQuery = supabase!
      .from('usage_daily')
      .select('date, model_id, total_cost_usd, message_count, input_tokens, output_tokens')
      .order('date', { ascending: true })

    if (startDateStr) {
      dailyQuery = dailyQuery.gte('date', startDateStr)
    }

    const { data: dailyRows } = await dailyQuery

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
      const finalCostUsd = costs.isFree ? 0 : (dbCost > 0 ? dbCost : costs.actualCostUsd)
      const finalCostTwd = finalCostUsd * 32.0

      totalChatTokens += (inTokens + outTokens)
      totalChatCostUsd += finalCostUsd
      totalChatRequests += reqCount

      const entry = modelMap.get(key) ?? {
        model_id: cleanId,
        display_name: getModelDisplayName(rawModel, channel),
        source_channel: channel,
        channel_label: CHANNEL_CONFIG[channel]?.label ?? channel,
        service_module: 'chat',
        is_free: CHANNEL_CONFIG[channel]?.isFree ?? false,
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

      if (channelTotals[channel]) {
        channelTotals[channel].requests += reqCount
        channelTotals[channel].input_tokens += inTokens
        channelTotals[channel].output_tokens += outTokens
        channelTotals[channel].total_tokens += (inTokens + outTokens)
        channelTotals[channel].cost_usd += finalCostUsd
        channelTotals[channel].cost_twd += finalCostTwd
        channelTotals[channel].saved_usd += costs.savedCostUsd
        channelTotals[channel].saved_twd += costs.savedCostTwd
      }

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
  }

  // Prepopulate standard proxy models so the matrix displays them with $0.00 even if not yet triggered
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
        channel_label: CHANNEL_CONFIG[item.channel]?.label ?? item.channel,
        service_module: 'all',
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

  // Convert to array and filter
  let allModels = Array.from(modelMap.values())

  if (filterChannel !== 'all') {
    allModels = allModels.filter(m => m.source_channel === filterChannel)
  }

  allModels.sort((a, b) => {
    if (a.requests > 0 && b.requests === 0) return -1
    if (a.requests === 0 && b.requests > 0) return 1
    if (b.cost_usd !== a.cost_usd) return b.cost_usd - a.cost_usd
    return b.total_tokens - a.total_tokens
  })

  // Global totals
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

  const byModelAndSource = allModels.map(m => ({
    ...m,
    cost_share_pct: totalCostUsd > 0 ? Number(((m.cost_usd / totalCostUsd) * 100).toFixed(1)) : 0,
    token_share_pct: totalTokens > 0 ? Number(((m.total_tokens / totalTokens) * 100).toFixed(1)) : 0,
  }))

  const dailyTrend = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    summary: {
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      totalCostTwd: Number(totalCostTwd.toFixed(2)),
      totalSavedUsd: Number(totalSavedUsd.toFixed(4)),
      totalSavedTwd: Number(totalSavedTwd.toFixed(2)),
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalRequests,
      freeRequests,
      freeRatio,
      roundtableTokens: totalRoundtableTokens,
      roundtableCostUsd: Number(totalRoundtableCostUsd.toFixed(4)),
      roundtableRequests: totalRoundtableRequests,
      chatTokens: totalChatTokens,
      chatCostUsd: Number(totalChatCostUsd.toFixed(4)),
      chatRequests: totalChatRequests,
    },
    channels: channelTotals,
    byModelAndSource,
    dailyTrend,
  })
}
