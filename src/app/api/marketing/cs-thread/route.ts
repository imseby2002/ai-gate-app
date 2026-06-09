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

  // 目前真人接管中的客戶（open 人工客服工單）
  const { data: openTickets } = await supabase
    .from('cs_tickets').select('from_id')
    .eq('user_id', ctx.ownerId).eq('intent', '人工客服請求')
    .in('status', ['open', 'in_progress'])
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
  let q = supabase
    .from('cs_customers')
    .select('platform, from_id, name, stage, message_count, last_message_at')
    .eq('user_id', ctx.ownerId)
    .order('last_message_at', { ascending: false })
    .limit(200)
  if (industry) q = q.eq('industry', industry)

  const { data: customers, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const conversations = (customers ?? []).map(c => ({
    platform: c.platform,
    from_id: c.from_id,
    name: c.name,
    stage: c.stage,
    messageCount: c.message_count,
    lastMessageAt: c.last_message_at,
    takeover: takeoverSet.has(c.from_id),
  }))

  return NextResponse.json({ conversations })
}
