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

// ── Supabase service role client ───────────────────────────────────────────────
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

// ── Load CS knowledge base (unit_data[12]) + company data ────────────────────
interface CsKnowledge {
  systemPrompt: string
  knowledgeBase: string
  escalationThreshold: 'medium' | 'high'
  replyLanguage: string
  bookingFlowEnabled: boolean
  paymentInfo: string
  bookingFlows: BookingFlowDef[]
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

  if (pricingSources?.length) {
    const pricingLines: string[] = []
    for (const src of pricingSources) {
      const cfg = src.config as Record<string, unknown>
      pricingLines.push(`【定價資料：${src.name}】\n${JSON.stringify(cfg, null, 2)}`)
    }
    if (pricingLines.length) knowledgeParts.push(pricingLines.join('\n\n'))
  }

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

async function queryGoogleSheet(config: SheetConfig, message: string): Promise<string | null> {
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
      const result = colIdxs.map(i => `${headers[i]}：${matchedRow[i] ?? ''}`).join('\n')
      return `【外部資料表：${config.sheetName}】\n找到「${exactKey}」的資料：\n${result}`
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

async function queryDataSources(userId: string, message: string, bookingFlowEnabled = false): Promise<string> {
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
      result = await queryGoogleSheet(src.config as SheetConfig, message)
    }
    if (result) results.push(result)
  }))
  if (!results.length) return ''
  const hasPricing = sources.some(s => s.type === 'json_pricing' && results.some(r => r.includes(s.name)))
  return `\n\n【外部資料查詢結果】\n${results.join('\n\n')}\n${hasPricing ? '計算價格時請逐步列式，嚴格使用以上定價表數字，不得估算。' : '請根據以上資料回覆客戶，資料中沒有的欄位請勿捏造。'}`
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

function buildBookingSystemPrompt(defaultPaymentInfo: string, flows: BookingFlowDef[]): string {
  const flowSection = flows.length > 0
    ? flows.map(f => {
        const keywords = f.triggerKeywords.split(',').map((k: string) => k.trim()).filter(Boolean).join('、')
        const stepLabels = buildStepLabels(f.dataHint)
        const stepList = f.steps.map((s, i) => `  ${i + 1}. ${stepLabels[s] ?? s}`).join('\n')
        const payment = (f.paymentInfo || defaultPaymentInfo).trim()
        return `【${f.name}】\n觸發：客人提到「${keywords}」等字詞時啟動此流程\n收集順序：\n${stepList}${payment ? `\n付款說明：${payment}` : ''}`
      }).join('\n\n')
    : `【通用預訂流程】\n收集順序：\n  1. 確認選定方案\n  2. 日期\n  3. 時段\n  4. 人數\n  5. 乘客資料（姓名/生日/身分證）\n  6. 聯絡電話${defaultPaymentInfo ? `\n付款說明：${defaultPaymentInfo}` : ''}`

  return `你是專業客服兼預訂助理。嚴格遵守以下所有規則，不得自行發揮。

【鐵則——絕對不可違反】
1. 每則回覆最多 5 行（含問句），絕不超過，除非客人說「請詳細說明」
2. 禁止複製知識庫原文，只摘重點
3. 禁止使用 Markdown（禁用 **、*、#、---）
4. 每則回覆結尾必須有一個問句引導客人行動

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

// ── AI reply (直接呼叫 Gemini / Claude，不經過 cs-chat 路由) ─────────────────
async function getAIReply(
  message: string,
  knowledge: CsKnowledge,
  history: HistoryMsg[] = [],
  userId = ''
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
    const externalDataSection = userId ? await queryDataSources(userId, message, knowledge.bookingFlowEnabled) : ''

    const systemPrompt = `${baseInstructions}

【重要格式規定】
- 禁止使用 Markdown 語法（禁用 **粗體**、*斜體*、# 標題、--- 分隔線）
- ${langInstruction}
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測
- 目前台灣時間：${taiwanTime}${knowledge.knowledgeBase ? `\n\n【知識庫參考資料】\n${knowledge.knowledgeBase}` : ''}${externalDataSection}`

    const messages = [
      ...history.slice(-10),
      { role: 'user' as const, content: message },
    ]

    const geminiKey = process.env.GOOGLE_AI_API_KEY
    if (!geminiKey) return FALLBACK

    const google = createGoogleGenerativeAI({ apiKey: geminiKey })

    // High risk → try Claude first
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
          return text || FALLBACK
        } catch { /* fall through to Gemini */ }
      }
    }

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages,
    })
    return text || FALLBACK
  } catch {
    return FALLBACK
  }
}

// ── LINE signature verification ───────────────────────────────────────────────
async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return signature === expected
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
      if (event.type !== 'message' || event.message?.type !== 'text') continue
      const text: string = event.message.text
      const replyToken: string = event.replyToken
      const customerId: string = event.source?.userId ?? event.source?.groupId ?? 'unknown'
      const history = await loadHistory(userId, customerId)
      const reply = await getAIReply(text, knowledge, history, userId)
      if (token && replyToken) await replyLine(replyToken, reply, token)
      await saveHistory(userId, customerId, [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }])
    }
    return NextResponse.json({ ok: true })
  }

  // ── WhatsApp / WhatsApp Business ──────────────────────────────────────────
  if (platform === 'whatsapp' || platform === 'whatsapp-biz') {
    const creds   = await loadCredentials(userId, platform)
    const phoneId = creds.whatsapp_phone_number_id ?? ''
    const token   = creds.whatsapp_access_token ?? ''
    const body    = await req.json()
    const entry   = body?.entry?.[0]
    const changes = entry?.changes?.[0]?.value
    const msgs    = changes?.messages ?? []

    for (const msg of msgs) {
      if (msg.type !== 'text') continue
      const text: string = msg.text?.body ?? ''
      const to: string   = msg.from
      const history = await loadHistory(userId, to)
      const reply = await getAIReply(text, knowledge, history, userId)
      if (token && phoneId && to) await replyWhatsApp(to, reply, phoneId, token)
      await saveHistory(userId, to, [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }])
    }
    return NextResponse.json({ ok: true })
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (platform === 'telegram') {
    const creds        = await loadCredentials(userId, 'telegram')
    const botToken     = creds.telegram_bot_token ?? ''
    const adminChatId  = creds.telegram_admin_chat_id ?? ''
    const body         = await req.json()

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

      // ── Regular customer message ────────────────────────────────────────
      if (chatId && text && !text.startsWith('/') && !isAdmin) {
        const customerId = String(chatId)
        const history = await loadHistory(userId, customerId)

        // 1. AI auto-reply to customer
        const reply = await getAIReply(text, knowledge, history, userId)
        await replyTelegram(chatId, reply, botToken)
        await saveHistory(userId, customerId, [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }])

        // 2. Forward to admin if configured
        if (adminChatId) {
          const forwardMsg =
            `💬 客戶訊息\n` +
            `👤 ${senderName}\n` +
            `🆔 ChatID: ${chatId}\n\n` +
            `「${text}」\n\n` +
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
        const reply = await getAIReply(text, knowledge, history, userId)
        if (oaToken) {
          await fetch('https://openapi.zalo.me/v2.0/oa/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', access_token: oaToken },
            body: JSON.stringify({ recipient: { user_id: senderId }, message: { text: reply } }),
          })
        }
        await saveHistory(userId, senderId, [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }])
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── WeChat ────────────────────────────────────────────────────────────────
  if (platform === 'wechat') {
    const rawBody = await req.text()
    const msgMatch  = rawBody.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)
    const fromMatch = rawBody.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)
    const toMatch   = rawBody.match(/<ToUserName><!\[CDATA\[(.*?)\]\]><\/ToUserName>/)

    const text = msgMatch?.[1] ?? ''
    const from = fromMatch?.[1] ?? ''
    const to   = toMatch?.[1] ?? ''

    if (text && from && to) {
      const history = await loadHistory(userId, from)
      const reply = await getAIReply(text, knowledge, history, userId)
      await saveHistory(userId, from, [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }])
      const xmlReply = `<xml>
<ToUserName><![CDATA[${from}]]></ToUserName>
<FromUserName><![CDATA[${to}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${reply}]]></Content>
</xml>`
      return new NextResponse(xmlReply, { headers: { 'Content-Type': 'text/xml' } })
    }
    return new NextResponse('success')
  }

  // ── WhatsApp Personal (Baileys Bridge) ───────────────────────────────────
  if (platform === 'whatsapp-personal' || platform === 'whatsapp_personal') {
    const body       = await req.json()
    const text: string = body?.text ?? ''
    const fromJid: string = body?.fromJid ?? (body?.from ? `${body.from}@s.whatsapp.net` : '')

    if (text && fromJid) {
      const history = await loadHistory(userId, fromJid)
      const reply = await getAIReply(text, knowledge, history, userId)

      // Reply via Bridge
      const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL?.replace(/\/$/, '')
      const bridgeKey = process.env.WHATSAPP_BRIDGE_API_KEY ?? ''
      if (bridgeUrl && bridgeKey) {
        await fetch(`${bridgeUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': bridgeKey },
          body: JSON.stringify({ userId, to: fromJid, text: reply }),
        }).catch(() => {})
      }
      await saveHistory(userId, fromJid, [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }])
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

  return NextResponse.json({ ok: true, platform, userId, status: 'webhook active' })
}
