import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

const INTENT_CATEGORIES = [
  '產品諮詢', '價格/報價', '訂單查詢', '退換貨/退款',
  '技術支援', '投訴/抱怨', '帳號/登入問題', '一般問候', '法律/合約', '其他',
]
const HIGH_RISK_INTENTS = ['退換貨/退款', '投訴/抱怨', '法律/合約']

interface SheetConfig {
  apiKey: string
  spreadsheetId: string
  sheetName: string
  keyColumn: string
  returnColumns: string[]
  triggerKeywords: string[]
  triggerMode?: 'keyword' | 'numeric' | 'both'
}

// Matches numbers with 8+ digits, not starting with 0, not preceded by +
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
    if (numMatch) {
      triggered = true
      exactKey = numMatch[0]
    }
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

    // Numeric trigger: exact single-row lookup
    if (exactKey && keyColIdx >= 0) {
      const matchedRow = dataRows.find(row => (row[keyColIdx] ?? '').trim() === exactKey!.trim())
      if (!matchedRow) {
        return `【外部資料表：${config.sheetName}】\n查無符合訂單號碼「${exactKey}」的資料，請確認訂單號碼是否正確。`
      }

      const wantedCols = [config.keyColumn, ...(config.returnColumns ?? [])].filter(Boolean)
      const colIdxs = wantedCols.length > 1
        ? wantedCols.map(c => headers.findIndex(h => h.trim() === c.trim())).filter(i => i >= 0)
        : headers.map((_, i) => i)

      const pickedHeaders = colIdxs.map(i => headers[i])
      const pickedValues = colIdxs.map(i => matchedRow[i] ?? '')
      const result = pickedHeaders.map((h, i) => `${h}：${pickedValues[i]}`).join('\n')
      return `【外部資料表：${config.sheetName}】\n找到訂單「${exactKey}」的資料：\n${result}`
    }

    // Keyword trigger: return full filtered table
    const wantedCols = [config.keyColumn, ...(config.returnColumns ?? [])].filter(Boolean)
    const colIdxs = wantedCols.length > 0
      ? wantedCols.map(c => headers.findIndex(h => h.trim() === c.trim())).filter(i => i >= 0)
      : headers.map((_, i) => i)

    const pickedHeaders = colIdxs.map(i => headers[i])
    const pickedRows = dataRows.map(row => colIdxs.map(i => row[i] ?? ''))

    const table = [pickedHeaders, ...pickedRows]
      .map(r => r.join(' | '))
      .join('\n')

    return `【外部資料表：${config.sheetName}】\n${table}`
  } catch {
    return null
  }
}

// ── JSON Pricing Calculator ───────────────────────────────────────────────────

interface PricingSegment {
  label: string
  key: string
  weekdayPrice: number
  weekendPrice: number
}

interface PricingRoom {
  name: string
  capacity: number
  weekdayPrice: number
  weekendPrice: number
  holidayPrice?: number
  extraPersonFee?: number
}

interface PricingConfig {
  productType: 'tour' | 'accommodation' | 'custom'
  triggerKeywords: string[]
  currency?: string
  schedules?: Array<{ id: string; name: string }>
  segments?: PricingSegment[]
  packages?: Array<{ name: string; price: number; description?: string }>
  groupDiscounts?: Array<{ minPeople: number; discountPercent: number; note?: string }>
  rooms?: PricingRoom[]
  cancellationPolicy?: string
  notes?: string[]
  customContent?: string
}

function formatPricingForAI(name: string, cfg: PricingConfig): string {
  const cur = cfg.currency ?? 'TWD'
  const lines: string[] = [
    `【定價計算機：${name}】`,
    `以下為精確定價資料，計算時請逐步列式、每個數字必須照表使用，禁止估算。`,
  ]

  if (cfg.productType === 'tour') {
    if (cfg.schedules?.length) {
      lines.push('\n可選班次：')
      cfg.schedules.forEach(s => lines.push(`  ${s.name}`))
    }
    if (cfg.segments?.length) {
      lines.push(`\n票價（${cur}）：`)
      lines.push('  ▸ 平日（週一至週四）：')
      cfg.segments.forEach(s => lines.push(`      ${s.label}：$${s.weekdayPrice.toLocaleString()}`))
      lines.push('  ▸ 假日（週五至週日、例假日）：')
      cfg.segments.forEach(s => lines.push(`      ${s.label}：$${s.weekendPrice.toLocaleString()}`))
    }
    if (cfg.packages?.length) {
      lines.push('\n套餐方案：')
      cfg.packages.forEach(p =>
        lines.push(`  • ${p.name}：$${p.price.toLocaleString()}${p.description ? `（${p.description}）` : ''}`)
      )
    }
    if (cfg.groupDiscounts?.length) {
      lines.push('\n團體折扣：')
      cfg.groupDiscounts.forEach(g =>
        lines.push(`  • ${g.minPeople} 人（含）以上：${100 - g.discountPercent}折${g.note ? `（${g.note}）` : ''}`)
      )
    }
  }

  if (cfg.productType === 'accommodation') {
    if (cfg.rooms?.length) {
      lines.push(`\n房型與定價（${cur}）：`)
      cfg.rooms.forEach(r => {
        lines.push(`\n  ▸ 【${r.name}】最多 ${r.capacity} 人`)
        lines.push(`      平日：$${r.weekdayPrice.toLocaleString()}`)
        lines.push(`      假日/週末：$${r.weekendPrice.toLocaleString()}`)
        if (r.holidayPrice) lines.push(`      連續假期：$${r.holidayPrice.toLocaleString()}`)
        if (r.extraPersonFee) lines.push(`      加人費：$${r.extraPersonFee.toLocaleString()}/人/晚`)
      })
    }
  }

  if (cfg.productType === 'custom' && cfg.customContent) {
    lines.push('\n' + cfg.customContent)
  }

  // Fallback: if none of the structured formatters matched, dump raw JSON for AI to interpret
  const hasStructuredOutput = lines.length > 2
  if (!hasStructuredOutput) {
    const displayData = { ...cfg } as Record<string, unknown>
    delete displayData['triggerKeywords']
    delete displayData['productType']
    delete displayData['currency']
    lines.push('\n定價資料（JSON）：')
    lines.push('```json')
    lines.push(JSON.stringify(displayData, null, 2))
    lines.push('```')
    lines.push(`\n貨幣單位：${cur}`)
  }

  if (cfg.cancellationPolicy) {
    lines.push(`\n取消政策：${cfg.cancellationPolicy}`)
  }

  if (cfg.notes?.length) {
    lines.push('\n注意事項：')
    cfg.notes.forEach(n => lines.push(`  • ${n}`))
  }

  return lines.join('\n')
}

function queryJsonPricing(name: string, config: PricingConfig, message: string): string | null {
  const triggered = (config.triggerKeywords ?? []).some(kw =>
    kw.trim() && message.toLowerCase().includes(kw.trim().toLowerCase())
  )
  if (!triggered) return null
  return formatPricingForAI(name, config)
}

interface BookingFlowDef {
  id: string
  name: string
  triggerKeywords: string
  dataHint?: string   // 對應知識庫/定價模組的關鍵字，例如「賞鯨」「海景大床房」
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
        const keywords = f.triggerKeywords.split(',').map(k => k.trim()).filter(Boolean).join('、')
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
客人選定方案或說要預訂時 → 嚴格按照流程順序逐一收集欄位，每次只問一件事
- 絕對不可跳過任何步驟
- 絕對不可假設、推斷或自行填入任何欄位（即使知識庫有提到）
- 客人明確說出的才能記錄，未說出的一律補問
- 確認已有資訊時用「您說的是…對嗎？」讓客人確認，不可直接帶入

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

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (e) {
    return NextResponse.json({ error: `伺服器錯誤：${String(e)}` }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    message,
    history = [],
    systemPrompt: userSystemPrompt = '',
    knowledgeBase = '',
    escalationThreshold = 'high',
    language = 'auto',
    campaignId,
    bookingFlowEnabled = false,
    paymentInfo = '',
    bookingFlows = [] as BookingFlowDef[],
  } = await req.json()

  if (!message?.trim()) return NextResponse.json({ error: '訊息不可為空' }, { status: 400 })

  const t0 = Date.now()
  const geminiKey = process.env.GOOGLE_AI_API_KEY
  if (!geminiKey) return NextResponse.json({ error: 'GOOGLE_AI_API_KEY 未設定' }, { status: 500 })

  const google = createGoogleGenerativeAI({ apiKey: geminiKey })

  // ── Query external data sources ───────────────────────────────────────────
  const { data: sources } = await supabase
    .from('cs_data_sources')
    .select('*')
    .eq('user_id', user.id)
    .eq('enabled', true)

  const sheetResults: string[] = []
  if (sources?.length) {
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
      if (result) sheetResults.push(result)
    }))
  }

  const hasPricing = sources?.some(s => s.type === 'json_pricing' && sheetResults.some(r => r.includes(s.name)))
  const externalDataSection = sheetResults.length > 0
    ? `\n\n【外部資料查詢結果】\n${sheetResults.join('\n\n')}\n${hasPricing ? '計算價格時請逐步列式，嚴格使用以上定價表數字，不得估算。' : '請根據以上資料回覆客戶，資料中沒有的欄位請勿捏造。'}`
    : ''

  // ── Intent classification ─────────────────────────────────────────────────
  const knowledgeSection = knowledgeBase
    ? `\n\n【知識庫】\n${knowledgeBase.slice(0, 3000)}`
    : ''

  const classifyPrompt = `你是一個客服意圖分類器。請分析以下客戶訊息，回傳 JSON（只回傳 JSON，不要有其他文字）：

意圖類別（從中選一）：${INTENT_CATEGORIES.join('、')}
風險等級：low（一般諮詢）/ medium（需要人工協助）/ high（投訴、退款、法律）${knowledgeSection}

客戶訊息：「${message}」

回傳格式：{"intent":"...","risk":"low|medium|high","summary":"一句話摘要客戶需求"}`

  let intent = '其他'
  let risk: string = 'low'
  let summary = message

  try {
    const { text: classifyText } = await generateText({
      model: google('gemini-2.5-flash'),
      messages: [{ role: 'user', content: classifyPrompt }],
    })
    const parsed = JSON.parse(classifyText.replace(/```json\n?|```/g, '').trim())
    intent = parsed.intent ?? intent
    risk = parsed.risk ?? risk
    summary = parsed.summary ?? summary
    if (HIGH_RISK_INTENTS.includes(intent)) risk = 'high'
  } catch (_) {
    // keep defaults
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  const shouldEscalate =
    risk === 'high' ||
    (escalationThreshold === 'medium' && (risk === 'medium' || risk === 'high'))

  const langInstruction = language === 'auto'
    ? '請使用與客戶相同的語言回覆。'
    : `請使用 ${language} 回覆。`

  // 優先順序：使用者自訂 system prompt > bookingFlows 自動產生 > 預設客服
  const baseInstructions = userSystemPrompt?.trim()
    ? userSystemPrompt.trim()
    : (bookingFlowEnabled
        ? buildBookingSystemPrompt(paymentInfo, bookingFlows)
        : `你是一個專業的客服 AI 助理，代表公司提供售後支援。語氣親切專業，回答簡潔明瞭，不捏造資訊。`)

  const taiwanTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })

const systemPrompt = `${baseInstructions}

【重要格式規定】
- 禁止使用 Markdown 語法（禁用 **粗體**、*斜體*、# 標題、--- 分隔線）
- ${langInstruction}
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測
- 目前台灣時間：${taiwanTime}${knowledgeBase ? `\n\n【知識庫參考資料】\n${knowledgeBase.slice(0, 8000)}` : ''}${externalDataSection}`

  const msgHistory = [
    ...history.slice(-6).map((h: { role: string; content: string }) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user' as const, content: message },
  ]

  let reply = ''
  let provider: 'Gemini' | 'Claude' = 'Gemini'

  if (shouldEscalate) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      provider = 'Gemini'
    } else {
      provider = 'Claude'
      try {
        const anthropic = createAnthropic({ apiKey: anthropicKey })
        const { text } = await generateText({
          model: anthropic('claude-sonnet-4-5'),
          system: systemPrompt,
          messages: msgHistory,
        })
        reply = text
      } catch {
        provider = 'Gemini'
      }
    }
  }

  if (provider === 'Gemini') {
    try {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        system: systemPrompt,
        messages: msgHistory,
      })
      reply = text
    } catch (e) {
      return NextResponse.json({ error: `Gemini 呼叫失敗：${String(e).slice(0, 200)}` }, { status: 500 })
    }
  }

  const latencyMs = Date.now() - t0

  if (campaignId) {
    await supabase.from('marketing_campaigns').select('id').eq('id', campaignId).single().then(async ({ data }) => {
      if (!data) return
      const { data: camp } = await supabase.from('marketing_campaigns').select('unit_data').eq('id', campaignId).single()
      const unitData = (camp?.unit_data ?? {}) as Record<string, unknown>
      const unit12 = (unitData[12] as { logs?: unknown[] } | undefined) ?? {}
      const logs = (unit12.logs ?? []) as unknown[]
      const newLog = { message, reply, intent, risk, provider, latencyMs, ts: new Date().toISOString() }
      const updatedLogs = [newLog, ...logs].slice(0, 100)
      await supabase.from('marketing_campaigns').update({
        unit_data: { ...unitData, 12: { ...unit12, logs: updatedLogs } },
      }).eq('id', campaignId)
    })
  }

  return NextResponse.json({ reply, intent, risk, provider, latencyMs, summary })
}
