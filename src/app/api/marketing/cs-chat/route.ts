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

// Columns whose values must NOT be revealed until the requester's identity is verified.
// (Order number alone is guessable → prevents IDOR on door codes / room numbers.)
const SENSITIVE_COL_RE = /密碼|password|passcode|\bpin\b|房號|room\s*(no|number|#)?|門鎖|門禁|鎖|鑰匙|\bkey\b|wifi|wi-?fi/i
// Column that holds the guest name, used as the verification factor.
const NAME_COL_RE = /姓名|名字|訂房人|訂位人|入住人|旅客|客戶|貴賓|聯絡人|\bname\b|guest|customer/i

interface SheetQueryOpts {
  conversationText?: string
  verifyName?: (storedName: string, conversationText: string) => Promise<boolean>
}

async function queryGoogleSheet(config: SheetConfig, message: string, opts: SheetQueryOpts = {}): Promise<string | null> {
  const triggerMode = config.triggerMode ?? 'keyword'
  let triggered = false

  // Always extract numeric key so precise row lookup works even in keyword mode
  const numMatch = message.match(NUMERIC_ORDER_RE)
  const exactKey: string | null = numMatch ? numMatch[0] : null

  if (triggerMode === 'keyword' || triggerMode === 'both') {
    if (config.triggerKeywords.some(kw => kw.trim() && message.toLowerCase().includes(kw.trim().toLowerCase()))) {
      triggered = true
    }
  }

  if (triggerMode === 'numeric' || triggerMode === 'both') {
    if (exactKey) triggered = true
  }

  // Fallback: if the entire message IS the order number (user pasted it alone),
  // always trigger regardless of triggerMode — avoids [密碼] placeholder replies
  if (!triggered && exactKey && message.trim() === exactKey) {
    triggered = true
  }

  if (!triggered) return null

  try {
    const range = encodeURIComponent(`${config.sheetName}!A:Z`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.apiKey}`
    const res = await fetch(url)
    if (!res.ok) {
      // Do not leak raw upstream error text to the customer-facing context
      return `【外部資料表：${config.sheetName}】\n（系統提示：資料查詢暫時無法使用，請告知客戶系統忙碌、稍後再試或聯繫工作人員，禁止捏造任何資料。）`
    }

    const json = await res.json()
    const rows: string[][] = json.values ?? []
    if (rows.length < 2) return null

    const headers = rows[0]
    const dataRows = rows.slice(1)

    // Normalize cell values: convert to string, strip thousand-separator commas
    // Google Sheets API may return numbers as "202,202,202" or plain "202202202"
    const cellStr = (v: unknown): string => String(v ?? '').replace(/,/g, '').trim()

    // 支援多欄位查詢（逗號分隔），OR 邏輯
    const keyColumnNames = (config.keyColumn ?? '').split(',').map(c => c.trim()).filter(Boolean)
    const keyColIdxs = keyColumnNames.map(c => headers.findIndex(h => h.trim() === c)).filter(i => i >= 0)

    if (exactKey) {
      // Helper: find row by scanning given column indices
      const findRow = (idxs: number[]) =>
        dataRows.find(row => idxs.some(idx => cellStr(row[idx]) === exactKey!.trim()))

      // Primary search: key column(s) if configured and found in headers
      const primaryIdxs = keyColIdxs.length > 0 ? keyColIdxs : headers.map((_, i) => i)
      let matchedRow = findRow(primaryIdxs)

      // Secondary fallback: scan ALL columns (handles header name mismatch)
      if (!matchedRow && keyColIdxs.length > 0) {
        matchedRow = findRow(headers.map((_, i) => i))
      }

      if (!matchedRow) {
        return `【外部資料表：${config.sheetName}】\n查無符合「${exactKey}」的資料，請確認號碼是否正確。`
      }

      // ── Identity gate on sensitive columns (door code / room number) ──────
      // Order numbers are guessable, so revealing door codes on a bare number
      // is an IDOR. Require a fuzzy name match against the booking name first.
      const sensitiveIdxs = headers.map((h, i) => SENSITIVE_COL_RE.test(h ?? '') ? i : -1).filter(i => i >= 0)
      const nameIdx = headers.findIndex(h => NAME_COL_RE.test(h ?? ''))
      const storedName = nameIdx >= 0 ? cellStr(matchedRow[nameIdx]) : ''

      let verified = true
      let gateNote = ''
      if (sensitiveIdxs.length > 0) {
        if (opts.verifyName && storedName) {
          verified = await opts.verifyName(storedName, opts.conversationText ?? '')
        } else {
          verified = false  // no name column / no verifier → cannot confirm identity
        }
        if (!verified) {
          gateNote = storedName
            ? `\n（⚠️ 身分未核對：上方密碼/房號/門鎖等敏感欄位已遮蔽。請客人提供「訂房時登記的姓名」，系統會自動核對；核對相符前，嚴禁透露任何密碼、房號、門鎖、鑰匙資訊。）`
            : `\n（⚠️ 此資料表無可核對的姓名欄位，無法驗證身分。涉及密碼/房號等敏感資訊請改由真人客服協助，嚴禁透露。）`
        }
      }

      // Return columns (mask sensitive ones until verified) — prevents fabrication
      const result = headers.map((h, i) => {
        const masked = !verified && sensitiveIdxs.includes(i)
        const val = masked ? '（需核對姓名後提供）' : (matchedRow![i] ?? '')
        return `${h}：${val}`
      }).filter(l => {
        const val = l.split('：').slice(1).join('：').trim()
        return val !== ''
      }).join('\n')
      return `【外部資料表：${config.sheetName}】\n找到「${exactKey}」的資料：\n${result}\n（以上為此訂單資料，請直接引用，禁止修改或捏造任何數值）${gateNote}`
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
    // Do not leak internal exception details to the customer-facing context
    return `【外部資料表：${config.sheetName}】\n（系統提示：資料查詢發生異常，請告知客戶稍後再試或聯繫工作人員，禁止捏造任何資料。）`
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
  extraBedNote?: string
  description?: string  // bed type / room features shown to AI
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

// Replace digit*digit (multiplication used in bed sizes) with × to avoid Markdown misparse
const sanitizeDim = (s: string) => s.replace(/(\d)\*(\d)/g, '$1×$2')

function formatPricingForAI(name: string, cfg: PricingConfig): string {
  const cur = cfg.currency ?? 'TWD'
  const lines: string[] = [
    `【定價計算機：${name}】`,
    `以下為精確定價資料，計算時請逐步列式、每個數字必須照表使用，禁止估算。`,
    `報價格式規定：直接輸出各晚最終金額（假日/週末價已含加價，直接查表取值）；禁止在回覆中顯示任何加價乘數（× 1.15、× 1.2 等）；若有折扣優惠才可在總價後標注（例：享9.5折）。`,
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
      lines.push(`⚠️ 每個房型定價完全獨立，計算時必須逐房型各自使用下方對應數字，嚴禁合併或混用（即使人數相同，價格也可能不同）`)
      cfg.rooms.forEach(r => {
        lines.push(`\n  ▸ 【${r.name}】最多 ${r.capacity} 人`)
        if (r.description) lines.push(`      床型：${sanitizeDim(r.description)}`)
        lines.push(`      平日：$${r.weekdayPrice.toLocaleString()}`)
        lines.push(`      假日/週末：$${r.weekendPrice.toLocaleString()}`)
        if (r.holidayPrice) lines.push(`      連續假期：$${r.holidayPrice.toLocaleString()}`)
        if (r.extraPersonFee) lines.push(`      加人費：$${r.extraPersonFee.toLocaleString()}/人/晚`)
        if (r.extraBedNote) lines.push(`      加床說明：${sanitizeDim(r.extraBedNote)}`)
        if (!r.extraBedNote && !r.extraPersonFee && r.capacity <= 2) lines.push(`      不可加床`)
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
  dataHint?: string
  steps: string[]
  paymentInfo: string
  simpleMode?: boolean          // AI 只問方案/人數/報價，確認後彈出表單
  requirePassengerId?: boolean  // 表單是否要求身分證（幼兒永遠免填）
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
  // bookingCompletionInstruction after server-side step completion is confirmed,
  // preventing the AI from revealing account details before all steps are done.
  const flowSection = flows.length > 0
    ? flows.map(f => {
        const keywords = f.triggerKeywords.split(',').map(k => k.trim()).filter(Boolean).join('、')
        if (f.simpleMode) {
          return `【${f.name}（快速報名模式）】
觸發：客人提到「${keywords}」等字詞時啟動
執行步驟：
  1. 列出可選方案讓客人選（從知識庫/定價表取得）
  2. 詢問人數（幾位）
  3. 根據方案和人數報價，告知總金額
  4. 問：「請問確定要參加嗎？」
注意：步驟4後禁止再問姓名/身分證/電話，系統會以表單收集`
        }
        const stepLabels = buildStepLabels(f.dataHint)
        const stepList = f.steps.map((s, i) => `  ${i + 1}. ${stepLabels[s] ?? s}`).join('\n')
        return `【${f.name}】\n觸發：客人提到「${keywords}」等字詞時啟動此流程\n收集順序：\n${stepList}`
      }).join('\n\n')
    : `【通用預訂流程】\n收集順序：\n  1. 確認選定方案\n  2. 日期\n  3. 時段\n  4. 人數\n  5. 乘客資料（姓名/生日/身分證）\n  6. 聯絡電話`

  return `你是民宿的專屬業務顧問兼預訂助理，目標是讓每位詢問的客人都能找到最適合的房型、順利完成預訂，並留下美好體驗。

【業務員核心思維——每則回覆都要體現，這是你最重要的行為準則】
主動引導：回答完問題後，立即問下一步（「請問您有想好日期了嗎？」「要不要我幫您確認一下空房狀況？」），不讓對話停在問答上
強調體驗：說出房間的特色、景觀、獨特賣點，不只是列價格和規格
溫和緊迫感：有空房時說「目前您詢問的日期還有空房，假日通常訂很快，需要的話可以先幫您確認」
化解猶豫：客人說「我再想想」或遲疑時，主動問「是日期還沒確定，還是價格上有疑慮？我來幫您解答」，不讓對話冷掉
價格疑慮時：轉移到價值（含早餐、停車、景觀、在地體驗），讓客人看到划算之處
語氣：親切自然如熟識的朋友，不是冷冰冰的制式機器人

【絕對禁止清單——違反即為錯誤回覆】
1. 禁止使用 Markdown（禁用 **、*、#、---、- 列點）
2. 禁止複製知識庫原文，只摘重點
3. 禁止要求客人改用 LINE、WhatsApp、電話或其他管道預訂
4. 禁止在知識庫提到「請加LINE」「請來電」等內容時照單輸出給客人
5. 禁止在所有步驟未完成前輸出確認清單或付款帳號
6. 禁止在同一則訊息同時問兩個步驟
7. 禁止跳過任何已定義步驟（包括 passenger_id 乘客資料、phone 聯絡電話）
8. 禁止自行推算或捏造任何欄位
9. 禁止重複輸出付款帳號——付款帳號在整段對話中只輸出一次，即在情境5的確認清單那則訊息，之後每則回覆都不再重複
10. 禁止在報價中顯示任何加價乘數或加價算式（旺季加價 × 1.15、暑假加價 × 1.2 等「× 大於1的數字」一律不顯示）——加價後的金額直接取最終數字輸出，不展示過程；只有折扣優惠（× 0.XX、九折、八五折等「× 小於1的數字」）才需在回覆中列出讓客人知道

【角色A：產品顧問】
客人問行程/價格時，從【定價計算機】或【知識庫】中找出所有符合的方案，嚴格按照以下格式輸出：
1. 方案名稱：$價格
2. 方案名稱：$價格
3. 方案名稱：$價格
...（有幾個列幾個，不自行增減）
最後一行：「請問您想選哪個？（請回覆數字）」
嚴格禁止：
- 將不同方案/房型合併成同一行（即使人數相同或價格相近，也必須各自獨立列出）
- 在選項之間或之後加任何說明文字
- 重新命名或省略任何方案

【角色B：預訂收集者——核心執行邏輯】
客人選定方案後，進入角色B。執行規則：
- 每次只問清單中「下一個尚未回答」的步驟
- 客人回答後確認步驟完成，才問下一步
- 必須從步驟1問到最後一步，全部完成才能進入情境5

${flowSection}

【步驟完成判斷規則】
passenger_id（乘客資料）：每位參加者需明確說出姓名、身分證字號、出生年月日（三項都要），缺一則繼續追問
quote（報價）：自行從定價表計算，告知總金額，客人確認才算完成

【情境5——所有步驟全部完成後，且只執行一次】
步驟判斷：在心中逐一核對清單，確認每個步驟都已收到回答 → 才進行以下流程：
第一行：「好的！以下是您的預訂確認：」
接著逐行列出所有已收集欄位與數值
接著顯示總金額
接著輸出【系統提供的付款資訊】（等待系統在本則訊息末尾附上，禁止自行填寫或捏造任何帳號）
最後問：「以上資訊是否正確？」
注意：付款帳號只在此步驟輸出一次，後續對話不再重複

【情境2：客人說出具體方案名稱，或回覆數字（如「1」「2」「3」）選擇方案】
視為已選定方案，立即進入角色B，問步驟1的問題，不重複介紹方案

【情境3：客人說「好」「確定」「是的」「可以」】
若還有未完成步驟 → 繼續問下一步，不進入情境5
若所有步驟已完成 → 進入情境5

【情境4：收集途中客人又問問題】
一句話回答，然後繼續問當前未完成的步驟

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
    notifyWebhooks = [] as Array<{ id: string; type: 'line_messaging' | 'webhook'; label: string; value: string; target?: string }>,
    discountMaxPct = 0,
    discountGifts = '',
  } = await req.json()

  if (!message?.trim()) return NextResponse.json({ error: '訊息不可為空' }, { status: 400 })

  const t0 = Date.now()

  // ── Server-side booking detection ────────────────────────────────────────
  let bookingCompletionInstruction = ''
  if (bookingFlowEnabled && bookingFlows.length > 0) {
    const allMessages = [
      ...(history as { role: string; content: string }[]),
      { role: 'user', content: message },
    ]
    const userMsgs = allMessages.filter(m => m.role === 'user').map(m => m.content)
    const userTexts = userMsgs.join('\n')
    const userTurns = userMsgs.length
    const assistantTexts = allMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n')

    // A standalone message that plausibly answers a "name" prompt:
    // short, letters/CJK only, no digits or @ (so order numbers / emails don't count).
    const looksLikeName = (s: string) => {
      const t = s.trim()
      return t.length >= 2 && t.length <= 12 && !/[0-9@]/.test(t) && /^[\p{L}·\s]+$/u.test(t)
    }

    // Step completion detectors — evaluated against the full customer transcript.
    // DATE_RE matches: "7月8日" / "7/8" / "2026/7/8" / "7-8" / "2026-7-8"
    const DATE_RE = /[0-9]{1,2}\s*月|[0-9]{4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2}|(?<![0-9])[0-9]{1,2}[\/\-][0-9]{1,2}(?![0-9])/
    const stepDetectors: Record<string, () => boolean> = {
      headcount:     () => /[0-9一二三四五六七八九十]+\s*(大人|成人|小孩|嬰兒|位|人)/.test(userTexts),
      passenger_id:  () => /[A-Za-z][0-9]{9}/.test(userTexts),
      phone:         () => /0[0-9]{8,9}/.test(userTexts),
      date_depart:   () => DATE_RE.test(userTexts),
      date_checkin:  () => DATE_RE.test(userTexts),
      date_checkout: () => DATE_RE.test(userTexts) && userTurns > 2,
      timeslot:      () => /[0-9]{1,2}[:：點時]/.test(userTexts),
      booker_name:   () => userMsgs.some(looksLikeName),  // a dedicated name-like turn, not just any CJK
      email:         () => /@/.test(userTexts),
      plate:         () => /[A-Z0-9]{4,8}/.test(userTexts),
      special_req:   () => true, // optional, always passes
      quote:         () => /\$[0-9,，]+|[0-9,，]+\s*(元|元整)/.test(assistantTexts),
      product:       () => userTurns > 1,
    }

    // ── Simple mode: customer confirmed after quote → return showBookingForm ──
    const CONFIRM_RE = /^(確定|好|要|ok|yes|是|沒問題|可以|行|好的|確認|好啊|要的|參加|預訂|報名)/i
    const NEGATIVE_RE = /不|沒|取消|不要|算了|考慮/
    for (const flow of bookingFlows as BookingFlowDef[]) {
      if (!flow.simpleMode) continue
      const smKws = flow.triggerKeywords.split(',').map((k: string) => k.trim())
      const smTriggered = smKws.some((kw: string) => kw && userTexts.toLowerCase().includes(kw.toLowerCase()))
      if (!smTriggered) continue
      // Quote must be in the MOST RECENT assistant turn, and the confirmation must be
      // a short standalone "yes" — so "好，那價格呢？" or a stale earlier quote won't trigger.
      const lastAssistant = [...allMessages].reverse().find(m => m.role === 'assistant')?.content ?? ''
      const quoteGiven = /\$[0-9,，]+|NT\$[0-9,，]+|[0-9,，]+\s*(元|元整)/.test(lastAssistant)
      const msgTrim = message.trim()
      const isConfirm = CONFIRM_RE.test(msgTrim) && !NEGATIVE_RE.test(message) && msgTrim.length <= 12
      if (quoteGiven && isConfirm) {
        const hcMatch = userTexts.match(/([0-9]+)\s*(大人|成人|位|人)/)
        const headcount = hcMatch ? parseInt(hcMatch[1]) : 1
        return NextResponse.json({
          showBookingForm: true,
          bookingFormConfig: {
            flowId: flow.id,
            packageName: flow.name,
            requirePassengerId: flow.requirePassengerId ?? true,
            headcount,
          },
          reply: '好的！請填寫報名資料，客服會盡快與您聯繫。',
          intent: '確認預訂',
          risk: 'low',
          provider: 'system',
          latencyMs: Date.now() - t0,
          summary: `客人確認預訂 ${flow.name}`,
          images: [],
        })
      }
    }

    for (const flow of bookingFlows as BookingFlowDef[]) {
      if (flow.simpleMode) continue  // simple mode handled above
      const keywords = flow.triggerKeywords.split(',').map((k: string) => k.trim())
      const flowTriggered = keywords.some((kw: string) => kw && userTexts.toLowerCase().includes(kw.toLowerCase()))
      if (!flowTriggered) continue

      // Require at least one customer turn per required step (excludes optional special_req)
      // so the payment-account reveal can never fire after just a couple of messages.
      const requiredStepCount = flow.steps.filter((s: string) => s !== 'special_req').length
      const allStepsDone = userTurns >= requiredStepCount && flow.steps.every((step: string) => {
        const detector = stepDetectors[step]
        return detector ? detector() : true
      })

      if (allStepsDone) {
        const payment = (flow.paymentInfo || paymentInfo || '').trim()
        bookingCompletionInstruction = `\n\n【系統偵測：所有預訂步驟已完成——立即執行以下指令】
你的下一則回覆必須且只包含以下內容，不可省略任何一項：
第一行：「好的！以下是您的預訂確認：」
接著逐行列出所有已收集的資料（行程、日期、時段、人數、乘客姓名/身分證/生日、聯絡電話等，每項一行）
接著計算並顯示總金額
接著輸出以下付款資訊（逐行原文輸出，禁止修改或省略）：
${payment || '（付款方式請聯繫工作人員確認）'}
最後一行：「以上資訊是否正確？」`
        break
      }
    }
  }

  // ── Human escalation detection ────────────────────────────────────────────
  // If the customer explicitly asks for a human agent, create a ticket and return immediately.
  const HUMAN_ESCALATION_RE = /人工客服|真人客服|轉人工|轉真人|要真人|找真人|真人幫|人工幫|真人接|人工接|找客服|要客服|人工服務|真人服務/
  if (HUMAN_ESCALATION_RE.test(message)) {
    const allMsgs = [...(history as { role: string; content: string }[]), { role: 'user', content: message }]
    const { data: ticket } = await supabase
      .from('cs_tickets')
      .insert({
        user_id: user.id,
        industry: 'homestay',
        platform: 'chat',
        subject: message.slice(0, 80),
        description: '客人要求人工客服',
        priority: 'high',
        intent: '人工客服請求',
        messages: allMsgs,
        campaign_id: campaignId ?? null,
      })
      .select()
      .single()

    const ticketNum = ticket?.id?.slice(0, 8).toUpperCase() ?? '—'
    const taiwanNow = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
    const notifyMsg = `\n[AI GATE 工單]\n客人要求：${message.slice(0, 80)}\n工單編號：${ticketNum}\n時間：${taiwanNow}`

    // Fire-and-forget notifications (do not await — don't block the response)
    if (notifyWebhooks.length > 0) {
      type NW = { type: 'line_messaging' | 'webhook' | 'telegram'; value: string; target?: string }
      void Promise.allSettled((notifyWebhooks as NW[]).filter(wh => wh.value?.trim()).map(wh => {
        if (wh.type === 'line_messaging') {
          if (!wh.target?.trim()) return Promise.resolve()
          return fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${wh.value.trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: wh.target.trim(), messages: [{ type: 'text', text: notifyMsg }] }),
          })
        } else if (wh.type === 'telegram') {
          if (!wh.target?.trim()) return Promise.resolve()
          return fetch(`https://api.telegram.org/bot${wh.value.trim()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: wh.target.trim(), text: notifyMsg }),
          })
        } else {
          return fetch(wh.value.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: notifyMsg, ticket, ticketNum, customerMessage: message }),
          })
        }
      }))
    }

    return NextResponse.json({
      reply: `好的，已為您建立服務工單（編號：${ticketNum}），客服專員將盡快與您聯繫，請稍候。`,
      intent: '人工客服請求',
      risk: 'high',
      provider: 'system',
      latencyMs: Date.now() - t0,
      summary: '客人要求人工客服',
      images: [],
      ticketCreated: true,
      ticket,
    })
  }

  const geminiKey = process.env.GOOGLE_AI_API_KEY
  if (!geminiKey) return NextResponse.json({ error: 'GOOGLE_AI_API_KEY 未設定' }, { status: 500 })

  const google = createGoogleGenerativeAI({ apiKey: geminiKey })

  // Conversation text (customer turns) used for fuzzy identity verification
  const convUserText = [
    ...(history as { role: string; content: string }[]).filter(m => m.role === 'user').map(m => m.content),
    message,
  ].join('\n')

  // Fuzzy name verifier: tolerant of CN↔EN romanization, surname order, spacing/case.
  // Delegated to the LLM because phonetic romanization has too many rule variants.
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
    } catch {
      return false  // fail closed — never reveal sensitive data on verifier error
    }
  }

  // ── Query external data sources ───────────────────────────────────────────
  const { data: sources } = await supabase
    .from('cs_data_sources')
    .select('*')
    .eq('user_id', user.id)
    .eq('enabled', true)

  // 取出早餐設定
  const breakfastSource = sources?.find(s => s.type === 'breakfast_webhook')
  const breakfastCfg = breakfastSource?.config as {
    webhookUrl: string; cutoffTime: string; deliveryTime: string
    rooms: string[]; menu: string[]
  } | undefined

  // 偵測前端送來的確認封包，POST 到 Apps Script
  if (breakfastCfg?.webhookUrl) {
    const confirmMatch = message.match(/^##BREAKFAST_ORDER##(.+)$/)
    if (confirmMatch) {
      try {
        await fetch(breakfastCfg.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: confirmMatch[1],
        })
      } catch { /* 不中斷主流程 */ }
    }
  }

  const sheetResults: string[] = []
  if (sources?.length) {
    await Promise.all(sources.map(async (src) => {
      let result: string | null = null
      if (src.type === 'json_pricing') {
        // 預訂流程開啟時直接注入所有定價模組，不依賴訊息關鍵字觸發
        result = bookingFlowEnabled
          ? formatPricingForAI(src.name, src.config as PricingConfig)
          : queryJsonPricing(src.name, src.config as PricingConfig, message)
      } else if (src.type === 'breakfast_webhook') {
        return // 早餐設定單獨處理
      } else {
        const sheetCfg = src.config as SheetConfig
        // 預訂流程啟用時，若資料來源名稱含付款相關關鍵字，直接注入不需觸發
        const PAYMENT_KEYWORDS = ['帳號', '付款', '匯款', '銀行', '轉帳', 'payment', 'account']
        const isPaymentSource = PAYMENT_KEYWORDS.some(kw => src.name?.toLowerCase().includes(kw.toLowerCase()))
        if (bookingFlowEnabled && isPaymentSource) {
          // Fetch all rows from this sheet and inject as knowledge
          try {
            const range = encodeURIComponent(`${sheetCfg.sheetName}!A:Z`)
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetCfg.spreadsheetId}/values/${range}?key=${sheetCfg.apiKey}`
            const res = await fetch(url)
            if (res.ok) {
              const json = await res.json()
              const rows: string[][] = json.values ?? []
              if (rows.length >= 1) {
                const table = rows.map(r => r.join(' | ')).join('\n')
                result = `【付款資訊：${src.name}】\n${table}`
              }
            }
          } catch { /* 忽略錯誤 */ }
        } else {
          result = await queryGoogleSheet(sheetCfg, message, { conversationText: convUserText, verifyName })
        }
      }
      if (result) sheetResults.push(result)
    }))
  }

  const hasPricing = sources?.some(s => s.type === 'json_pricing' && sheetResults.some(r => r.includes(s.name)))

  // Detect numeric order number and sensitive-data intent
  const detectedOrderNum = message.match(NUMERIC_ORDER_RE)?.[0] ?? null
  const hasSheetSources = sources?.some(s => s.type !== 'json_pricing' && s.type !== 'breakfast_webhook' && s.enabled)
  const hasNumericSheetSources = sources?.some(s =>
    s.type !== 'json_pricing' && s.type !== 'breakfast_webhook' && s.enabled &&
    (s.config as SheetConfig).triggerMode === 'numeric'
  )

  // Keywords that suggest the user wants check-in/password info but hasn't given an order number
  const SENSITIVE_INTENT_KEYWORDS = ['入住', '密碼', '房號', '開門', 'check in', 'checkin', '鑰匙', '門鎖', '訂單', '查詢']
  const hasSensitiveIntent = SENSITIVE_INTENT_KEYWORDS.some(kw => message.toLowerCase().includes(kw.toLowerCase()))

  let externalDataSection = ''
  if (sheetResults.length > 0) {
    externalDataSection = `\n\n【外部資料查詢結果】\n${sheetResults.join('\n\n')}\n${hasPricing ? '計算價格時請逐步列式，嚴格使用以上定價表數字，不得估算。' : '請根據以上資料回覆客戶，資料中沒有的欄位請勿捏造。'}`
  } else if (hasNumericSheetSources && hasSensitiveIntent && !detectedOrderNum) {
    // Check current Taiwan hour to determine if check-in time has passed
    const taiwanHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false }), 10)
    const beforeCheckin = taiwanHour < 15 // before 3pm
    externalDataSection = beforeCheckin
      ? `\n\n【系統強制指令——立即執行】目前台灣時間尚未到下午3點（入住時間）。你的下一句話只能是：「您好，入住時間為下午3點，目前尚未到入住時間，請於下午3點後輸入您的訂單號碼，我們將為您提供入住資訊。」禁止問其他問題。`
      : `\n\n【系統強制指令——立即執行，不得有其他動作】目前已過下午3點（入住時間已到）。你的下一句話只能是：「請提供您的訂單號碼或預訂時的行動電話號碼，我馬上為您查詢入住資訊。」禁止問時間、禁止問其他問題，直接問號碼。`
  } else if (detectedOrderNum && hasSheetSources && sheetResults.length === 0) {
    externalDataSection = `\n\n【系統指令】偵測到訂單號「${detectedOrderNum}」但外部資料表查無結果（API設定錯誤或號碼不存在）。請告知客戶查無此號碼，請確認號碼是否正確或聯繫工作人員，禁止捏造任何密碼或房號。`
  }

  // ── Property & booking availability context ───────────────────────────────
  let propertyAvailSection = ''
  try {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name, description, max_guests, base_price')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (properties?.length) {
      const today = new Date().toISOString().slice(0, 10)
      const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

      const { data: bookings } = await supabase
        .from('bookings')
        .select('property_id, guest_name, check_in, check_out, status, num_guests')
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .gte('check_out', today)
        .lte('check_in', future)

      const lines: string[] = ['【房源與訂單狀況（系統即時資料，優先採用）】']
      for (const p of properties) {
        lines.push(`\n▸ ${p.name}${p.description ? `（${p.description}）` : ''}，最多 ${p.max_guests ?? '—'} 人，基本價 $${p.base_price ?? '—'}`)
        const pBookings = (bookings ?? []).filter(b => b.property_id === p.id)
        if (pBookings.length === 0) {
          lines.push(`  近90天無訂單，全部可訂`)
        } else {
          lines.push(`  已預訂日期：`)
          pBookings.forEach(b => {
            lines.push(`    ${b.check_in} ~ ${b.check_out}（${b.guest_name}，${b.num_guests}人，${b.status}）`)
          })
        }
      }
      lines.push('\n判斷是否可訂：若客人詢問的日期與上方已預訂區間重疊，則無法接受；否則可接受。')
      lines.push('若所詢問日期可訂，主動說「目前還有空房，假日訂單通常很快就滿，需要的話可以先幫您確認」以製造溫和緊迫感，促進決策。')
      propertyAvailSection = '\n\n' + lines.join('\n')
    }
  } catch { /* 不中斷主流程 */ }

  // ── Discount authority closing toolkit ───────────────────────────────────
  let closingToolkitSection = ''
  const hasDiscount = discountMaxPct > 0
  const giftList = discountGifts.split('\n').map(g => g.trim()).filter(Boolean)
  const hasGifts = giftList.length > 0

  if (hasDiscount || hasGifts) {
    const lines = ['\n\n【促成工具箱——客人猶豫或嫌貴時才使用，每次只說一項，不一次全列】']
    lines.push('使用時機：客人說「有點貴」「我再想想」「比較一下」「考慮看看」等猶豫訊號時主動提出')
    lines.push('提出方式：自然融入對話，例如「我幫您申請一個小優惠，您看可以嗎？」')
    if (hasDiscount) {
      lines.push(`\n可提供折扣：最多 ${discountMaxPct}% off（算出折後金額後告知客人，若客人確認則生效）`)
      lines.push(`折扣使用方式：「我幫您申請 ${discountMaxPct}% 的優惠，折後只需 $（重新計算），這樣可以嗎？」`)
    }
    if (hasGifts) {
      lines.push('\n可贈送項目（從以下選一項，問客人偏好）：')
      giftList.forEach(g => lines.push(`• ${g}`))
      lines.push('贈品使用方式：「我幫您加送一個小禮，（項目名稱），您覺得好嗎？」')
    }
    lines.push('\n重要：優惠確認後必須在最終訂單確認清單中標注（例：含免費早餐 / 享9折優惠）')
    closingToolkitSection = lines.join('\n')
  }

  // ── Top reviews for social proof ─────────────────────────────────────────
  let reviewsSection = ''
  try {
    const { data: topReviews } = await supabase
      .from('reviews')
      .select('guest_name, platform, rating, comment')
      .eq('user_id', user.id)
      .not('comment', 'is', null)
      .gte('rating', 8)
      .order('rating', { ascending: false })
      .limit(4)

    if (topReviews?.length) {
      const PLAT: Record<string, string> = {
        booking_com: 'Booking.com', agoda: 'Agoda', airbnb: 'Airbnb',
        google: 'Google', trip_com: 'Trip.com', asiayo: 'AsiaYo',
        tripadvisor: 'TripAdvisor', manual: '旅客',
      }
      const validReviews = topReviews.filter(r => r.comment && r.comment.length > 10)
      if (validReviews.length > 0) {
        reviewsSection = '\n\n【客人真實好評（社會證明）——客人猶豫或詢問品質時自然引用，勿一次全部列出】\n' +
          validReviews.map(r =>
            `${r.guest_name}（${PLAT[r.platform] ?? r.platform}）：「${r.comment!.slice(0, 80)}」⭐ ${r.rating}/10`
          ).join('\n')
      }
    }
  } catch { /* 不中斷主流程 */ }

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
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 512 } } },
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

  const langEnforcement = language !== 'auto' && language !== '繁體中文' && language !== 'zh-TW'
    ? `\n\n【語言強制規定——最高優先級】你的整個回覆必須完全使用 ${language}，包括從知識庫、定價資料、系統指令中擷取的所有內容，都必須翻譯成 ${language} 後再輸出。房型名稱（蘭博房、山景房等）可保留中文名稱，其餘全部使用 ${language}。嚴禁在回覆中夾雜任何中文字。`
    : ''

  // 優先順序：使用者自訂 system prompt > bookingFlows 自動產生 > 預設客服
  const baseInstructions = userSystemPrompt?.trim()
    ? userSystemPrompt.trim()
    : (bookingFlowEnabled
        ? buildBookingSystemPrompt(paymentInfo, bookingFlows)
        : `你是民宿的專屬業務顧問，目標是讓每位客人都能找到最適合的房型並順利預訂。語氣親切自然如朋友，主動引導客人表達需求，回答問題後立即問下一步，不讓對話冷場。客人猶豫時主動問原因並協助解決，有空房時製造溫和緊迫感。不確定的資訊請誠實說明，勿猜測。`)

  const taiwanTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })

  // ── Breakfast ordering section ────────────────────────────────────────────
  const breakfastSection = breakfastCfg
    ? `\n\n【早餐點餐助理模式】
早餐截止時間：每日 ${breakfastCfg.cutoffTime} 前
早餐送達時間：隔日 ${breakfastCfg.deliveryTime}
可用房間：${breakfastCfg.rooms.join('、')}

菜單選項：
${breakfastCfg.menu.map((item, i) => `  ${i + 1}. ${item}`).join('\n')}

當客人詢問早餐相關事項或想點餐時，啟動以下流程（每次只問一個問題）：
1. 詢問是哪個房間（若客人有多個房間，詢問此次要為哪個房間點餐）
2. 展示菜單，請客人選擇品項與份數
3. 確認客人選完後，詢問「是否還有其他房間要點？」
4. 所有房間確認完畢，向客人整理所有訂單並確認
5. 客人確認後，輸出以下格式（這行會被系統攔截，不顯示給客人）：
##BREAKFAST_ORDER##{"date":"隔天日期YYYY-MM-DD","orders":[{"room":"房間號","items":[{"name":"品項名","qty":數量}]}]}

重要規則：
- 確認截止時間前才可接受點餐，超過 ${breakfastCfg.cutoffTime} 請告知已截止
- 每個房間分開記錄
- 份數必須讓客人明確說出，不可假設
- 輸出 ##BREAKFAST_ORDER## 時不要有任何其他文字在同一行`
    : ''

  // ── Image marker extraction ────────────────────────────────────────────────
  // [圖片] markers can appear in knowledge base OR in the user's custom system prompt
  const hasImages = /\[圖片\]\s*https?:\/\//i.test(knowledgeBase + (userSystemPrompt ?? ''))
  const imageInstruction = hasImages
    ? '\n- 流程或知識庫中有 [圖片] 標記時，在回覆文字中先說「詳細圖片介紹請參考：」，接著在文字之後單獨一行輸出：[IMG:完整URL]。若URL不是圖片檔（如網頁連結），在回覆文字中直接說「詳細介紹請參考：[URL]」，不輸出[IMG:]標記。只在相關流程觸發時輸出。'
    : ''

const systemPrompt = `${baseInstructions}

【重要格式規定】
- 禁止使用任何 Markdown 語法，包含 **粗體**、*斜體*、*列點、- 列點、# 標題、--- 分隔線
- 禁止輸出任何內部思考、推理過程（THOUGHT、think、思考等區塊），直接給出最終回覆
- 計算步驟用純文字逐行呈現，例如「成人 2 位 × $800 = $1,600」，不用符號列點
- 報價禁止顯示加價乘數（× 1.15 等），直接查定價表取假日/週末價輸出；只有折扣（打折、優惠）才需標示
- 資料使用分工：初次詢問房型 → 定價計算機簡介；客人追問細節（設施/空間/特色）→ 查知識庫給具體答案，禁止二次重複簡介
- ${langInstruction}
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測
- 目前台灣時間：${taiwanTime}（系統已提供，禁止詢問客戶現在幾點或現在是否超過某時間，請自行根據上方時間判斷）${imageInstruction}

【資料安全鐵則——絕對不可違反】
密碼、房號、訂單號等「訂單專屬查詢數值」，必須且只能來自下方【外部資料查詢結果】。若無該區塊或查詢失敗，請直接告知客戶「查無資料，請聯繫工作人員」，禁止使用任何自行推測或虛構的數字。
注意：商家預設的【付款帳號】（寫在預訂流程的付款說明中）屬於固定公告資訊，不受此限制，必須在訂單完成時主動告知客人。${knowledgeBase ? `\n\n【知識庫參考資料——房型細節詢問時的唯一來源】\n以下是民宿完整介紹文件，包含每個房型的空間、設施、床型、衛浴、景觀、陽台、辦公設備等所有細節。\n\n資料使用時機（嚴格區分）：\n・客人「初次詢問」房型或方案 → 使用定價計算機的簡介列出方案與價格，不必展開細節\n・客人「進一步詢問」設施或特色（例：有浴缸嗎、陽台多大、有辦公桌嗎、哪間適合辦公、景觀如何、床型是什麼）→ 必須查閱本區塊給出具體描述，禁止再重複簡介\n・判斷原則：只要客人的問題是關於「有沒有」「多大」「哪間」「適不適合」等設施/空間/特色問題，就屬於細節詢問，應從本區塊回答\n・禁止對細節問題回答「請參考網站」或重複貼定價計算機的同一段簡介\n\n${knowledgeBase.slice(0, 20000)}` : ''}${propertyAvailSection}${closingToolkitSection}${reviewsSection}${externalDataSection}${breakfastSection}${langEnforcement}${bookingCompletionInstruction}`

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
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 2048 } },
        },
        system: systemPrompt,
        messages: msgHistory,
      })
      reply = text
    } catch (e) {
      return NextResponse.json({ error: `Gemini 呼叫失敗：${String(e).slice(0, 200)}` }, { status: 500 })
    }
  }

  const latencyMs = Date.now() - t0

  // ── Strip internal reasoning blocks leaked by the model ───────────────────
  // Step 1: remove known tagged thinking blocks
  reply = reply
    .replace(/^THOUGHT[\s\S]*?\n\n(?=\S)/i, '')
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, '')
    .replace(/^\*\*思考\*\*[\s\S]*?\n\n(?=\S)/i, '')

  // Step 2: strip leading non-Chinese reasoning paragraphs.
  // Gemini sometimes outputs English analysis/planning before the actual Chinese customer reply.
  // Scan paragraph-by-paragraph and discard everything before the first Chinese-starting paragraph.
  // Only applies when Chinese paragraphs exist (preserves full English responses for non-Chinese customers).
  {
    const paragraphs = reply.split(/\n\n+/)
    // Matches paragraph starts that are clearly customer-facing Chinese content
    const CUSTOMER_RESPONSE_START = /^[一-鿿㐀-䶿！-￮　-〿]|^好的|^您好|^謝謝|^感謝|^請問|^抱歉|^很抱歉|^非常感謝/
    const firstRespIdx = paragraphs.findIndex(p => CUSTOMER_RESPONSE_START.test(p.trimStart()))
    // firstRespIdx === -1: no Chinese → keep all (English response)
    // firstRespIdx === 0: already starts with Chinese → nothing to strip
    // firstRespIdx > 0: leading non-Chinese paragraphs → discard them
    if (firstRespIdx > 0) {
      reply = paragraphs.slice(firstRespIdx).join('\n\n')
    }
  }

  reply = reply.trim()

  // Remove surcharge calculation lines (× 1.xx = ...) — AI shows them despite instructions.
  // Discount lines (× 0.xx) are kept so customers can see the saving.
  reply = reply
    .replace(/[^\n]*×\s*1\.\d+\s*=\s*[^\n]*/g, '')  // strip surcharge lines e.g. "暑假旺季加價：$3,400 × 1.15 = $3,910"
    .replace(/\n{3,}/g, '\n\n')                        // collapse resulting blank lines

  // Strip Markdown formatting the model may output despite instructions
  reply = reply
    .replace(/\*\*(.+?)\*\*/g, '$1')              // bold
    .replace(/(?<!\d)\*(?!\d)(.+?)(?<!\d)\*(?!\d)/g, '$1') // italic — skip * adjacent to digits (multiplication sign)
    .replace(/^[\*\-] /gm, '')                     // bullet points (* or -)
    .replace(/^#{1,6} /gm, '')                     // headings
    .replace(/---+/g, '')                          // horizontal rules
    .trim()

  // ── Extract [IMG:URL] markers from reply ──────────────────────────────────
  const imgRegex = /\[IMG:(https?:\/\/[^\]]+)\]/gi
  const images: string[] = []
  let imgMatch: RegExpExecArray | null
  while ((imgMatch = imgRegex.exec(reply)) !== null) {
    images.push(imgMatch[1].trim())
  }
  // Strip [IMG:...] lines from text shown to user
  reply = reply.replace(/\[IMG:https?:\/\/[^\]]+\]\s*/gi, '').trim()

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

  return NextResponse.json({ reply, intent, risk, provider, latencyMs, summary, images })
}
