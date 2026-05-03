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

function buildBookingSystemPrompt(paymentInfo: string): string {
  const paymentSection = paymentInfo.trim()
    ? `\n\n【付款說明】\n${paymentInfo}`
    : ''
  return `你是一個專業的預訂助理，請透過自然對話一步一步引導客戶完成預訂。

【對話守則】
- 每次只問或說一件事，等客戶回答後再繼續
- 語氣親切，像真人客服
- 禁止使用 Markdown（禁用 **、*、#、---）
- 不確定的資訊請誠實說明，勿猜測

【預訂引導流程（依序進行）】
步驟1：介紹方案
  → 當客戶詢問行程、產品或想要預訂時，根據知識庫/定價資料，列出所有可選方案、時間與大略價格，讓客戶選擇
  → 若客戶直接詢問特定方案，則確認並進入步驟2

步驟2：確認選擇
  → 重述客戶選定的方案，確認無誤

步驟3：出發日期
  → 詢問希望出發的日期

步驟4：出發時段
  → 根據該行程可選班次，詢問偏好的時段

步驟5：人數
  → 詢問大人、小孩、嬰兒各幾位

步驟6：乘客資料（逐人收集，用於團體保險）
  → 每位乘客依序詢問：姓名、生日（民國格式）、身分證字號
  → 有幾位就收集幾份，每次只問一位

步驟7：聯絡電話
  → 請客戶留下一支聯絡電話

步驟8：確認與報價
  → 整理所有資訊，逐項列出供客戶確認
  → 依定價表嚴格計算總金額（大人/小孩/嬰兒分別列式，再加總）
  → 告知付款方式完成預訂${paymentSection}`
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
        result = queryJsonPricing(src.name, src.config as PricingConfig, message)
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

  const baseInstructions = bookingFlowEnabled
    ? buildBookingSystemPrompt(paymentInfo)
    : (userSystemPrompt?.trim()
        ? userSystemPrompt.trim()
        : `你是一個專業的客服 AI 助理，代表公司提供售後支援。語氣親切專業，回答簡潔明瞭，不捏造資訊。`)

const systemPrompt = `${baseInstructions}

【重要格式規定】
- 禁止使用 Markdown 語法（禁用 **粗體**、*斜體*、# 標題、--- 分隔線）
- ${langInstruction}
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測${knowledgeBase ? `\n\n【知識庫參考資料】\n${knowledgeBase.slice(0, 8000)}` : ''}${externalDataSection}`

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
