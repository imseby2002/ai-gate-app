/**
 * POST /api/marketing/cs-webhook/[platform]/[userId]
 * 用戶專屬客服 Webhook 接收端點（從 Supabase 讀取 API 憑證）
 *
 * 使用 service role key 繞過 RLS，因為 webhook 來自外部平台（無用戶 session）
 * AI 直接在此呼叫，不轉發至 cs-chat（cs-chat 需要 session auth）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { buildDeterministicQuote } from '@/lib/cs/quote'
import { buildBookingModuleQuote } from '@/lib/cs/booking-quote'

// ── Supabase service role client ───────────────────────────────────────────────
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── 業務顧問 / 客戶認識 / 問價次數 ────────────────────────────────────────────────
const PRICE_RE = /價格|價錢|價位|多少錢|費用|報價|怎麼算|多少|預算|划算|便宜|折扣|優惠|price|cost|how much|rate|quote|budget|discount/i

type CsCustomerRow = {
  name: string | null
  summary: string | null
  stage: string | null
  price_ask_count: number
  message_count: number
}

// 建立「銷售冠軍」業務指引（含第一次／第二次問價的不同處理、認得回頭客）
function buildSellSection(cust: CsCustomerRow | null, convoPriceAsks: number, isPriceAskNow: boolean): string {
  const lines = [
    '\n\n【業務顧問模式——像銷售冠軍一樣對話】',
    '你不只是客服，更是頂尖業務顧問：先同理 → 用提問釐清真正需求 → 把產品特點翻成「對這位客戶的好處」→ 描繪他選擇後的畫面 → 主動推進到下一步（用二選一收尾）。可運用社會證明、誠實的稀缺與互惠，但絕不施壓、不誇大、不欺騙。',
  ]
  if (cust?.name) lines.push(`客戶稱呼：${cust.name}。請自然地稱呼對方，展現你記得他。`)
  if (cust?.summary) lines.push(`這位是回頭客，先前洽詢摘要：「${cust.summary}」。請延續脈絡、不要重問已知資訊。`)
  if (isPriceAskNow) {
    if (convoPriceAsks <= 1) lines.push('【價格詢問——第 1 次】不要只丟一個數字：報價同時說明「包含什麼、為什麼值得」，並順勢回問 1 個關鍵需求（日期／人數／用途）以便推薦最適方案。')
    else if (convoPriceAsks === 2) lines.push('【價格詢問——第 2 次】這是明確的購買訊號或價格敏感。先同理預算考量，問出他真正在比較或猶豫的點，主動提供誘因（若有折扣／贈品就善用），並用二選一推進成交（例：「您想訂週五還是週六？」）。')
    else lines.push('【價格詢問——第 3 次（含）以上】客戶可能卡在價格。給出你能提供的最佳方案或小讓步並請求承諾；若仍猶豫，提議由專員親自跟進，不要無限重複報價。')
  }
  return lines.join('\n')
}

// ── Load credentials from DB ──────────────────────────────────────────────────
async function loadCredentials(userId: string, platform: string): Promise<Record<string, string>> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('social_platform_credentials')
    .select('credentials')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single()
  return (data?.credentials as Record<string, string>) ?? {}
}

// ── Conversation history ───────────────────────────────────────────────────────
type HistoryMsg = { role: 'user' | 'assistant'; content: string }

async function loadHistory(userId: string, customerId: string): Promise<HistoryMsg[]> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('cs_conversations')
    .select('history')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .single()
  return (data?.history as HistoryMsg[]) ?? []
}

async function saveHistory(userId: string, customerId: string, history: HistoryMsg[]) {
  const supabase = getServiceClient()
  await supabase
    .from('cs_conversations')
    .upsert(
      { user_id: userId, customer_id: customerId, history: history.slice(-20), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,customer_id' }
    )
}

// ── Persist a customer turn to cs_messages (powers the dashboard metrics) ─────
async function logCsMessage(userId: string, platform: string, customerId: string, industry: string, message: string, reply: string) {
  try {
    await getServiceClient().from('cs_messages').insert({
      user_id: userId, industry, platform, from_id: customerId, message, reply,
    })
  } catch { /* metrics logging must never break the reply flow */ }
}

// Atomic fixed-window rate check via the DB. Fails open so an un-applied migration
// (or a transient DB error) never silences the bot.
async function checkRateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const { data, error } = await getServiceClient().rpc('check_cs_rate_limit', {
      p_bucket: bucket, p_limit: limit, p_window_seconds: windowSec,
    })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}

// Customer asking to talk to a real person
const HUMAN_ESCALATION_RE = /人工客服|真人客服|轉人工|轉真人|要真人|找真人|真人幫|人工幫|真人接|人工接|找客服|要客服|人工服務|真人服務|專人/

// Is there an unresolved human-handoff ticket for this customer? (→ stop auto-replying)
async function hasOpenHandoff(userId: string, customerId: string): Promise<boolean> {
  try {
    const { data } = await getServiceClient()
      .from('cs_tickets')
      .select('id')
      .eq('user_id', userId)
      .eq('from_id', customerId)
      .eq('intent', '人工客服請求')
      .in('status', ['open', 'in_progress'])
      .limit(1)
    return !!data?.length
  } catch {
    return false  // fail open — never let a check error mute the bot for everyone
  }
}

// Build the next history array; only record the assistant turn when the bot actually replied
function withTurn(history: HistoryMsg[], text: string, reply: string): HistoryMsg[] {
  const h: HistoryMsg[] = [...history, { role: 'user', content: text }]
  if (reply) h.push({ role: 'assistant', content: reply })
  return h
}

// Single entry point for every platform: human handoff → ticket, else AI reply; logs both.
// Returns '' when the bot should stay silent (a human has taken over).
async function replyToCustomer(
  userId: string, platform: string, customerId: string,
  knowledge: CsKnowledge, history: HistoryMsg[], text: string,
  imageBuffer?: Buffer, imageMimeType?: string,
): Promise<string> {
  // Rate limit (per-customer + per-tenant) before any LLM call — caps spam / API-cost abuse
  const withinLimit = await checkRateLimit(`${userId}:${customerId}`, 30, 60)
    && await checkRateLimit(`u:${userId}`, 600, 60)
  if (!withinLimit) return ''  // over limit → drop silently

  // A human is already handling this customer → stay silent until the ticket is resolved
  if (await hasOpenHandoff(userId, customerId)) {
    void logCsMessage(userId, platform, customerId, knowledge.industry, text, '')
    return ''
  }
  if (HUMAN_ESCALATION_RE.test(text)) {
    try {
      await getServiceClient().from('cs_tickets').insert({
        user_id: userId, industry: knowledge.industry, platform, from_id: customerId,
        subject: text.slice(0, 80), description: '客人要求人工客服',
        priority: 'high', intent: '人工客服請求',
      })
    } catch { /* ignore */ }
    const reply = '好的，已為您安排專人服務，客服人員會盡快與您聯繫，請稍候 🙏'
    void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply)
    return reply
  }
  // 認識客戶 + 問價次數 → 業務指引；回覆後更新追蹤資料
  const convoPriceAsks = [...history.filter(m => m.role === 'user').map(m => m.content), text].filter(t => PRICE_RE.test(t)).length
  const isPriceAskNow = PRICE_RE.test(text)
  let cust: CsCustomerRow | null = null
  try {
    const { data } = await getServiceClient()
      .from('cs_customers')
      .select('name, summary, stage, price_ask_count, message_count')
      .eq('user_id', userId).eq('platform', platform).eq('from_id', customerId).eq('industry', knowledge.industry)
      .single()
    cust = (data as CsCustomerRow | null) ?? null
  } catch { /* 表可能尚未建立 */ }

  const reply = await getAIReply(text, knowledge, history, userId, buildSellSection(cust, convoPriceAsks, isPriceAskNow), imageBuffer, imageMimeType)
  void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply)

  try {
    let stage = cust?.stage ?? 'new'
    if (convoPriceAsks >= 2) stage = 'negotiating'
    else if (isPriceAskNow) stage = 'quoted'
    else if (stage === 'new') stage = 'inquiring'
    await getServiceClient().from('cs_customers').upsert({
      user_id: userId, platform, from_id: customerId, industry: knowledge.industry,
      name: cust?.name ?? null,
      stage,
      price_ask_count: (cust?.price_ask_count ?? 0) + (isPriceAskNow ? 1 : 0),
      message_count: (cust?.message_count ?? 0) + 1,
      summary: cust?.summary ?? null,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform,from_id,industry' })
  } catch { /* 表可能尚未建立 */ }

  return reply
}

// ── Load CS knowledge base (unit_data[12]) + company data ────────────────────
interface CsKnowledge {
  systemPrompt: string
  knowledgeBase: string
  escalationThreshold: 'medium' | 'high'
  replyLanguage: string
  bookingFlowEnabled: boolean
  paymentInfo: string
  bookingFlows: BookingFlowDef[]
  industry: string
  discountMaxPct: number
  discountGifts: string
  pricingConfigs: PricingConfig[]
}

async function loadCsKnowledge(userId: string): Promise<CsKnowledge> {
  const supabase = getServiceClient()

  // Load most recently updated campaign unit_data[12]
  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('unit_data, updated_at')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(10)

  let systemPrompt = ''
  let escalationThreshold: 'medium' | 'high' = 'high'
  let replyLanguage = 'auto'
  let bookingFlowEnabled = false
  let paymentInfo = ''
  let bookingFlows: BookingFlowDef[] = []
  let discountMaxPct = 0
  let discountGifts = ''
  const knowledgeParts: string[] = []

  // Find first campaign that has unit_data[12] with content
  if (campaigns?.length) {
    for (const camp of campaigns) {
      const unit12 = (camp.unit_data as Record<string, unknown>)?.[12] as Record<string, unknown> | undefined
      if (!unit12) continue

      if (unit12.systemPrompt) systemPrompt = String(unit12.systemPrompt)
      if (unit12.escalationThreshold) escalationThreshold = unit12.escalationThreshold as 'medium' | 'high'
      if (unit12.replyLanguage) replyLanguage = String(unit12.replyLanguage)
      if (unit12.bookingFlowEnabled) bookingFlowEnabled = Boolean(unit12.bookingFlowEnabled)
      if (unit12.paymentInfo) paymentInfo = String(unit12.paymentInfo)
      if (Array.isArray(unit12.bookingFlows)) bookingFlows = unit12.bookingFlows as BookingFlowDef[]
      if (typeof unit12.discountMaxPct === 'number') discountMaxPct = unit12.discountMaxPct
      if (unit12.discountGifts) discountGifts = String(unit12.discountGifts)

      // Direct text knowledge input
      if (unit12.knowledgeBase) knowledgeParts.push(`【直接輸入知識】\n${String(unit12.knowledgeBase)}`)

      // Dialogue files (CS-specific)
      const dialogueFiles = (unit12.dialogueFiles ?? []) as Array<{ name: string; textContent?: string }>
      for (const f of dialogueFiles) {
        if (f.textContent) {
          knowledgeParts.push(`【知識庫｜${f.name}】\n${f.textContent}`)
        }
      }

      if (systemPrompt || knowledgeParts.length > 0) break
    }
  }

  // Load pricing data from cs_data_sources
  const { data: pricingSources } = await supabase
    .from('cs_data_sources')
    .select('name, config')
    .eq('user_id', userId)
    .eq('type', 'json_pricing')
    .eq('enabled', true)

  const pricingConfigs: PricingConfig[] = []
  if (pricingSources?.length) {
    const pricingLines: string[] = []
    for (const src of pricingSources) {
      const cfg = src.config as Record<string, unknown>
      pricingConfigs.push(src.config as PricingConfig)
      pricingLines.push(`【定價資料：${src.name}】\n${JSON.stringify(cfg, null, 2)}`)
    }
    if (pricingLines.length) knowledgeParts.push(pricingLines.join('\n\n'))
  }

  // Industry (for ticket/message records) — taken from the most recent data source
  const { data: industryRow } = await supabase
    .from('cs_data_sources')
    .select('industry')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const industry = (industryRow?.industry as string) ?? 'homestay'

  // Load company data as fallback knowledge
  const { data: companyRow } = await supabase
    .from('company_data')
    .select('data')
    .eq('user_id', userId)
    .single()

  if (companyRow?.data) {
    const cd = companyRow.data as Record<string, unknown>
    // Company FAQ files
    const files = (cd.files ?? []) as Array<{ name: string; textContent?: string }>
    for (const f of files) {
      if (f.textContent) {
        knowledgeParts.push(`【公司資料｜${f.name}】\n${f.textContent}`)
      }
    }
    // Company info text
    if (cd.companyInfo) {
      knowledgeParts.push(`【公司簡介】\n${cd.companyInfo}`)
    }
  }

  return {
    systemPrompt,
    knowledgeBase: knowledgeParts.join('\n\n').slice(0, 8000),
    escalationThreshold,
    replyLanguage,
    bookingFlowEnabled,
    paymentInfo,
    bookingFlows,
    industry,
    discountMaxPct,
    discountGifts,
    pricingConfigs,
  }
}

// ── Google Sheets + JSON Pricing query ───────────────────────────────────────

interface SheetConfig {
  apiKey: string
  spreadsheetId: string
  sheetName: string
  keyColumn: string
  returnColumns: string[]
  triggerKeywords: string[]
  triggerMode?: 'keyword' | 'numeric' | 'both'
}

interface PricingConfig {
  productType: 'tour' | 'accommodation' | 'custom'
  triggerKeywords: string[]
  currency?: string
  schedules?: Array<{ id: string; name: string }>
  segments?: Array<{ label: string; key: string; weekdayPrice: number; weekendPrice: number }>
  packages?: Array<{ name: string; price: number; description?: string }>
  groupDiscounts?: Array<{ minPeople: number; discountPercent: number; note?: string }>
  rooms?: Array<{ name: string; capacity: number; weekdayPrice: number; weekendPrice: number; holidayPrice?: number; extraPersonFee?: number }>
  cancellationPolicy?: string
  notes?: string[]
  customContent?: string
}

const NUMERIC_ORDER_RE = /(?<!\+)\b[1-9]\d{7,}\b/

// Columns gated behind identity verification (prevents IDOR on door codes / room numbers)
const SENSITIVE_COL_RE = /密碼|password|passcode|\bpin\b|房號|room\s*(no|number|#)?|門鎖|門禁|鎖|鑰匙|\bkey\b|wifi|wi-?fi/i
const NAME_COL_RE = /姓名|名字|訂房人|訂位人|入住人|旅客|客戶|貴賓|聯絡人|\bname\b|guest|customer/i

interface SheetQueryOpts {
  conversationText?: string
  verifyName?: (storedName: string, conversationText: string) => Promise<boolean>
}

async function queryGoogleSheet(config: SheetConfig, message: string, opts: SheetQueryOpts = {}): Promise<string | null> {
  const triggerMode = config.triggerMode ?? 'keyword'
  let triggered = false
  let exactKey: string | null = null

  if (triggerMode === 'keyword' || triggerMode === 'both') {
    if (config.triggerKeywords.some(kw => kw.trim() && message.toLowerCase().includes(kw.trim().toLowerCase()))) {
      triggered = true
    }
  }
  if (triggerMode === 'numeric' || triggerMode === 'both') {
    const numMatch = message.match(NUMERIC_ORDER_RE)
    if (numMatch) { triggered = true; exactKey = numMatch[0] }
  }
  if (!triggered) return null

  try {
    const range = encodeURIComponent(`${config.sheetName}!A:Z`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.apiKey}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const rows: string[][] = json.values ?? []
    if (rows.length < 2) return null
    const headers = rows[0]
    const dataRows = rows.slice(1)
    const keyColIdx = headers.findIndex(h => h.trim() === (config.keyColumn ?? '').trim())

    if (exactKey && keyColIdx >= 0) {
      const matchedRow = dataRows.find(row => (row[keyColIdx] ?? '').trim() === exactKey!.trim())
      if (!matchedRow) return `【外部資料表：${config.sheetName}】\n查無符合號碼「${exactKey}」的資料，請確認是否正確。`
      const wantedCols = [config.keyColumn, ...(config.returnColumns ?? [])].filter(Boolean)
      const colIdxs = wantedCols.length > 1
        ? wantedCols.map(c => headers.findIndex(h => h.trim() === c.trim())).filter(i => i >= 0)
        : headers.map((_, i) => i)

      // ── Identity gate on sensitive columns (door code / room number) ──────
      const sensitiveIdxs = colIdxs.filter(i => SENSITIVE_COL_RE.test(headers[i] ?? ''))
      const nameIdx = headers.findIndex(h => NAME_COL_RE.test(h ?? ''))
      const storedName = nameIdx >= 0 ? (matchedRow[nameIdx] ?? '').trim() : ''
      let verified = true
      let gateNote = ''
      if (sensitiveIdxs.length > 0) {
        verified = (opts.verifyName && storedName)
          ? await opts.verifyName(storedName, opts.conversationText ?? '')
          : false
        if (!verified) {
          gateNote = storedName
            ? `\n（⚠️ 身分未核對：上方密碼/房號/門鎖等敏感欄位已遮蔽。請客人提供「訂房時登記的姓名」，系統會自動核對；核對相符前，嚴禁透露任何密碼、房號、門鎖、鑰匙資訊。）`
            : `\n（⚠️ 此資料表無可核對的姓名欄位，無法驗證身分。涉及密碼/房號等敏感資訊請改由真人客服協助，嚴禁透露。）`
        }
      }
      const result = colIdxs.map(i => {
        const masked = !verified && sensitiveIdxs.includes(i)
        return `${headers[i]}：${masked ? '（需核對姓名後提供）' : (matchedRow[i] ?? '')}`
      }).join('\n')
      return `【外部資料表：${config.sheetName}】\n找到「${exactKey}」的資料：\n${result}${gateNote}`
    }

    const wantedCols = [config.keyColumn, ...(config.returnColumns ?? [])].filter(Boolean)
    const colIdxs = wantedCols.length > 0
      ? wantedCols.map(c => headers.findIndex(h => h.trim() === c.trim())).filter(i => i >= 0)
      : headers.map((_, i) => i)
    const pickedHeaders = colIdxs.map(i => headers[i])
    const table = [pickedHeaders, ...dataRows.map(row => colIdxs.map(i => row[i] ?? ''))].map(r => r.join(' | ')).join('\n')
    return `【外部資料表：${config.sheetName}】\n${table}`
  } catch { return null }
}

function formatPricingForAI(name: string, cfg: PricingConfig): string {
  const cur = cfg.currency ?? 'TWD'
  const lines = [`【定價計算機：${name}】`, `計算時請逐步列式、每個數字必須照表使用，禁止估算。`]
  if (cfg.productType === 'tour') {
    if (cfg.schedules?.length) { lines.push('\n可選班次：'); cfg.schedules.forEach(s => lines.push(`  ${s.name}`)) }
    if (cfg.segments?.length) {
      lines.push(`\n票價（${cur}）：`)
      lines.push('  ▸ 平日（週一至週四）：'); cfg.segments.forEach(s => lines.push(`      ${s.label}：$${s.weekdayPrice.toLocaleString()}`))
      lines.push('  ▸ 假日（週五至週日、例假日）：'); cfg.segments.forEach(s => lines.push(`      ${s.label}：$${s.weekendPrice.toLocaleString()}`))
    }
    if (cfg.packages?.length) { lines.push('\n套餐方案：'); cfg.packages.forEach(p => lines.push(`  • ${p.name}：$${p.price.toLocaleString()}${p.description ? `（${p.description}）` : ''}`)) }
    if (cfg.groupDiscounts?.length) { lines.push('\n團體折扣：'); cfg.groupDiscounts.forEach(g => lines.push(`  • ${g.minPeople}人以上：${100 - g.discountPercent}折${g.note ? `（${g.note}）` : ''}`)) }
  }
  if (cfg.productType === 'accommodation' && cfg.rooms?.length) {
    lines.push(`\n房型與定價（${cur}）：`)
    cfg.rooms.forEach(r => {
      lines.push(`\n  ▸ 【${r.name}】最多 ${r.capacity} 人`)
      lines.push(`      平日：$${r.weekdayPrice.toLocaleString()}`)
      lines.push(`      假日/週末：$${r.weekendPrice.toLocaleString()}`)
      if (r.holidayPrice) lines.push(`      連續假期：$${r.holidayPrice.toLocaleString()}`)
      if (r.extraPersonFee) lines.push(`      加人費：$${r.extraPersonFee.toLocaleString()}/人/晚`)
    })
  }
  if (cfg.productType === 'custom' && cfg.customContent) lines.push('\n' + cfg.customContent)
  if (cfg.cancellationPolicy) lines.push(`\n取消政策：${cfg.cancellationPolicy}`)
  if (cfg.notes?.length) { lines.push('\n注意事項：'); cfg.notes.forEach(n => lines.push(`  • ${n}`)) }
  return lines.join('\n')
}

function queryJsonPricing(name: string, config: PricingConfig, message: string): string | null {
  const triggered = (config.triggerKeywords ?? []).some(kw => kw.trim() && message.toLowerCase().includes(kw.trim().toLowerCase()))
  if (!triggered) return null
  return formatPricingForAI(name, config)
}

async function queryDataSources(userId: string, message: string, bookingFlowEnabled = false, sheetOpts: SheetQueryOpts = {}): Promise<string> {
  const supabase = getServiceClient()
  const { data: sources } = await supabase
    .from('cs_data_sources')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)

  if (!sources?.length) return ''
  const results: string[] = []
  await Promise.all(sources.map(async (src) => {
    let result: string | null = null
    if (src.type === 'json_pricing') {
      // 預訂流程開啟時直接注入所有定價模組，不依賴訊息關鍵字觸發
      result = bookingFlowEnabled
        ? formatPricingForAI(src.name, src.config as PricingConfig)
        : queryJsonPricing(src.name, src.config as PricingConfig, message)
    } else {
      result = await queryGoogleSheet(src.config as SheetConfig, message, sheetOpts)
    }
    if (result) results.push(result)
  }))
  if (!results.length) return ''
  const hasPricing = sources.some(s => s.type === 'json_pricing' && results.some(r => r.includes(s.name)))
  return `\n\n【外部資料查詢結果】\n${results.join('\n\n')}\n${hasPricing ? '計算價格時請逐步列式，嚴格使用以上定價表數字，不得估算。' : '請根據以上資料回覆客戶，資料中沒有的欄位請勿捏造。'}`
}

// ── Sales context: availability + urgency, closing toolkit, social proof ──────
// Mirrors the cs-chat sandbox so live customers get the same business-minded behavior.
async function buildSalesContext(userId: string, discountMaxPct: number, discountGifts: string): Promise<string> {
  const supabase = getServiceClient()
  const sections: string[] = []

  // Property availability + gentle urgency (homestay; empty for other industries)
  try {
    const { data: properties } = await supabase
      .from('properties').select('id, name, description, max_guests, base_price, extra_guest_fee, dynamic_pricing_enabled')
      .eq('user_id', userId).eq('status', 'active')
    if (properties?.length) {
      const today = new Date().toISOString().slice(0, 10)
      const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
      const { data: bookings } = await supabase
        .from('bookings').select('property_id, guest_name, check_in, check_out, status, num_guests')
        .eq('user_id', userId).in('status', ['confirmed', 'pending'])
        .gte('check_out', today).lte('check_in', future)
      const lines = ['【房源與價目／訂單狀況（系統即時資料，報價一律以此為準）】']
      for (const p of properties) {
        const feeNote = p.extra_guest_fee ? `，超過加收 $${Number(p.extra_guest_fee).toLocaleString()}/人/晚` : ''
        const dynNote = p.dynamic_pricing_enabled ? '（假日/特定日期價格另計，請客人提供入住日期以精算實際房價）' : ''
        lines.push(`\n▸ ${p.name}${p.description ? `（${p.description}）` : ''}，最多 ${p.max_guests ?? '—'} 人，基本價 $${p.base_price ?? '—'}/晚${feeNote}${dynNote}`)
        const pB = (bookings ?? []).filter(b => b.property_id === p.id)
        if (!pB.length) lines.push('  近90天無訂單，全部可訂')
        else { lines.push('  已預訂日期：'); pB.forEach(b => lines.push(`    ${b.check_in} ~ ${b.check_out}（${b.guest_name}，${b.num_guests}人，${b.status}）`)) }
      }
      lines.push('\n判斷是否可訂：若客人詢問的日期與上方已預訂區間重疊，則無法接受；否則可接受。')
      lines.push('若所詢問日期可訂，主動說「目前還有空房，假日訂單通常很快就滿，需要的話可以先幫您確認」以製造溫和緊迫感。')
      sections.push(lines.join('\n'))
    }
  } catch { /* 不中斷主流程 */ }

  // Closing toolkit (discounts / gifts)
  const giftList = (discountGifts ?? '').split('\n').map(g => g.trim()).filter(Boolean)
  if (discountMaxPct > 0 || giftList.length) {
    const lines = ['【促成工具箱——客人猶豫或嫌貴時才使用，每次只說一項，不一次全列】']
    lines.push('使用時機：客人說「有點貴」「我再想想」「考慮看看」等猶豫訊號時主動提出')
    if (discountMaxPct > 0) lines.push(`\n可提供折扣：最多 ${discountMaxPct}% off（算出折後金額告知客人，客人確認則生效）`)
    if (giftList.length) { lines.push('\n可贈送項目（從以下選一項，問客人偏好）：'); giftList.forEach(g => lines.push(`• ${g}`)) }
    lines.push('\n優惠確認後必須在最終訂單確認清單中標注（例：含免費早餐 / 享9折優惠）')
    sections.push(lines.join('\n'))
  }

  // Reviews / social proof
  try {
    const { data: topReviews } = await supabase
      .from('reviews').select('guest_name, platform, rating, comment')
      .eq('user_id', userId).not('comment', 'is', null).gte('rating', 8)
      .order('rating', { ascending: false }).limit(4)
    const valid = (topReviews ?? []).filter(r => r.comment && r.comment.length > 10)
    if (valid.length) {
      const PLAT: Record<string, string> = {
        booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb', google: 'Google',
        trip_com: 'Trip.com', asiayo: 'AsiaYo', tripadvisor: 'TripAdvisor', manual: '旅客',
      }
      sections.push('【客人真實好評（社會證明）——客人猶豫或詢問品質時自然引用，勿一次全部列出】\n' +
        valid.map(r => `${r.guest_name}（${PLAT[r.platform] ?? r.platform}）：「${r.comment!.slice(0, 80)}」⭐ ${r.rating}/10`).join('\n'))
    }
  } catch { /* 不中斷主流程 */ }

  return sections.length ? '\n\n' + sections.join('\n\n') : ''
}

// ── Build booking flow system prompt ─────────────────────────────────────────
interface BookingFlowDef {
  id: string
  name: string
  triggerKeywords: string
  dataHint?: string
  steps: string[]
  paymentInfo: string
}

function buildStepLabels(dataHint?: string): Record<string, string> {
  const hint = dataHint?.trim()
  return {
    product:       hint ? `介紹「${hint}」相關方案/選項（從知識庫中「${hint}」資料取得，列出可選方案讓客人選）` : '行程/產品/房型 選擇（列出可選方案讓客人選）',
    date_depart:   '出發日期',
    date_checkin:  '入住日期',
    date_checkout: '退房日期',
    timeslot:      '出發/入住 時段或班次',
    headcount:     '人數（大人/小孩/嬰兒各幾位）',
    passenger_id:  '所有參加者（不限登島，賞鯨/所有行程均需）逐人詢問：姓名、生日（民國年月日）、身分證字號（用於保險）',
    booker_name:   '訂房/訂位人姓名',
    quote:         hint ? `報價（從定價計算機中找「${hint}」相關定價，根據已知日期/人數/方案逐步計算總價並告知客人）` : '報價（根據已收集的日期、人數、方案，套用定價計算機計算總價，逐步列式後告知客人）',
    email:         '電子郵件',
    plate:         '車牌號碼',
    phone:         '聯絡電話',
    special_req:   '特殊需求',
  }
}

function buildBookingSystemPrompt(_defaultPaymentInfo: string, flows: BookingFlowDef[]): string {
  // Payment info is intentionally NOT embedded here — it is injected only via
  // detectBookingCompletion() after server-side step completion is confirmed,
  // so the AI cannot reveal account details before the booking is complete.
  const flowSection = flows.length > 0
    ? flows.map(f => {
        const keywords = f.triggerKeywords.split(',').map((k: string) => k.trim()).filter(Boolean).join('、')
        const stepLabels = buildStepLabels(f.dataHint)
        const stepList = f.steps.map((s, i) => `  ${i + 1}. ${stepLabels[s] ?? s}`).join('\n')
        return `【${f.name}】\n觸發：客人提到「${keywords}」等字詞時啟動此流程\n收集順序：\n${stepList}`
      }).join('\n\n')
    : `【通用預訂流程】\n收集順序：\n  1. 確認選定方案\n  2. 日期\n  3. 時段\n  4. 人數\n  5. 乘客資料（姓名/生日/身分證）\n  6. 聯絡電話`

  return `你是專業客服兼預訂助理。嚴格遵守以下所有規則，不得自行發揮。

【鐵則——絕對不可違反】
1. 每則回覆最多 5 行（含問句），絕不超過，除非客人說「請詳細說明」
2. 禁止複製知識庫原文，只摘重點
3. 禁止使用 Markdown（禁用 **、*、#、---）
4. 每則回覆結尾必須有一個問句引導客人行動
5. 禁止在所有步驟完成前輸出付款帳號；付款帳號只會由系統在步驟完成時提供，禁止自行填寫或捏造任何帳號

【角色A：產品顧問】
客人問問題時 → 條列 2~4 個重點或選項 + 價格，然後問「請問您想選哪個？」

【角色B：預訂收集者】
客人選定方案後，嚴格按照收集順序的編號（1→2→3→4→…）逐一問，規則如下：
- 當前步驟客人已回答 → 才能問下一步，不可跳步驟
- 每次只問一件事，不可同時問兩個步驟
- 絕對不可假設或推斷任何欄位（包含知識庫提到的資料）
- 客人未明確說出的一律要問，即使看似知道答案
- 詢問乘客資料時，一律說「所有參加者」，禁止說「登島人」（即使知識庫用此詞）

${flowSection}

【情境對照表——嚴格按此執行】

情境1：客人問「有沒有X行程」「有什麼X」「X多少錢」「有提供X嗎」
正確做法：列出 2~4 個相關選項和價格（每項一行），最後問「請問您想選哪個？」，列完立刻停止，不加任何其他說明
絕對禁止：在列完選項後添加「其他重要資訊」「出發時間」「保險說明」「注意事項」「交通建議」「預訂說明」等額外內容

情境2：客人說出具體方案名稱（如「賞鯨+繞島」「二合一」「三合一」「401高地」「入住」「訂房」+房型名）
正確做法：視為已選定方案，立即進入角色B，問第一個未填欄位
錯誤做法：重複說明方案內容或再次列出選項

情境3：客人說「我要訂」「好」「就這個」「可以」「選那個」
正確做法：若方案已明確 → 立即進角色B；若方案不明確 → 問「請問您選的是哪個方案？」
錯誤做法：再次介紹所有方案

情境4：收集途中客人又問問題
正確做法：一句話簡短回答，然後繼續問下一個欄位
錯誤做法：長篇回答，忘記繼續收集

情境5：所有欄位收集完畢
正確做法：整理確認清單，計算總金額，告知付款方式

【回覆範例（情境1）】
客人說：「請問你們有賞鯨行程」
你的回覆：
您好！我們有三種賞鯨行程：
- 二合一（賞鯨+繞島）：800元（12歲以下600元）
- 三合一（賞鯨+繞島+登島）：1300元（12歲以下1100元）
- 401高地（賞鯨+繞島+登島）：1450元
請問您想選哪個？

【回覆範例（情境2）】
客人說：「我要賞鯨+繞島」
你的回覆：
好的！請問您預計哪天出發？

語氣親切自然，計算總價時逐步列式，嚴格使用定價表數字。`
}

// ── Server-side booking completion → inject payment only when all steps done ──
// Mirrors cs-chat's gating so the live (webhook) path never reveals the payment
// account before the booking is genuinely complete.
function detectBookingCompletion(flows: BookingFlowDef[], history: HistoryMsg[], message: string, defaultPayment: string): string {
  if (!flows.length) return ''
  const allMessages = [...history, { role: 'user' as const, content: message }]
  const userMsgs = allMessages.filter(m => m.role === 'user').map(m => m.content)
  const userTexts = userMsgs.join('\n')
  const userTurns = userMsgs.length
  const assistantTexts = allMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n')
  const DATE_RE = /[0-9]{1,2}\s*月|[0-9]{4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2}|(?<![0-9])[0-9]{1,2}[\/\-][0-9]{1,2}(?![0-9])/
  const looksLikeName = (s: string) => { const t = s.trim(); return t.length >= 2 && t.length <= 12 && !/[0-9@]/.test(t) && /^[\p{L}·\s]+$/u.test(t) }
  const det: Record<string, () => boolean> = {
    headcount:     () => /[0-9一二三四五六七八九十]+\s*(大人|成人|小孩|嬰兒|位|人)/.test(userTexts),
    passenger_id:  () => /[A-Za-z][0-9]{9}/.test(userTexts),
    phone:         () => /0[0-9]{8,9}/.test(userTexts),
    date_depart:   () => DATE_RE.test(userTexts),
    date_checkin:  () => DATE_RE.test(userTexts),
    date_checkout: () => DATE_RE.test(userTexts) && userTurns > 2,
    timeslot:      () => /[0-9]{1,2}[:：點時]/.test(userTexts),
    booker_name:   () => userMsgs.some(looksLikeName),
    email:         () => /@/.test(userTexts),
    plate:         () => /[A-Z0-9]{4,8}/.test(userTexts),
    special_req:   () => true,
    quote:         () => /\$[0-9,，]+|[0-9,，]+\s*(元|元整)/.test(assistantTexts),
    product:       () => userTurns > 1,
  }
  for (const flow of flows) {
    const kws = flow.triggerKeywords.split(',').map(k => k.trim())
    if (!kws.some(kw => kw && userTexts.toLowerCase().includes(kw.toLowerCase()))) continue
    const requiredStepCount = flow.steps.filter(s => s !== 'special_req').length
    const done = userTurns >= requiredStepCount && flow.steps.every(s => det[s] ? det[s]() : true)
    if (done) {
      const payment = (flow.paymentInfo || defaultPayment || '').trim()
      return `\n\n【系統偵測：所有預訂步驟已完成——立即執行】\n你的下一則回覆必須：\n第一行「好的！以下是您的預訂確認：」\n接著逐行列出所有已收集資料與總金額\n接著原文輸出以下付款資訊（禁止修改或省略）：\n${payment || '（付款方式請聯繫工作人員確認）'}\n最後一行「以上資訊是否正確？」`
    }
  }
  return ''
}

// ── Strip leaked reasoning / Markdown the model emits despite instructions ────
function cleanReply(raw: string): string {
  let reply = raw
    .replace(/^THOUGHT[\s\S]*?\n\n(?=\S)/i, '')
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, '')
    .replace(/^\*\*思考\*\*[\s\S]*?\n\n(?=\S)/i, '')
  // Discard leading non-Chinese reasoning paragraphs, but only when Chinese content
  // exists (so a full English/Korean reply for a foreign customer is preserved).
  const paragraphs = reply.split(/\n\n+/)
  const CN_START = /^[一-鿿㐀-䶿！-￮　-〿]|^好的|^您好|^謝謝|^感謝|^請問|^抱歉|^很抱歉|^非常感謝/
  const idx = paragraphs.findIndex(p => CN_START.test(p.trimStart()))
  if (idx > 0) reply = paragraphs.slice(idx).join('\n\n')
  return reply.trim()
    .replace(/[^\n]*×\s*1\.\d+\s*=\s*[^\n]*/g, '')   // strip surcharge-multiplier lines
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')                  // bold
    .replace(/(?<!\d)\*(?!\d)(.+?)(?<!\d)\*(?!\d)/g, '$1') // italic (skip * next to digits)
    .replace(/^[\*\-] /gm, '')                         // bullets
    .replace(/^#{1,6} /gm, '')                         // headings
    .replace(/---+/g, '')                              // hr
    .trim()
}

// ── AI reply (直接呼叫 Gemini / Claude，不經過 cs-chat 路由) ─────────────────
async function getAIReply(
  message: string,
  knowledge: CsKnowledge,
  history: HistoryMsg[] = [],
  userId = '',
  sellSection = '',
  imageBuffer?: Buffer,
  imageMimeType?: string,
): Promise<string> {
  const FALLBACK = '感謝您的訊息，我們的客服人員將盡快與您聯繫。'

  try {
    const langInstruction = knowledge.replyLanguage === 'auto'
      ? '請使用與客戶相同的語言回覆。'
      : `請使用 ${knowledge.replyLanguage} 回覆。`

    const baseInstructions = knowledge.systemPrompt?.trim()
      ? knowledge.systemPrompt.trim()
      : (knowledge.bookingFlowEnabled
          ? buildBookingSystemPrompt(knowledge.paymentInfo, knowledge.bookingFlows)
          : '你是一個專業的客服 AI 助理，代表公司提供售後支援。語氣親切專業，回答簡潔明瞭，不捏造資訊。')

    const taiwanTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })

    const geminiKey = process.env.GOOGLE_AI_API_KEY
    if (!geminiKey) return FALLBACK

    const google = createGoogleGenerativeAI({ apiKey: geminiKey })

    // Fuzzy identity verifier for sensitive order fields (CN↔EN romanization, surname order)
    const convUserText = [...history.filter(m => m.role === 'user').map(m => m.content), message].join('\n')
    const verifyName = async (storedName: string, conv: string): Promise<boolean> => {
      if (!storedName.trim() || !conv.trim()) return false
      try {
        const { text } = await generateText({
          model: google('gemini-2.5-flash'),
          messages: [{
            role: 'user',
            content: `訂單登記的姓名是：「${storedName}」\n客人在對話中提供的內容：「${conv.slice(-600)}」\n\n請判斷：客人是否說出了與登記姓名屬於「同一個人」的姓名？\n比對規則（皆視為相符）：中文與英文拼音互換、發音相近即可（拼法不需完全一致，如 Chen=Chern、Lee=Li）、姓氏可在前或在後、大小寫與空格差異。\n只有當你有把握是同一人時回 YES；客人未提供姓名或無法確認時回 NO。只回一個詞：YES 或 NO。`,
          }],
        })
        return /^\s*yes/i.test(text)
      } catch { return false }
    }

    const externalDataSection = userId
      ? await queryDataSources(userId, message, knowledge.bookingFlowEnabled, { conversationText: convUserText, verifyName })
      : ''

    const bookingCompletion = knowledge.bookingFlowEnabled
      ? detectBookingCompletion(knowledge.bookingFlows, history, message, knowledge.paymentInfo)
      : ''

    // Authoritative server-side quote. Prefer booking module (Plan A) so bot quotes
    // match online booking; fall back to json_pricing config when no property matches.
    let deterministicQuote = ''
    if (knowledge.bookingFlowEnabled && userId) {
      const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      const bq = await buildBookingModuleQuote(getServiceClient(), userId, google('gemini-2.5-flash'), convUserText, todayIso)
      if (bq) {
        deterministicQuote = bq
      } else if (knowledge.pricingConfigs.length) {
        const lc = convUserText.toLowerCase()
        const cfg = knowledge.pricingConfigs.find(c => (c.triggerKeywords ?? []).some(kw => kw && lc.includes(kw.toLowerCase())))
          ?? knowledge.pricingConfigs[0]
        deterministicQuote = await buildDeterministicQuote(google('gemini-2.5-flash'), cfg, convUserText, todayIso)
      }
    }

    const salesContext = userId
      ? await buildSalesContext(userId, knowledge.discountMaxPct, knowledge.discountGifts)
      : ''

    const systemPrompt = `${baseInstructions}

【重要格式規定】
- 禁止使用 Markdown 語法（禁用 **粗體**、*斜體*、# 標題、--- 分隔線）
- ${langInstruction}
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測
- 目前台灣時間：${taiwanTime}${knowledge.knowledgeBase ? `\n\n【知識庫參考資料】\n${knowledge.knowledgeBase}` : ''}${sellSection}${salesContext}${externalDataSection}${deterministicQuote ? `\n\n${deterministicQuote}` : ''}${bookingCompletion}`

    // Build user message — multimodal if image present
    type UserContent = string | Array<{ type: 'text'; text: string } | { type: 'image'; image: Uint8Array; mimeType: string }>
    const userContent: UserContent = (imageBuffer && imageMimeType)
      ? [
          ...(message.trim() ? [{ type: 'text' as const, text: message }] : [{ type: 'text' as const, text: '客人傳送了一張圖片' }]),
          { type: 'image' as const, image: new Uint8Array(imageBuffer), mimeType: imageMimeType },
        ]
      : message

    const messages = [
      ...history.slice(-10),
      { role: 'user' as const, content: userContent },
    ]

    // High risk → try Claude first (Claude also supports vision)
    const HIGH_RISK_KEYWORDS = ['退款', '退貨', '投訴', '抱怨', '法律', 'refund', 'complaint', 'lawsuit']
    const isHighRisk = HIGH_RISK_KEYWORDS.some(kw => message.toLowerCase().includes(kw.toLowerCase()))

    if (isHighRisk) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey) {
        try {
          const anthropic = createAnthropic({ apiKey: anthropicKey })
          const { text } = await generateText({
            model: anthropic('claude-sonnet-4-5'),
            system: systemPrompt,
            messages,
          })
          return cleanReply(text) || FALLBACK
        } catch { /* fall through to Gemini */ }
      }
    }

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages,
    })
    return cleanReply(text) || FALLBACK
  } catch {
    return FALLBACK
  }
}

// ── Image fetch helpers ───────────────────────────────────────────────────────

async function fetchLineImage(messageId: string, token: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = Buffer.from(await res.arrayBuffer())
    return { buffer: buf, mimeType: ct.split(';')[0].trim() }
  } catch { return null }
}

async function fetchWhatsAppImage(mediaId: string, token: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    // Step 1: get media URL
    const metaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!metaRes.ok) return null
    const meta = await metaRes.json()
    const url: string = meta.url
    if (!url) return null
    // Step 2: download
    const imgRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!imgRes.ok) return null
    const ct = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const buf = Buffer.from(await imgRes.arrayBuffer())
    return { buffer: buf, mimeType: ct.split(';')[0].trim() }
  } catch { return null }
}

async function fetchTelegramImage(fileId: string, botToken: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const d = await r.json()
    const filePath: string = d.result?.file_path
    if (!filePath) return null
    const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!imgRes.ok) return null
    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'jpg'
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const buf = Buffer.from(await imgRes.arrayBuffer())
    return { buffer: buf, mimeType }
  } catch { return null }
}

// ── Constant-time string compare ──────────────────────────────────────────────
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

// ── LINE signature verification (HMAC-SHA256, base64) ─────────────────────────
async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return timingSafeEqual(signature, expected)
  } catch { return false }
}

// ── Meta (WhatsApp Cloud) signature: X-Hub-Signature-256 = sha256=<hex> ───────
async function verifyMetaSignature(rawBody: string, header: string, appSecret: string): Promise<boolean> {
  try {
    const expected = header.startsWith('sha256=') ? header.slice(7) : header
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    return timingSafeEqual(hex, expected)
  } catch { return false }
}

// ── WeChat signature: sha1(sort(token, timestamp, nonce)) ─────────────────────
async function verifyWeChatSignature(token: string, signature: string, timestamp: string, nonce: string): Promise<boolean> {
  try {
    const raw = [token, timestamp, nonce].sort().join('')
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(raw))
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return timingSafeEqual(hex, signature)
  } catch { return false }
}

// ── Send reply helpers ────────────────────────────────────────────────────────
async function replyLine(replyToken: string, text: string, token: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  })
}

async function replyWhatsApp(to: string, text: string, phoneId: string, token: string) {
  await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  })
}

async function replyTelegram(chatId: string | number, text: string, botToken: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; userId: string }> }
) {
  const { platform, userId } = await params

  // Load CS knowledge base once for all platforms
  const knowledge = await loadCsKnowledge(userId)

  // ── LINE ──────────────────────────────────────────────────────────────────
  if (platform === 'line' || platform === 'line-oa') {
    const creds = await loadCredentials(userId, platform)
    const token     = creds.line_channel_access_token ?? ''
    const secret    = creds.line_channel_secret ?? ''
    const signature = req.headers.get('x-line-signature') ?? ''
    const rawBody   = await req.text()

    if (secret && !(await verifyLineSignature(rawBody, signature, secret))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const events = body?.events ?? []
    for (const event of events) {
      if (event.type !== 'message') continue
      const msgType: string = event.message?.type
      if (msgType !== 'text' && msgType !== 'image') continue

      const replyToken: string = event.replyToken
      const customerId: string = event.source?.userId ?? event.source?.groupId ?? 'unknown'
      const history = await loadHistory(userId, customerId)

      let text = msgType === 'text' ? (event.message.text as string) : ''
      let imgBuf: Buffer | undefined; let imgMime: string | undefined
      if (msgType === 'image' && token) {
        const img = await fetchLineImage(event.message.id, token)
        if (img) { imgBuf = img.buffer; imgMime = img.mimeType }
        else text = '（客人傳送了一張圖片，但無法讀取）'
      }

      const reply = await replyToCustomer(userId, platform, customerId, knowledge, history, text, imgBuf, imgMime)
      if (reply && token && replyToken) await replyLine(replyToken, reply, token)
      await saveHistory(userId, customerId, withTurn(history, text || '【圖片】', reply))
    }
    return NextResponse.json({ ok: true })
  }

  // ── WhatsApp / WhatsApp Business ──────────────────────────────────────────
  if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
    const creds     = await loadCredentials(userId, platform)
    const phoneId   = creds.whatsapp_phone_number_id ?? ''
    const token     = creds.whatsapp_access_token ?? ''
    const appSecret = creds.whatsapp_app_secret ?? ''
    const rawBody   = await req.text()

    // Verify Meta payload signature only when an App Secret is configured
    if (appSecret) {
      const sigHeader = req.headers.get('x-hub-signature-256') ?? ''
      if (!sigHeader || !(await verifyMetaSignature(rawBody, sigHeader, appSecret))) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const body    = JSON.parse(rawBody)
    const entry   = body?.entry?.[0]
    const changes = entry?.changes?.[0]?.value
    const msgs    = changes?.messages ?? []

    for (const msg of msgs) {
      if (msg.type !== 'text' && msg.type !== 'image') continue
      const to: string = msg.from
      const history = await loadHistory(userId, to)

      let text = msg.type === 'text' ? (msg.text?.body ?? '') : ''
      let imgBuf: Buffer | undefined; let imgMime: string | undefined
      if (msg.type === 'image' && msg.image?.id && token) {
        const img = await fetchWhatsAppImage(msg.image.id, token)
        if (img) { imgBuf = img.buffer; imgMime = img.mimeType }
        else text = '（客人傳送了一張圖片，但無法讀取）'
      }

      const reply = await replyToCustomer(userId, platform, to, knowledge, history, text, imgBuf, imgMime)
      if (reply && token && phoneId && to) await replyWhatsApp(to, reply, phoneId, token)
      await saveHistory(userId, to, withTurn(history, text || '【圖片】', reply))
    }
    return NextResponse.json({ ok: true })
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (platform === 'telegram') {
    const creds         = await loadCredentials(userId, 'telegram')
    const botToken      = creds.telegram_bot_token ?? ''
    const adminChatId   = creds.telegram_admin_chat_id ?? ''
    const webhookSecret = creds.telegram_webhook_secret ?? ''

    // Verify Telegram secret token only when configured (set via setWebhook secret_token).
    // Without this, anyone knowing the URL + adminChatId could impersonate the admin.
    if (webhookSecret && req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body          = await req.json()

    // ── Pipeline approval: inline button callback_query ────────────────────
    const cq = body?.callback_query
    if (cq && botToken) {
      const chatId  = String(cq.message?.chat?.id ?? '')
      const cqId    = cq.id as string
      const cqData  = cq.data as string
      const msgId   = cq.message?.message_id as number | undefined

      const ackText = cqData === 'approve' ? '✅ 已核准！' : cqData === 'reject' ? '❌ 已拒絕' : '請輸入修改意見'
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cqId, text: ackText }),
      }).catch(() => {})

      const supabase = getServiceClient()
      const q = supabase
        .from('telegram_approvals')
        .select('id, status')
        .eq('chat_id', chatId)
        .in('status', ['pending', 'awaiting_feedback'])
        .order('created_at', { ascending: false })
        .limit(1)
      if (msgId) q.eq('message_id', msgId)
      const { data: approvals } = await q
      const approval = approvals?.[0]

      if (approval) {
        if (cqData === 'approve') {
          await supabase.from('telegram_approvals').update({ status: 'approved' }).eq('id', approval.id)
        } else if (cqData === 'reject') {
          await supabase.from('telegram_approvals').update({ status: 'rejected' }).eq('id', approval.id)
        } else if (cqData === 'modify') {
          await supabase.from('telegram_approvals').update({ status: 'awaiting_feedback' }).eq('id', approval.id)
          await replyTelegram(chatId, '📝 請輸入您的修改意見：', botToken)
        }
      }
      return NextResponse.json({ ok: true })
    }

    // ── Pipeline approval: text feedback (after tapping ✏️ modify) ─────────
    const message      = body?.message ?? body?.edited_message
    if (message?.text && botToken) {
      const chatId: string | number = message.chat?.id
      const text: string = message.text
      const supabase = getServiceClient()
      const { data: awaitingApprovals } = await supabase
        .from('telegram_approvals')
        .select('id')
        .eq('chat_id', String(chatId))
        .eq('status', 'awaiting_feedback')
        .order('created_at', { ascending: false })
        .limit(1)
      if (awaitingApprovals?.[0]) {
        await supabase.from('telegram_approvals')
          .update({ status: 'feedback', feedback: text })
          .eq('id', awaitingApprovals[0].id)
        await replyTelegram(chatId, `🔄 已收到修改意見！\n\n「${text}」\n\nAI 將依此重新生成，請返回 AI GATE 繼續流程。`, botToken)
        return NextResponse.json({ ok: true })
      }
    }

    if (message?.text && botToken) {
      const chatId: string | number = message.chat?.id
      const text: string            = message.text
      const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || '客戶'
      const isAdmin = adminChatId && String(chatId) === String(adminChatId)

      // ── Admin replying to a forwarded customer message ──────────────────
      if (isAdmin && message.reply_to_message?.text) {
        // Extract customer chat ID embedded in the forwarded message
        const match = message.reply_to_message.text.match(/🆔 ChatID: (-?\d+)/)
        if (match) {
          const customerChatId = match[1]
          await replyTelegram(customerChatId, text, botToken)
        }
        return NextResponse.json({ ok: true })
      }

      // ── Regular customer message (text or photo) ───────────────────────
      const hasPhoto = Array.isArray(message?.photo) && message.photo.length > 0
      if (chatId && (text || hasPhoto) && !text.startsWith('/') && !isAdmin) {
        const customerId = String(chatId)
        const history = await loadHistory(userId, customerId)

        let imgBuf: Buffer | undefined; let imgMime: string | undefined
        if (hasPhoto && botToken) {
          // Pick the largest photo (last in array)
          const photo = message.photo[message.photo.length - 1]
          const img = await fetchTelegramImage(photo.file_id, botToken)
          if (img) { imgBuf = img.buffer; imgMime = img.mimeType }
        }

        // 1. AI auto-reply to customer
        const reply = await replyToCustomer(userId, 'telegram', customerId, knowledge, history, text, imgBuf, imgMime)
        if (reply) await replyTelegram(chatId, reply, botToken)
        await saveHistory(userId, customerId, withTurn(history, text || '【圖片】', reply))

        // 2. Forward to admin if configured
        if (adminChatId) {
          const displayText = hasPhoto ? `【圖片】${text ? ` + ${text}` : ''}` : text
          const forwardMsg =
            `💬 客戶訊息\n` +
            `👤 ${senderName}\n` +
            `🆔 ChatID: ${chatId}\n\n` +
            `「${displayText}」\n\n` +
            `🤖 AI 已回覆：\n${reply}\n\n` +
            `─────────────\n` +
            `↩️ 直接回覆此訊息可代替 AI 回覆客戶`
          await replyTelegram(adminChatId, forwardMsg, botToken)
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Zalo / Zalo OA ───────────────────────────────────────────────────────
  if (platform === 'zalo' || platform === 'zalo-oa') {
    const creds   = await loadCredentials(userId, platform)
    const oaToken = creds.zalo_oa_access_token ?? ''
    const body    = await req.json()
    const event   = body?.event_name ?? ''
    if (event === 'user_send_text') {
      const text: string     = body?.message?.text ?? ''
      const senderId: string = body?.sender?.id ?? ''
      if (text && senderId) {
        const history = await loadHistory(userId, senderId)
        const reply = await replyToCustomer(userId, platform, senderId, knowledge, history, text)
        if (reply && oaToken) {
          await fetch('https://openapi.zalo.me/v2.0/oa/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: oaToken },
            body: JSON.stringify({ recipient: { user_id: senderId }, message: { text: reply } }),
          })
        }
        await saveHistory(userId, senderId, withTurn(history, text, reply))
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── WeChat ────────────────────────────────────────────────────────────────
  if (platform === 'wechat') {
    const wechatToken = (await loadCredentials(userId, 'wechat')).wechat_token ?? ''
    if (wechatToken) {
      const { searchParams } = new URL(req.url)
      const ok = await verifyWeChatSignature(
        wechatToken,
        searchParams.get('signature') ?? '',
        searchParams.get('timestamp') ?? '',
        searchParams.get('nonce') ?? ''
      )
      if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const rawBody = await req.text()
    const msgMatch  = rawBody.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)
    const fromMatch = rawBody.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)
    const toMatch   = rawBody.match(/<ToUserName><!\[CDATA\[(.*?)\]\]><\/ToUserName>/)

    const text = msgMatch?.[1] ?? ''
    const from = fromMatch?.[1] ?? ''
    const to   = toMatch?.[1] ?? ''

    if (text && from && to) {
      const history = await loadHistory(userId, from)
      const reply = await replyToCustomer(userId, 'wechat', from, knowledge, history, text)
      await saveHistory(userId, from, withTurn(history, text, reply))
      if (!reply) return new NextResponse('success')  // human handling → no passive reply
      const safeReply = reply.replace(/]]>/g, ']]&gt;')  // prevent CDATA breakout
      const xmlReply = `<xml>
<ToUserName><![CDATA[${from}]]></ToUserName>
<FromUserName><![CDATA[${to}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${safeReply}]]></Content>
</xml>`
      return new NextResponse(xmlReply, { headers: { 'Content-Type': 'text/xml' } })
    }
    return new NextResponse('success')
  }

  // ── WhatsApp Personal (Baileys Bridge) ───────────────────────────────────
  if (platform === 'whatsapp-personal' || platform === 'whatsapp_personal') {
    // Inbound comes from our own Baileys Bridge — require the shared API key when configured
    const bridgeKey = process.env.WHATSAPP_BRIDGE_API_KEY ?? ''
    if (bridgeKey && req.headers.get('x-api-key') !== bridgeKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body       = await req.json()
    const text: string = body?.text ?? ''
    const fromJid: string = body?.fromJid ?? (body?.from ? `${body.from}@s.whatsapp.net` : '')

    if (text && fromJid) {
      const history = await loadHistory(userId, fromJid)
      const reply = await replyToCustomer(userId, platform, fromJid, knowledge, history, text)

      // Reply via Bridge
      const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL?.replace(/\/$/, '')
      const bridgeKey = process.env.WHATSAPP_BRIDGE_API_KEY ?? ''
      if (reply && bridgeUrl && bridgeKey) {
        await fetch(`${bridgeUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': bridgeKey },
          body: JSON.stringify({ userId, to: fromJid, text: reply }),
        }).catch(() => {})
      }
      await saveHistory(userId, fromJid, withTurn(history, text, reply))
    }
    return NextResponse.json({ ok: true })
  }

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  if (platform === 'linkedin') {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `不支援的平台: ${platform}` }, { status: 400 })
}

// GET: webhook verification (WhatsApp / LINE require GET verification)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; userId: string }> }
) {
  const { platform, userId } = await params
  const { searchParams } = new URL(req.url)

  // WhatsApp verification
  if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
    const creds       = await loadCredentials(userId, platform)
    const mode        = searchParams.get('hub.mode')
    const token       = searchParams.get('hub.verify_token')
    const challenge   = searchParams.get('hub.challenge')
    const verifyToken = creds.whatsapp_verify_token ?? ''
    if (mode === 'subscribe' && token === verifyToken) {
      return new NextResponse(challenge ?? '', { status: 200 })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Zalo OA verification
  if (platform === 'zalo' || platform === 'zalo-oa') {
    return NextResponse.json({ ok: true })
  }

  // WeChat server verification (echo back echostr after validating signature)
  if (platform === 'wechat') {
    const wechatToken = (await loadCredentials(userId, 'wechat')).wechat_token ?? ''
    const echostr = searchParams.get('echostr') ?? ''
    const ok = !wechatToken || await verifyWeChatSignature(
      wechatToken,
      searchParams.get('signature') ?? '',
      searchParams.get('timestamp') ?? '',
      searchParams.get('nonce') ?? ''
    )
    if (ok) return new NextResponse(echostr, { status: 200 })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  return NextResponse.json({ ok: true, platform, userId, status: 'webhook active' })
}
