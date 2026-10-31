/**
 * GET /api/marketing/cs-thread
 *  - 無 to 參數：回傳對話清單（依最後聯絡時間排序）+ 各對話是否真人接管中
 *  - 帶 to + platform：回傳該客戶的完整對話氣泡串 + 是否接管中
 *
 * 對話氣泡來源 = cs_messages（每列含客戶訊息 message 與回覆 reply，
 * reply 由 intent 區分 'agent'（真人）或 AI）。
 */
import { loadChannelCredentials } from '@/lib/channels/resolve'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'
import { isHandoffActive, getHumanIdleMinutes } from '@/lib/cs/handoff'

interface Bubble {
  side: 'in' | 'out'
  sender: 'customer' | 'ai' | 'agent'
  text: string
  at: string
  image?: string
}

const THREAD_PAGE = 50
const AROUND_BEFORE = 50
const AROUND_AFTER = 50
const CUSTOMER_COLS = 'platform, from_id, name, stage, message_count, last_message_at, facts'
interface CustomerRow {
  platform: string
  from_id: string
  name: string | null
  stage: string | null
  message_count: number | null
  last_message_at: string | null
  facts: unknown
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase, 'cs')
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const industry = sp.get('industry') ?? 'homestay'
  const to = sp.get('to')
  const platform = sp.get('platform')

  // 目前真人接管中的客戶——與 cs-webhook 的 hasOpenHandoff 用同一套規則（src/lib/cs/handoff.ts），
  // 不然會顯示已接管、實際上 AI 早就在回了，員工誤以為有人在處理。
  const staleCutoff = new Date(Date.now() - 2 * 3600_000).toISOString()
  const [{ data: openTickets }, idleMinutes] = await Promise.all([
    supabase
      .from('cs_tickets').select('from_id, subject, created_at')
      .eq('user_id', ctx.ownerId).eq('intent', '人工客服請求')
      .in('status', ['open', 'in_progress'])
      .gte('created_at', staleCutoff),
    getHumanIdleMinutes(supabase, ctx.ownerId),
  ])
  const takeoverSet = new Set((openTickets ?? [])
    .filter(t => isHandoffActive(t as { subject: string | null; created_at: string }, idleMinutes))
    .map(t => t.from_id))

  // ── 單一對話 thread ────────────────────────────────────────────────────────
  if (to && platform) {
    // 預設載入最新 50 則（每次開啟或送出都會重載，筆數影響 Supabase 流量）；before＝往前載入更早的訊息；around＝從搜尋結果開啟，載入該則訊息前後
    const before = sp.get('before')
    const around = sp.get('around')
    const base = () => supabase
      .from('cs_messages')
      .select('*')
      .eq('user_id', ctx.ownerId)
      .eq('platform', platform)
      .eq('from_id', to)
    let rows: { message: string | null; reply: string | null; intent: string | null; created_at: string; image_path?: string | null }[] = []
    let hasOlder = false
    let hasNewer = false
    if (around) {
      const [older, newer] = await Promise.all([
        base().lt('created_at', around).order('created_at', { ascending: false }).limit(AROUND_BEFORE + 1),
        base().gte('created_at', around).order('created_at', { ascending: true }).limit(AROUND_AFTER + 1),
      ])
      const err = older.error ?? newer.error
      if (err) return NextResponse.json({ error: err.message }, { status: 500 })
      hasOlder = (older.data ?? []).length > AROUND_BEFORE
      hasNewer = (newer.data ?? []).length > AROUND_AFTER
      rows = [...(older.data ?? []).slice(0, AROUND_BEFORE).reverse(), ...(newer.data ?? []).slice(0, AROUND_AFTER)]
    } else {
      let rq = base()
      if (before) rq = rq.lt('created_at', before)
      const { data, error } = await rq.order('created_at', { ascending: false }).limit(THREAD_PAGE + 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      hasOlder = (data ?? []).length > THREAD_PAGE
      rows = (data ?? []).slice(0, THREAD_PAGE).reverse()
    }

    // 客人傳的圖片（私有 bucket）→ 換成 1 小時有效的簽名網址
    const imagePaths = rows.map(r => r.image_path).filter((p): p is string => !!p)
    const signed = new Map<string, string>()
    if (imagePaths.length) {
      const { data: urls } = await createAdminClient().storage.from('cs-media').createSignedUrls(imagePaths, 3600)
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl)
    }

    const bubbles: Bubble[] = []
    for (const r of rows ?? []) {
      if (r.image_path) {
        const fromAgent = r.intent === 'agent'
        bubbles.push({
          side: fromAgent ? 'out' : 'in', sender: fromAgent ? 'agent' : 'customer',
          text: signed.has(r.image_path) ? '' : '【圖片】', image: signed.get(r.image_path), at: r.created_at,
        })
        continue
      }
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
    const { data: custRow } = await supabase
      .from('cs_customers')
      .select('summary')
      .eq('user_id', ctx.ownerId).eq('platform', platform).eq('from_id', to).eq('industry', industry)
      .maybeSingle()

    return NextResponse.json({ bubbles, hasOlder, hasNewer, takeover: takeoverSet.has(to), summary: custRow?.summary ?? null })
  }

  // ── 對話清單 ────────────────────────────────────────────────────────────────
  const limit = Math.min(parseInt(sp.get('limit') ?? '500'), 1000)
  let q = supabase
    .from('cs_customers')
    .select(CUSTOMER_COLS)
    .eq('user_id', ctx.ownerId)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  if (industry) q = q.eq('industry', industry)
  if (platform && platform !== 'all') q = q.eq('platform', platform)

  // 搜尋：客戶名稱／ID，或過往對話內容（客人訊息、AI 與真人回覆）
  const search = (sp.get('q') ?? '').trim().slice(0, 100)
  const matchMap = new Map<string, string>()
  const matchAtMap = new Map<string, string>()
  let customers: CustomerRow[] | null
  if (search) {
    const pat = `%${search.replace(/[\\%_]/g, m => '\\' + m)}%`
    const custBase = () => {
      let cq = supabase.from('cs_customers').select(CUSTOMER_COLS).eq('user_id', ctx.ownerId)
      if (industry) cq = cq.eq('industry', industry)
      if (platform && platform !== 'all') cq = cq.eq('platform', platform)
      return cq
    }
    const msgBase = () => supabase.from('cs_messages')
      .select('platform, from_id, message, reply, created_at')
      .eq('user_id', ctx.ownerId)
      .order('created_at', { ascending: false }).limit(500)
    const [byName, byId, byMsg, byReply] = await Promise.all([
      custBase().ilike('name', pat).limit(200),
      custBase().ilike('from_id', pat).limit(200),
      msgBase().ilike('message', pat),
      msgBase().ilike('reply', pat),
    ])
    const err = byName.error ?? byId.error ?? byMsg.error ?? byReply.error
    if (err) return NextResponse.json({ error: err.message }, { status: 500 })

    const lower = search.toLowerCase()
    const snippet = (text: string) => {
      const i = text.toLowerCase().indexOf(lower)
      if (i < 0) return text.slice(0, 60)
      const start = Math.max(0, i - 20)
      const end = Math.min(text.length, i + search.length + 40)
      return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`
    }
    const latest = new Map<string, { at: string; text: string }>()
    for (const r of [...(byMsg.data ?? []), ...(byReply.data ?? [])]) {
      const key = `${r.platform}:${r.from_id}`
      const text = [r.message, r.reply].find(t => t && String(t).toLowerCase().includes(lower)) as string | undefined
      if (!text) continue
      const prev = latest.get(key)
      if (!prev || r.created_at > prev.at) latest.set(key, { at: r.created_at, text })
    }
    for (const [key, v] of latest) { matchMap.set(key, snippet(v.text)); matchAtMap.set(key, v.at) }

    const rows = new Map<string, CustomerRow>()
    for (const c of [...(byName.data ?? []), ...(byId.data ?? [])] as CustomerRow[]) rows.set(`${c.platform}:${c.from_id}`, c)
    const msgIds = [...new Set([...latest.keys()].filter(k => !rows.has(k)).map(k => k.slice(k.indexOf(':') + 1)))].slice(0, 200)
    if (msgIds.length) {
      const { data: more, error: moreErr } = await custBase().in('from_id', msgIds)
      if (moreErr) return NextResponse.json({ error: moreErr.message }, { status: 500 })
      for (const c of (more ?? []) as CustomerRow[]) {
        const key = `${c.platform}:${c.from_id}`
        if (latest.has(key)) rows.set(key, c)
      }
    }
    customers = [...rows.values()].sort((a, b) => String(b.last_message_at ?? '').localeCompare(String(a.last_message_at ?? '')))
  } else {
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    customers = data as CustomerRow[] | null
  }

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
        const cred = await loadChannelCredentials(ctx.ownerId, 'line', 'cs')
        const token = cred.line_channel_access_token || cred.channel_access_token
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
        c.name = nameMap.get(c.from_id) ?? null
        updates.push({ from_id: c.from_id, name: c.name ?? "" })
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
    match: matchMap.get(`${c.platform}:${c.from_id}`) ?? null,
    matchAt: matchAtMap.get(`${c.platform}:${c.from_id}`) ?? null,
  }))

  return NextResponse.json({ conversations, convos: conversations })
}
