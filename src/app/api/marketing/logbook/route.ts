// 行銷中心「行銷日誌」：整合公司全體員工與 AI 對談、行銷活動/社群排程/文案/實體/外送等所有事件，
// 以及人工日誌紀錄與 AI 自動分析彙整報告。
import { NextRequest, NextResponse } from 'next/server'
import { getSkill } from '@/lib/skills/registry'
import { marketingCompany } from '@/lib/marketing/company'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

type Admin = ReturnType<typeof createAdminClient>

export const maxDuration = 60

const label = (id: string) => getSkill(id)?.label ?? id
const inputSummary = (input: unknown): string => {
  if (!input || typeof input !== 'object') return ''
  const o = input as Record<string, unknown>
  const first = o.topic ?? o.product ?? o.productName ?? o.persona ?? o.niche ?? o.title ?? Object.values(o)[0]
  return String(first ?? '').slice(0, 80)
}

// 取公司成員名稱對照
async function staffNames(admin: Admin, memberIds: string[]): Promise<Record<string, string>> {
  if (!memberIds.length) return {}
  const { data } = await admin.from('profiles').select('id, full_name, email').in('id', memberIds)
  const m: Record<string, string> = {}
  for (const r of data ?? []) {
    m[r.id as string] = String(r.full_name || r.email || '').trim() || String(r.id).slice(0, 8)
  }
  return m
}

export interface MarketingLogEntry {
  id: string
  type: 'chat' | 'event' | 'manual' | 'summary'
  category: 'ai_chat' | 'skill' | 'campaign' | 'calendar' | 'content' | 'offline' | 'delivery' | 'brand' | 'manual' | 'general'
  title: string
  summary: string
  details?: Record<string, any>
  staff: string
  userId?: string
  status?: string
  credits?: number
  created_at: string
}

// GET /api/marketing/logbook?days=30
export async function GET(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30))
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  // 1. 取得人員名稱對照
  const names = await staffNames(c.admin, c.memberIds)

  // 2. 平行讀取各來源（AI 對談、各行銷模組事件、持久化日誌）
  const [
    convsRes,
    skillsRes,
    campaignsRes,
    calendarRes,
    contentRes,
    offlineRes,
    deliveryRes,
    manualLogsRes,
  ] = await Promise.all([
    // A. 員工與 AI 對話（取全體成員近期對談）
    c.admin.from('conversations')
      .select('id, user_id, title, model_id, updated_at, created_at')
      .in('user_id', c.memberIds)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(100),
    // B. 行銷技能製作事件
    c.admin.from('skill_runs')
      .select('id, user_id, skill_id, input, status, credits_spent, created_at')
      .in('user_id', c.memberIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200),
    // C. 行銷活動建立與變更
    c.admin.from('marketing_campaigns')
      .select('id, user_id, title, topic, status, created_at, updated_at')
      .in('user_id', c.memberIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    // D. 社群排程事件
    c.admin.from('mkt_calendar')
      .select('id, owner_id, title, channel, scheduled_date, status, created_at')
      .eq('owner_id', c.ownerId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    // E. 行銷文案草稿/送審
    c.admin.from('mkt_content')
      .select('id, owner_id, title, channel, status, created_at')
      .eq('owner_id', c.ownerId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    // F. 實體行銷活動
    c.admin.from('mkt_offline')
      .select('id, owner_id, title, store, budget, status, created_at')
      .eq('owner_id', c.ownerId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    // G. 外送平台設定
    c.admin.from('mkt_delivery')
      .select('id, owner_id, platform, status, monthly_orders, created_at')
      .eq('owner_id', c.ownerId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50),
    // H. 既有日誌表記錄（含手動與 AI 報告，容錯若尚未 migrate）
    c.admin.from('mkt_logs')
      .select('id, owner_id, user_id, user_name, type, category, title, summary, details, credits, created_at')
      .eq('owner_id', c.ownerId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // 取對話最後一則訊息作為摘要
  const convList = convsRes.data ?? []
  const convIds = convList.map(v => v.id)
  const msgsSnippet: Record<string, string> = {}
  if (convIds.length > 0) {
    const { data: msgRows } = await c.admin.from('messages')
      .select('conversation_id, role, content, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(300)
    for (const m of msgRows ?? []) {
      const cid = m.conversation_id as string
      if (!msgsSnippet[cid] && m.content) {
        const prefix = m.role === 'user' ? '提問：' : 'AI 回覆：'
        msgsSnippet[cid] = prefix + m.content.slice(0, 100)
      }
    }
  }

  const items: MarketingLogEntry[] = []

  // 1. 員工與 AI 對話
  for (const v of convList) {
    items.push({
      id: 'chat_' + v.id,
      type: 'chat',
      category: 'ai_chat',
      title: v.title && v.title !== 'New Chat' ? v.title : 'AI 靈感討論',
      summary: msgsSnippet[v.id] || '員工與 AI 進行行銷與日常諮詢對話',
      details: { model: v.model_id, conv_id: v.id },
      staff: names[v.user_id as string] ?? '同仁',
      userId: v.user_id as string,
      status: 'completed',
      credits: 0,
      created_at: v.updated_at || v.created_at,
    })
  }

  // 2. 行銷製作技能
  for (const s of skillsRes.data ?? []) {
    items.push({
      id: 'skill_' + s.id,
      type: 'event',
      category: 'skill',
      title: label(s.skill_id as string),
      summary: inputSummary(s.input) || '執行行銷 AI 技能生成',
      details: { skill_id: s.skill_id, input: s.input },
      staff: names[s.user_id as string] ?? '同仁',
      userId: s.user_id as string,
      status: s.status,
      credits: Number(s.credits_spent) || 0,
      created_at: s.created_at,
    })
  }

  // 3. 行銷活動事件
  for (const camp of campaignsRes.data ?? []) {
    items.push({
      id: 'camp_' + camp.id,
      type: 'event',
      category: 'campaign',
      title: `行銷活動：${camp.title || '未命名活動'}`,
      summary: camp.topic ? `主題：${camp.topic}（狀態：${camp.status}）` : `活動狀態已更新為 ${camp.status}`,
      details: { campaign_id: camp.id, status: camp.status },
      staff: names[camp.user_id as string] ?? '行銷團隊',
      userId: camp.user_id as string,
      status: camp.status,
      created_at: camp.updated_at || camp.created_at,
    })
  }

  // 4. 社群行事曆排程事件
  for (const cal of calendarRes.data ?? []) {
    items.push({
      id: 'cal_' + cal.id,
      type: 'event',
      category: 'calendar',
      title: `社群排程：${cal.title}`,
      summary: `平台：${cal.channel.toUpperCase()} / 狀態：${cal.status}${cal.scheduled_date ? ` / 排程日期：${cal.scheduled_date}` : ''}`,
      details: { channel: cal.channel, scheduled_date: cal.scheduled_date, status: cal.status },
      staff: '社群排程',
      status: cal.status,
      created_at: cal.created_at,
    })
  }

  // 5. 文案草稿與送審
  for (const cnt of contentRes.data ?? []) {
    items.push({
      id: 'cnt_' + cnt.id,
      type: 'event',
      category: 'content',
      title: `文案草稿：${cnt.title}`,
      summary: `發布通路：${cnt.channel} / 審核進度：${cnt.status}`,
      details: { channel: cnt.channel, status: cnt.status },
      staff: '文案編輯',
      status: cnt.status,
      created_at: cnt.created_at,
    })
  }

  // 6. 門市實體物料活動
  for (const off of offlineRes.data ?? []) {
    items.push({
      id: 'off_' + off.id,
      type: 'event',
      category: 'offline',
      title: `實體行銷：${off.title}`,
      summary: `${off.store ? `門市：${off.store} | ` : ''}預算：NT$ ${off.budget ?? 0} | 狀態：${off.status}`,
      details: { store: off.store, budget: off.budget, status: off.status },
      staff: '實體推廣',
      status: off.status,
      created_at: off.created_at,
    })
  }

  // 7. 外送平台事件
  for (const dlv of deliveryRes.data ?? []) {
    items.push({
      id: 'dlv_' + dlv.id,
      type: 'event',
      category: 'delivery',
      title: `外送平台：${dlv.platform}`,
      summary: `月訂單量：${dlv.monthly_orders ?? 0} | 營運狀態：${dlv.status}`,
      details: { platform: dlv.platform, status: dlv.status },
      staff: '外送營運',
      status: dlv.status,
      created_at: dlv.created_at,
    })
  }

  // 8. 手動日誌與 AI 彙整報告（mkt_logs）
  for (const log of manualLogsRes.data ?? []) {
    items.push({
      id: log.id,
      type: log.type as any,
      category: log.category as any,
      title: log.title,
      summary: log.summary,
      details: log.details,
      staff: log.user_name || '同仁',
      userId: log.user_id,
      status: 'recorded',
      credits: Number(log.credits) || 0,
      created_at: log.created_at,
    })
  }

  // 依照時間倒序排列
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // 統計彙整
  let credits = 0
  let chatCount = 0
  let eventCount = 0
  let manualCount = 0
  const byStaff: Record<string, { name: string; count: number; chats: number; events: number; credits: number }> = {}
  const byCategory: Record<string, number> = {}

  for (const it of items) {
    const cSpent = it.credits || 0
    credits += cSpent
    if (it.type === 'chat') chatCount++
    else if (it.type === 'event') eventCount++
    else if (it.type === 'manual' || it.type === 'summary') manualCount++

    byCategory[it.category] = (byCategory[it.category] || 0) + 1

    const p = (byStaff[it.staff] ??= { name: it.staff, count: 0, chats: 0, events: 0, credits: 0 })
    p.count++
    p.credits += cSpent
    if (it.type === 'chat') p.chats++
    else p.events++
  }

  return NextResponse.json({
    items,
    total: items.length,
    chatCount,
    eventCount,
    manualCount,
    credits,
    days,
    byStaff: Object.values(byStaff).sort((a, b) => b.count - a.count),
    byCategory,
  })
}

// POST /api/marketing/logbook
// 1. 建立手動日誌: { action: 'create_manual', title, summary, category? }
// 2. 產生 AI 營運日誌總結: { action: 'generate_report', days? }
export async function POST(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const action = b.action || (b.title && !b.generate ? 'create_manual' : 'generate_report')

  const names = await staffNames(c.admin, c.memberIds)
  const currentUserName = names[c.userId] || '行銷同仁'

  // ── A. 建立手動日誌 ──────────────────────────────
  if (action === 'create_manual') {
    const title = String(b.title ?? '').trim()
    const summary = String(b.summary ?? b.content ?? '').trim()
    if (!title && !summary) {
      return NextResponse.json({ error: '標題或內容必填' }, { status: 400 })
    }
    const category = String(b.category ?? 'manual')
    const now = new Date().toISOString()

    const { data, error } = await c.admin.from('mkt_logs').insert({
      owner_id: c.ownerId,
      user_id: c.userId,
      user_name: currentUserName,
      type: 'manual',
      category,
      title: title || '日常工作日誌',
      summary,
      details: b.details || {},
      created_at: now,
      updated_at: now,
    }).select().maybeSingle()

    if (error) {
      // 容錯若 mkt_logs 尚未在資料庫建立
      return NextResponse.json({
        ok: true,
        item: {
          id: 'temp_' + Date.now(),
          type: 'manual',
          category,
          title: title || '日常工作日誌',
          summary,
          staff: currentUserName,
          created_at: now,
        },
        notice: '日誌已記錄',
      })
    }
    return NextResponse.json({ ok: true, item: data })
  }

  // ── B. AI 產生全方位行銷營運與 AI 協作報告 ─────────
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ error: 'AI 金鑰未設定' }, { status: 400 })
  }

  const days = Math.min(365, Math.max(1, Number(b.days) || 30))
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  // 蒐集對談與事件
  const [convsRes, skillsRes, campaignsRes, calRes, offRes] = await Promise.all([
    c.admin.from('conversations')
      .select('id, user_id, title, updated_at')
      .in('user_id', c.memberIds)
      .gte('updated_at', since)
      .limit(60),
    c.admin.from('skill_runs')
      .select('user_id, skill_id, input, status, credits_spent')
      .in('user_id', c.memberIds)
      .gte('created_at', since)
      .limit(200),
    c.admin.from('marketing_campaigns')
      .select('title, topic, status')
      .in('user_id', c.memberIds)
      .gte('created_at', since)
      .limit(30),
    c.admin.from('mkt_calendar')
      .select('title, channel, status')
      .eq('owner_id', c.ownerId)
      .gte('created_at', since)
      .limit(30),
    c.admin.from('mkt_offline')
      .select('title, store, budget, status')
      .eq('owner_id', c.ownerId)
      .gte('created_at', since)
      .limit(30),
  ])

  const chatFacts = (convsRes.data ?? []).map(v =>
    `- 同仁【${names[v.user_id as string] || '同仁'}】與 AI 討論：${v.title}`
  ).slice(0, 30).join('\n')

  const skillFacts = (skillsRes.data ?? []).map(s =>
    `- 同仁【${names[s.user_id as string] || '同仁'}】執行技能【${label(s.skill_id as string)}】：${inputSummary(s.input)}`
  ).slice(0, 40).join('\n')

  const campaignFacts = (campaignsRes.data ?? []).map(c =>
    `- 行銷活動【${c.title}】（主題：${c.topic || '無'}，狀態：${c.status}）`
  ).join('\n')

  const calFacts = (calRes.data ?? []).map(c =>
    `- 社群排程【${c.title}】（通路：${c.channel}，狀態：${c.status}）`
  ).join('\n')

  const offFacts = (offRes.data ?? []).map(o =>
    `- 實體促銷【${o.title}】（門市：${o.store || '全店'}，預算：${o.budget}）`
  ).join('\n')

  const totalEvents = (convsRes.data?.length ?? 0) + (skillsRes.data?.length ?? 0) +
    (campaignsRes.data?.length ?? 0) + (calRes.data?.length ?? 0) + (offRes.data?.length ?? 0)

  if (totalEvents === 0) {
    return NextResponse.json({ report: `近 ${days} 天內行銷部門尚無同仁 AI 對談或行銷事件紀錄。` })
  }

  const system = `你是連鎖餐飲品牌的資深行銷總監。請根據公司行銷部門全體同仁近期與 AI 對談的內容、各項行銷活動事件、社群排程及技能產出，撰寫一份條理清晰、務實精煉的「行銷營運與 AI 協作日誌總結報告」。
請包含以下結構（繁體中文）：
一、本期整體推進與核心成果
二、員工與 AI 協作重點分析（同仁主要向 AI 請教與探索了哪些方向，形成哪些具體產出）
三、活動與排程執行進度（活動專案、社群貼文、實體物料推進）
四、團隊活躍度與行銷資源運用
五、下一階段行動建議（提出 2~3 項關鍵執行重點）
語氣專業俐落，約 400~600 字，依據所給數據真實總結，不編造虛假數據。`

  const userPrompt = `【時間區間】：近 ${days} 天
【員工與 AI 對談紀錄】：
${chatFacts || '（無 AI 對談紀錄）'}

【行銷技能製作事件】：
${skillFacts || '（無技能製作紀錄）'}

【活動與排程事件】：
${campaignFacts || '（無活動紀錄）'}
${calFacts || '（無排程紀錄）'}
${offFacts || '（無實體活動紀錄）'}`

  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      system,
      maxOutputTokens: 1500,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const reportText = res.text.trim()

    // 將產出的 AI 報告寫入 mkt_logs 歸檔
    try {
      const now = new Date().toISOString()
      await c.admin.from('mkt_logs').insert({
        owner_id: c.ownerId,
        user_id: c.userId,
        user_name: 'AI 行銷總監',
        type: 'summary',
        category: 'general',
        title: `近 ${days} 天行銷營運與 AI 協作日誌報告`,
        summary: reportText,
        created_at: now,
        updated_at: now,
      })
    } catch {
      // ignore
    }

    return NextResponse.json({ report: reportText, total: totalEvents })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE /api/marketing/logbook (刪除指定手動或總結日誌)
export async function DELETE(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await c.admin.from('mkt_logs').delete().eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
