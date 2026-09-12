/**
 * GET /api/marketing/cs-thread
 *  - 無 to 參數：回傳對話清單（依最後聯絡時間排序）+ 各對話是否真人接管中
 *  - 帶 to + platform：回傳該客戶的完整對話氣泡串 + 是否接管中
 *
 * 對話氣泡來源 = cs_messages（每列含客戶訊息 message 與回覆 reply，
 * reply 由 intent 區分 'agent'（真人）或 AI）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

interface Bubble {
  side: 'in' | 'out'
  sender: 'customer' | 'ai' | 'agent'
  text: string
  at: string
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const industry = sp.get('industry') ?? 'homestay'
  const to = sp.get('to')
  const platform = sp.get('platform')

  // 目前真人接管中的客戶（open 人工客服工單）——超過 2 小時沒處理的工單，
  // AI 那邊（cs-webhook 的 hasOpenHandoff）已經會自動恢復回覆，這裡的「接管中」
  // 標示要跟著同步，不然會顯示已接管、實際上 AI 早就在回了，員工誤以為有人在處理。
  const HANDOFF_STALE_HOURS = 2
  const staleCutoff = new Date(Date.now() - HANDOFF_STALE_HOURS * 3600_000).toISOString()
  const { data: openTickets } = await supabase
    .from('cs_tickets').select('from_id')
    .eq('user_id', ctx.ownerId).eq('intent', '人工客服請求')
    .in('status', ['open', 'in_progress'])
    .gte('created_at', staleCutoff)
  const takeoverSet = new Set((openTickets ?? []).map(t => t.from_id))

  // ── 單一對話 thread ────────────────────────────────────────────────────────
  if (to && platform) {
    const { data: rows, error } = await supabase
      .from('cs_messages')
      .select('message, reply, intent, created_at')
      .eq('user_id', ctx.ownerId)
      .eq('platform', platform)
      .eq('from_id', to)
      .order('created_at', { ascending: true })
      .limit(300)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bubbles: Bubble[] = []
    for (const r of rows ?? []) {
      if (r.message && String(r.message).trim()) {
        bubbles.push({ side: 'in', sender: 'customer', text: r.message, at: r.created_at })
      }
      if (r.reply && String(r.reply).trim()) {
        bubbles.push({
          side: 'out',
          sender: r.intent === 'agent' ? 'agent' : 'ai',
          text: r.reply,
          at: r.created_at,
        })
      }
    }
    return NextResponse.json({ bubbles, takeover: takeoverSet.has(to) })
  }

  // ── 對話清單 ────────────────────────────────────────────────────────────────
  const limit = Math.min(parseInt(sp.get('limit') ?? '500'), 1000)
  let q = supabase
    .from('cs_customers')
    .select('platform, from_id, name, stage, message_count, last_message_at, facts')
    .eq('user_id', ctx.ownerId)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  if (industry) q = q.eq('industry', industry)
  if (platform && platform !== 'all') q = q.eq('platform', platform)

  const { data: customers, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 自動解析缺漏的客戶名稱（從歷史訊息、訂房確認姓名或 LINE Profile API）並非同步回填
  const missingList = (customers ?? []).filter(c => !c.name?.trim())
  if (missingList.length > 0) {
    const missingIds = missingList.map(c => c.from_id)
    const nameMap = new Map<string, string>()

    try {
      const { data: msgRows } = await supabase
        .from('cs_messages')
        .select('from_id, from_name')
        .eq('user_id', ctx.ownerId)
        .in('from_id', missingIds)
        .not('from_name', 'is', null)
        .order('created_at', { ascending: false })

      for (const m of msgRows ?? []) {
        if (m.from_name && !nameMap.has(m.from_id)) {
          nameMap.set(m.from_id, m.from_name)
        }
      }
    } catch { /* ignore */ }

    for (const c of missingList) {
      if (!nameMap.has(c.from_id)) {
        const facts = c.facts as Record<string, string> | null
        if (facts?.confirmedName && typeof facts.confirmedName === 'string') {
          nameMap.set(c.from_id, facts.confirmedName.trim())
        }
      }
    }

    const stillMissingLine = missingList.filter(c => (c.platform === 'line' || c.platform === 'line-oa') && !nameMap.has(c.from_id))
    if (stillMissingLine.length > 0) {
      try {
        const { data: cred } = await supabase
          .from('social_platform_credentials')
          .select('credentials')
          .eq('user_id', ctx.ownerId)
          .eq('platform', 'line')
          .maybeSingle()
        const token = cred?.credentials?.line_channel_access_token || cred?.credentials?.channel_access_token
        if (token) {
          const toFetch = stillMissingLine.slice(0, 15)
          await Promise.allSettled(toFetch.map(async (c) => {
            try {
              const res = await fetch(`https://api.line.me/v2/bot/profile/${c.from_id}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(3000),
              })
              if (res.ok) {
                const d = await res.json()
                if (d.displayName) nameMap.set(c.from_id, d.displayName)
              }
            } catch { /* ignore */ }
          }))
        }
      } catch { /* ignore */ }
    }

    const updates: Array<{ from_id: string; name: string }> = []
    for (const c of customers ?? []) {
      if (!c.name && nameMap.has(c.from_id)) {
        c.name = nameMap.get(c.from_id)
        updates.push({ from_id: c.from_id, name: c.name })
      }
    }

    if (updates.length > 0) {
      void Promise.allSettled(
        updates.map(u => supabase
          .from('cs_customers')
          .update({ name: u.name, updated_at: new Date().toISOString() })
          .eq('user_id', ctx.ownerId)
          .eq('from_id', u.from_id)
        )
      )
    }
  }

  const conversations = (customers ?? []).map(c => ({
    platform: c.platform,
    from_id: c.from_id,
    name: c.name,
    stage: c.stage,
    messageCount: c.message_count,
    lastMessageAt: c.last_message_at,
    takeover: takeoverSet.has(c.from_id),
  }))

  return NextResponse.json({ conversations, convos: conversations })
}
