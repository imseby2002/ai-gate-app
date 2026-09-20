import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { isSafeWebhookUrl } from '@/lib/ssrf'
import { buildDeterministicQuote } from '@/lib/cs/quote'
import { buildBookingModuleQuote } from '@/lib/cs/booking-quote'
import { formatPricingForAI, queryJsonPricing, type PricingConfig } from '@/lib/cs/pricing'
import { queryGoogleSheet, type SheetConfig } from '@/lib/cs/sheet-lookup'
import { buildBookingSystemPrompt, type BookingFlowDef } from '@/lib/cs/booking-prompt'
import { sendTicketNotification, type NotifyWebhook } from '@/lib/cs/ticket-notify'
import { buildSellSection, type CsCustomerRow } from '@/lib/cs/sell-section'
import { queryBnbCheckin, checkBeforeCheckin } from '@/lib/cs/checkin-lookup'
import { getCsEntitlements } from '@/lib/cs/entitlements'
import { classifyIntentL1, generateCsReplyL2, generateCsReplyL3, generateCsReplySearch, IMAGE_DOWNGRADE_REPLY, notifyOwnerUpgradeNudge } from '@/lib/cs/csReply'
import { calculateModelCosts, estimateTextTokens } from '@/lib/ai/token-cost-tracker'
import { type CsCampaignOffer } from '@/app/api/marketing/cs-webhook/[platform]/[userId]/route'

const INTENT_CATEGORIES = [
  '產品諮詢', '價格/報價', '訂單查詢', '退換貨/退款',
  '技術支援', '投訴/抱怨', '帳號/登入問題', '一般問候', '法律/合約', '其他',
]
const HIGH_RISK_INTENTS = ['退換貨/退款', '投訴/抱怨', '法律/合約']

// Matches numbers with 8+ digits, not starting with 0, not preceded by +
const NUMERIC_ORDER_RE = /(?<!\+)\b[1-9]\d{7,}\b/

// 建立人工轉接工單並發送通知（人工客服請求、退換貨/退款皆走這條）。
// Fire-and-forget 通知（不 await，不擋回覆）。
async function dispatchHandoffTicket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    userId: string
    message: string
    history: { role: string; content: string }[]
    campaignId?: string | null
    notifyWebhooks: NotifyWebhook[]
    description: string
  },
): Promise<{ ticket: unknown; ticketNum: string }> {
  const allMsgs = [...opts.history, { role: 'user', content: opts.message }]
  const { data: ticket } = await supabase
    .from('cs_tickets')
    .insert({
      user_id: opts.userId,
      industry: 'homestay',
      platform: 'chat',
      subject: opts.message.slice(0, 80),
      description: opts.description,
      priority: 'high',
      intent: '人工客服請求',
      messages: allMsgs,
      campaign_id: opts.campaignId ?? null,
    })
    .select()
    .single()

  const ticketNum = ticket?.id?.slice(0, 8).toUpperCase() ?? '—'
  const taiwanNow = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
  const notifyMsg = `\n[AI GATE 工單]\n客人要求：${opts.message.slice(0, 80)}\n工單編號：${ticketNum}\n時間：${taiwanNow}`

  void sendTicketNotification(opts.notifyWebhooks, {
    text: notifyMsg,
    webhookExtra: { ticket, ticketNum, customerMessage: opts.message },
  })

  return { ticket, ticketNum }
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
    industry = 'homestay',
    platform = 'test',
    fromId = '',
    fromName = '',
    bookingFlowEnabled = false,
    paymentInfo = '',
    bookingFlows = [] as BookingFlowDef[],
    notifyWebhooks = [] as Array<{ id: string; type: 'line_messaging' | 'webhook'; label: string; value: string; target?: string }>,
    discountMaxPct = 0,
    discountGifts = [] as Array<{ id: string; name: string; situation: string }>,
    campaignOffers = [] as CsCampaignOffer[],
    campaignOfferSource = 'both' as 'cs' | 'booking' | 'both',
    imageBase64 = '',    // base64-encoded image from test panel
    imageMimeType = '',  // e.g. 'image/jpeg'
  } = await req.json()

  if (!message?.trim() && !imageBase64) return NextResponse.json({ error: '訊息不可為空' }, { status: 400 })

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
    const { ticket, ticketNum } = await dispatchHandoffTicket(supabase, {
      userId: user.id,
      message,
      history: history as { role: string; content: string }[],
      campaignId,
      notifyWebhooks: notifyWebhooks as NotifyWebhook[],
      description: '客人要求人工客服',
    })

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
        model: google('gemini-3.1-flash-lite'),
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

  // 資料來源偏好：價格／密碼各自可切換「訂單系統」或「客服自建資料」。
  // 預設 booking_system（維持原行為）；沒有訂單系統的用戶可切到 pricing_calculator / datasource。
  const sourcePrefs = (sources?.find(s => s.type === 'source_prefs')?.config ?? {}) as { priceSource?: string; passwordSource?: string }
  const priceFromCalculator = sourcePrefs.priceSource === 'pricing_calculator'
  const passwordFromDatasource = sourcePrefs.passwordSource === 'datasource'

  // 取出早餐設定
  const breakfastSource = sources?.find(s => s.type === 'breakfast_webhook')
  const breakfastCfg = breakfastSource?.config as {
    webhookUrl: string; cutoffTime: string; deliveryTime: string
    rooms: string[]; menu: string[]
  } | undefined

  // 偵測前端送來的確認封包，POST 到 Apps Script
  if (breakfastCfg?.webhookUrl) {
    const confirmMatch = message.match(/^##BREAKFAST_ORDER##(.+)$/)
    if (confirmMatch && isSafeWebhookUrl(breakfastCfg.webhookUrl)) {
      try {
        await fetch(breakfastCfg.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: confirmMatch[1],
        })
      } catch { /* 不中斷主流程 */ }
    }
  }

  // ── FAQ 知識庫注入 ────────────────────────────────────────────────────────
  const faqSource = sources?.find(s => s.type === 'faq')
  let faqSection = ''
  if (faqSource?.config) {
    interface FaqItem { q: string; a: string; keywords: string[] }
    const items: FaqItem[] = (faqSource.config as { items?: FaqItem[] }).items ?? []
    const msgLower = message.toLowerCase()
    const matched = items.filter(item =>
      item.keywords?.some(kw => kw.trim() && msgLower.includes(kw.trim().toLowerCase()))
    )
    if (matched.length > 0) {
      faqSection = `\n\n【FAQ 知識庫（以下是經過人工確認的標準答案，遇到類似問題時直接引用）】\n` +
        matched.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n\n')
    }
  }

  const sheetResults: string[] = []
  if (sources?.length) {
    await Promise.all(sources.map(async (src) => {
      let result: string | null = null
      if (src.type === 'faq' || src.type === 'source_prefs') {
        return // FAQ 單獨處理；source_prefs 只是偏好設定，非查詢資料來源
      } else if (src.type === 'json_pricing') {
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

  // ── BnB Daily Records：訂單號碼 → 今日密碼查詢（優先於 Google Sheets）──────
  // 密碼來源切到「資料來源（訂單密碼表）」時跳過此步，改由 Google Sheets 等資料來源注入比對。
  const bnbOrderNum = message.match(NUMERIC_ORDER_RE)?.[0] ?? null
  if (bnbOrderNum && !passwordFromDatasource) {
    try {
      const bnbResult = await queryBnbCheckin(supabase, user.id, bnbOrderNum)
      if (bnbResult) sheetResults.unshift(bnbResult)  // 插到最前面，確保優先被 AI 引用
    } catch { /* 不中斷主流程 */ }
  }

  const hasPricing = sources?.some(s => s.type === 'json_pricing' && sheetResults.some(r => r.includes(s.name)))

  // Authoritative server-side quote. Prefer the booking module (Plan A) so bot quotes
  // match online booking; fall back to json_pricing config if no property matches.
  let deterministicQuoteSection = ''
  if (bookingFlowEnabled) {
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    // 價格來源切到「定價計算機」時跳過訂單系統算價，直接 fallback 用 json_pricing 設定。
    const bq = priceFromCalculator
      ? null
      : await buildBookingModuleQuote(supabase, user.id, google('gemini-3.1-flash-lite'), convUserText, todayIso)
    if (bq) {
      deterministicQuoteSection = `\n\n${bq}`
    } else if (sources?.length) {
      const pricingCfgs = sources.filter(s => s.type === 'json_pricing').map(s => s.config as PricingConfig)
      if (pricingCfgs.length) {
        const lc = convUserText.toLowerCase()
        const cfg = pricingCfgs.find(c => (c.triggerKeywords ?? []).some(kw => kw && lc.includes(kw.toLowerCase()))) ?? pricingCfgs[0]
        const q = await buildDeterministicQuote(google('gemini-3.1-flash-lite'), cfg, convUserText, todayIso)
        if (q) deterministicQuoteSection = `\n\n${q}`
      }
    }
  }

  // Detect numeric order number and sensitive-data intent
  const detectedOrderNum = message.match(NUMERIC_ORDER_RE)?.[0] ?? null
  const hasSheetSources = sources?.some(s => s.type !== 'json_pricing' && s.type !== 'breakfast_webhook' && s.type !== 'source_prefs' && s.enabled)
  const hasNumericSheetSources = sources?.some(s =>
    s.type !== 'json_pricing' && s.type !== 'breakfast_webhook' && s.type !== 'source_prefs' && s.enabled &&
    (s.config as SheetConfig).triggerMode === 'numeric'
  )

  // Keywords that suggest the user wants check-in/password info but hasn't given an order number
  const SENSITIVE_INTENT_KEYWORDS = ['入住', '密碼', '房號', '開門', 'check in', 'checkin', '鑰匙', '門鎖', '訂單', '查詢']
  const hasSensitiveIntent = SENSITIVE_INTENT_KEYWORDS.some(kw => message.toLowerCase().includes(kw.toLowerCase()))

  // 入住時間判斷（兩種密碼來源共用）：未到入住時間，即使資料含密碼也禁止提供
  const checkin = await checkBeforeCheckin(supabase, user.id)

  let externalDataSection = ''
  if (sheetResults.length > 0) {
    const hasBnbCheckinResult = sheetResults.some(r => r.includes('【入住資訊查詢結果】'))
    const guard = (detectedOrderNum && checkin.before && !hasBnbCheckinResult)
      ? `\n\n【系統強制指令——最高優先】目前台灣時間 ${checkin.nowHHMM} 尚未到入住時間（${checkin.checkinTime}）。即使下方資料含密碼或房號，也一律禁止提供；你只能告知客人：入住時間為今日 ${checkin.checkinTime}，請於該時間後再輸入訂單號碼查詢。`
      : ''
    externalDataSection = guard + `\n\n【外部資料查詢結果】\n${sheetResults.join('\n\n')}\n${hasPricing ? '計算價格時請逐步列式，嚴格使用以上定價表數字，不得估算。' : '請根據以上資料回覆客戶，資料中沒有的欄位請勿捏造。'}`
  } else if (hasNumericSheetSources && hasSensitiveIntent && !detectedOrderNum) {
    externalDataSection = checkin.before
      ? `\n\n【系統強制指令——立即執行】目前台灣時間 ${checkin.nowHHMM} 尚未到入住時間（${checkin.checkinTime}）。你的下一句話只能是：「您好，入住時間為今日 ${checkin.checkinTime}，目前尚未到入住時間，請於 ${checkin.checkinTime} 後輸入您的訂單號碼，我們將為您提供入住資訊。」禁止問其他問題。`
      : `\n\n【系統強制指令——立即執行，不得有其他動作】目前已到入住時間（${checkin.checkinTime}）。你的下一句話只能是：「請提供您的訂單號碼或預訂時的行動電話號碼，我馬上為您查詢入住資訊。」禁止問時間、禁止問其他問題，直接問號碼。`
  } else if (detectedOrderNum && hasSheetSources && sheetResults.length === 0) {
    externalDataSection = `\n\n【系統指令】偵測到訂單號「${detectedOrderNum}」但外部資料表查無結果（API設定錯誤或號碼不存在）。請告知客戶查無此號碼，請確認號碼是否正確或聯繫工作人員，禁止捏造任何密碼或房號。`
  }

  // ── Property & booking availability context ───────────────────────────────
  let propertyAvailSection = ''
  try {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name, description, max_guests, base_price, extra_guest_fee, max_extra_beds, extra_bed_fee, dynamic_pricing_enabled')
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

      const lines: string[] = ['【房源與價目／訂單狀況（系統即時資料，報價一律以此為準）】']
      for (const p of properties) {
        const feeNote = p.extra_guest_fee ? `，超過加收 $${Number(p.extra_guest_fee).toLocaleString()}/人/晚` : ''
        const bedNote = p.max_extra_beds > 0 ? `，可加床最多 ${p.max_extra_beds} 床${p.extra_bed_fee ? `（$${Number(p.extra_bed_fee).toLocaleString()}/床/晚）` : ''}` : ''
        const dynNote = p.dynamic_pricing_enabled ? '（假日/特定日期價格另計，請客人提供入住日期以精算實際房價）' : ''
        lines.push(`\n▸ ${p.name}${p.description ? `（${p.description}）` : ''}，最多 ${p.max_guests ?? '—'} 人，基本價 $${p.base_price ?? '—'}/晚${feeNote}${bedNote}${dynNote}`)
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
  const giftList = (discountGifts ?? []) as Array<{ id: string; name: string; situation: string }>
  const hasGifts = giftList.length > 0

  if (hasDiscount || hasGifts) {
    const lines = ['\n\n【促成/賠禮工具箱——折扣跟贈品不會同時給，一次只選一種】']
    lines.push('情境一・成交前客人對價格猶豫或嫌貴（例如「有點貴」「我再想想」「比較一下」「考慮看看」）：')
    if (hasDiscount) lines.push(`可從以下擇一：折扣最多 ${discountMaxPct}% off（算出折後金額告知客人），或下面贈品挑一項情境相符的——兩者只能選一個。`)
    else if (hasGifts) lines.push('可從下面贈品清單挑一項情境相符的送給客人。')
    lines.push('情境二・客人已消費/入住後客訴或不開心（跟價格無關）：只能從贈品清單挑一項當賠禮，不可以打折。')
    if (hasGifts) {
      lines.push('\n贈品清單（依情境挑選最合適的一項）：')
      giftList.forEach(g => lines.push(`• ${g.name}${g.situation ? `（適用情境：${g.situation}）` : ''}`))
    }
    lines.push('\n重要：優惠確認後必須在最終訂單確認清單中標注（例：含免費早餐 / 享9折優惠）')
    closingToolkitSection = lines.join('\n')
  }

  // ── Active campaign & subsidy offers (CS 自訂活動 vs Booking 訂房活動) ─────
  let campaignOffersSection = ''
  const offerLines: string[] = []

  // 1. CS 客服自訂活動 (當模式為 'cs' 或 'both')
  if (campaignOfferSource === 'cs' || campaignOfferSource === 'both') {
    const activeOffers: CsCampaignOffer[] = ((campaignOffers ?? []) as CsCampaignOffer[]).filter((o: CsCampaignOffer) => o.enabled)
    if (activeOffers.length > 0) {
      offerLines.push('【CS 客服促銷／補助活動（若客問優惠、補助或計算房價時主動說明與折抵）】')
      for (const off of activeOffers) {
        offerLines.push(`▸ 活動名稱：${off.name}（${off.canStack ? '可與其他優惠/早鳥疊加併用' : '不可疊加，採二擇一最優原則'}）`)
        if (off.qualification) offerLines.push(`  適用資格與對象：${off.qualification}`)
        if (off.offerType === 'nights_tiered' && off.tieredNightDiscounts?.length) {
          const tieredDesc = off.tieredNightDiscounts.map((amt: number, idx: number) => `第 ${idx + 1} 晚折抵 $${amt.toLocaleString()} 元`).join('，')
          offerLines.push(`  折扣計算方式：連住每晚階梯折抵（${tieredDesc}）`)
        } else if (off.offerType === 'percent' && off.discountPercent) {
          offerLines.push(`  折扣計算方式：享 ${10 - off.discountPercent / 10} 折優惠（折抵 ${off.discountPercent}%）`)
        } else if (off.offerType === 'fixed_amount' && off.discountAmount) {
          offerLines.push(`  折扣計算方式：單筆固定折抵 $${off.discountAmount.toLocaleString()} 元`)
        } else {
          offerLines.push(`  折扣計算方式：自訂方案`)
        }
        offerLines.push(`  優惠疊加原則：${off.canStack ? '本活動允許與其他促銷折扣、早鳥特惠或折扣碼同時累加折抵' : '本活動不可與其他早鳥或促銷折扣同時併用（客人可選最優惠的一種專案）'}`)
        if (off.rulesNote) offerLines.push(`  活動規則與限制：${off.rulesNote}`)
      }
    }
  }

  // 2. Booking 訂房系統活動 (當模式為 'booking' 或 'both')
  if (campaignOfferSource === 'booking' || campaignOfferSource === 'both') {
    try {
      const [rulesRes, promosRes] = await Promise.all([
        supabase.from('pricing_rules').select('name, rule_type, adjustment_type, adjustment_value, conditions, can_stack').eq('user_id', user.id).eq('enabled', true),
        supabase.from('promo_codes').select('code, name, type, value, min_nights, can_stack').eq('user_id', user.id).eq('enabled', true),
      ])
      const bRules = rulesRes.data ?? []
      const bPromos = promosRes.data ?? []
      if (bRules.length > 0 || bPromos.length > 0) {
        offerLines.push('\n【Booking 訂房系統動態優惠（早鳥／晚鳥與促銷代碼）】')
        for (const r of bRules) {
          const adj = r.adjustment_type === 'percent' ? `享 ${10 - (r.adjustment_value / 10)} 折（折 ${r.adjustment_value}%）` : `折抵 $${r.adjustment_value} 元`
          const cond = (r.conditions as Record<string, unknown>)?.days_before != null ? `（入住前 ${(r.conditions as Record<string, unknown>).days_before} 天以上預訂）` : ''
          const stackNote = r.can_stack ? '【可與其他優惠/代碼疊加】' : '【單獨適用，不可疊加】'
          offerLines.push(`▸ 訂房特惠：${r.name} - ${adj} ${cond} ${stackNote}`)
        }
        for (const p of bPromos) {
          const discount = p.type === 'percent' ? `享 ${10 - (p.value / 10)} 折` : `折抵 $${p.value} 元`
          const stackNote = p.can_stack ? '【可與其他優惠疊加】' : '【單獨適用，不可疊加】'
          offerLines.push(`▸ 訂房優惠碼：【${p.code}】${p.name ? `（${p.name}）` : ''} - ${discount}${p.min_nights > 1 ? `，需滿 ${p.min_nights} 晚` : ''} ${stackNote}`)
        }
      }
    } catch {
      // ignore
    }
  }

  if (offerLines.length > 0) {
    offerLines.push('\n計算與應對守則：')
    offerLines.push('1. 當客人詢問「國旅補助」、「有沒有優惠」、「連住有沒有打折」或詢問房價時，主動告知上述正在進行中的補助/優惠活動。')
    offerLines.push('2. 計算總價時，以房價定價為基準，嚴格依照各活動設定之折抵金額與「是否可疊加」規則進行計算：若標註「可疊加」則可合併折抵；若標註「不可疊加」則採二擇一最優惠金額折抵，並清楚向客人列出原價、各項折抵與實付金額。')
    offerLines.push('3. 喬民宿適用當期國旅補助（合法旅宿），依規定於入住時出示身分證件正本現場核銷。')
    campaignOffersSection = '\n\n' + offerLines.join('\n')
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

  // ── Intent classification (L1：Groq 8B 分流，免費通道與直連 Gemini 依序備援) ──
  const knowledgeSection = knowledgeBase
    ? `\n\n【知識庫】\n${knowledgeBase.slice(0, 3000)}`
    : ''

  const classified = await classifyIntentL1(message, INTENT_CATEGORIES, knowledgeSection)
  const intent = classified.intent
  const summary = classified.summary
  const needsSearch = classified.needsSearch
  let risk: string = classified.risk
  if (HIGH_RISK_INTENTS.includes(intent)) risk = 'high'

  const { features: planFeatures } = await getCsEntitlements(supabase, user.id)

  // ── 退換貨/退款：一律轉人工（沒有任何方案支援 AI 自動執行退款）────────────
  if (intent === '退換貨/退款') {
    const { ticket, ticketNum } = await dispatchHandoffTicket(supabase, {
      userId: user.id,
      message,
      history: history as { role: string; content: string }[],
      campaignId,
      notifyWebhooks: notifyWebhooks as NotifyWebhook[],
      description: '客人提出退換貨/退款需求',
    })

    return NextResponse.json({
      reply: `好的，退換貨/退款需要專人為您處理，已為您建立服務工單（編號：${ticketNum}），客服專員將盡快與您聯繫，請稍候。`,
      intent, risk: 'high', provider: 'system', latencyMs: Date.now() - t0,
      summary, images: [], ticketCreated: true, ticket,
    })
  }

  // ── L3 圖片辨識門檻：免費層不解鎖，文字降級 + 通知老闆升級（省成本，不呼叫 AI）──
  const customerSentImage = !!(imageBase64 && imageMimeType)
  if (customerSentImage && !planFeatures.advancedSupport) {
    void notifyOwnerUpgradeNudge(user.id, 'image', message || '（客人傳送圖片）')
    return NextResponse.json({
      reply: IMAGE_DOWNGRADE_REPLY,
      intent, risk, provider: 'system', latencyMs: Date.now() - t0,
      summary, images: [],
    })
  }

  // 免費層客訴：AI 照常回覆（走 L2），但同步提醒老闆升級可解鎖更完整的客訴處理
  if (risk === 'high' && intent === '投訴/抱怨' && !planFeatures.advancedSupport) {
    void notifyOwnerUpgradeNudge(user.id, 'complaint', message)
  }

  // ── Customer recognition & price-ask tracking ─────────────────────────────
  // 偵測「第幾次問價」用於業務話術；認得回頭客；累計追蹤資料。
  const PRICE_RE = /價格|價錢|價位|多少錢|費用|報價|怎麼算|多少|預算|划算|便宜|折扣|優惠|price|cost|how much|rate|quote|budget|discount/i
  const convoPriceAsks =
    [...(history as { role: string; content: string }[])
      .filter(m => m.role === 'user').map(m => m.content), message]
      .filter(t => PRICE_RE.test(t)).length
  const isPriceAskNow = PRICE_RE.test(message)

  let customer: CsCustomerRow | null = null
  if (fromId) {
    try {
      const { data } = await supabase
        .from('cs_customers')
        .select('name, summary, stage, price_ask_count, message_count, discount_offered_at, facts')
        .eq('user_id', user.id).eq('platform', platform).eq('from_id', fromId).eq('industry', industry)
        .single()
      customer = (data as CsCustomerRow | null) ?? null
    } catch { /* 表可能尚未建立，略過追蹤 */ }
  }
  const knownName = (fromName || customer?.name || '').trim()

  // 客戶上下文 + 業務模式（只在客人猶豫時才啟動）
  const customerSection = buildSellSection(customer, convoPriceAsks, isPriceAskNow, message)

  // ── Build system prompt ───────────────────────────────────────────────────
  // 免費方案不解鎖 Claude 升級，測試分頁的行為要跟正式客服一致（planFeatures 已於 L1 分流後取得）
  const claudeAllowed = planFeatures.claudeEscalation !== 'off'
  const shouldEscalate =
    claudeAllowed &&
    (risk === 'high' ||
      (escalationThreshold === 'medium' && (risk === 'medium' || risk === 'high')))

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
        : `你是民宿的 AI 客服。直接回答客人問題，語氣親切自然。不確定的資訊請誠實說明，勿猜測。`)

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
- 【AI 身分透明與自然呈現規則】開場或新的一輪對話開頭主動親切表明自己是 AI 客服助理（例如：「您好！我是喬民宿的 AI 智慧助理 小喬🌸，很高興為您服務！」）；接續日常問答直球回答即可，無需每句重複囉嗦署名；遇退款、查無訂單或需要管家協助時，說明「我是 AI 助理小喬，會為您轉交真人管家核對確認」，讓客人明確了解是由 AI 為其服務。
- 【對話極度精簡、直球回答、禁止囉嗦廢話與嚴禁句尾慣性追問——最高禁令】回覆一律精簡扼要，直中要害，禁止堆砌客套話或自說自話！回答完客人的問題即立刻結束，【絕對禁止】在句尾習慣性加上「請問您想了解哪間呢？」、「請問這樣清楚嗎？」、「您想先確認哪一項呢？」等任何多餘追問！當客人只是陳述事實、告知資訊（如「了解」、「好的」、「已匯款」）或禮貌道謝（如「謝謝」），只需簡短禮貌回應，嚴禁強行反問！凡對話紀錄中已出現過之資訊，嚴禁再次詢問！客人若未主動詢問行程，【嚴禁】在每次回答句尾強推賞鯨或烏石港搭船提醒！
- 【優惠與活動折抵原則——最高原則，嚴禁重複疊加折扣，嚴禁虛報2,600定價】本民宿房間平日一般售價為：201龜山加大床房2,000元、202蘭博1,800元、302山景1,800元、401露臺2,200元、301海景2,500元。本民宿絕無2,600元等虛高門牌定價，絕對禁止向客人報2,600元！若客人要使用促銷或補助活動，一律以【平日一般售價（如龜山房2,000元）】為基準折抵，嚴格依照【現正進行中的促銷／補助活動】規則辦理。所有優惠（早鳥8折等）與活動補助採獨立計算二擇一，絕對不可在早鳥價上再重複扣補助！
- ${langInstruction}
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測
- 目前台灣時間：${taiwanTime}（系統已提供，禁止詢問客戶現在幾點或現在是否超過某時間，請自行根據上方時間判斷）${imageInstruction}

【資料安全鐵則——絕對不可違反】
密碼、房號、訂單號等「訂單專屬查詢數值」，必須且只能來自下方【外部資料查詢結果】。若無該區塊或查詢失敗，請直接告知客戶「查無資料，請聯繫工作人員」，禁止使用任何自行推測或虛構的數字。
注意：商家預設的【付款帳號】（寫在預訂流程的付款說明中）屬於固定公告資訊，不受此限制，必須在訂單完成時主動告知客人。${knowledgeBase ? `\n\n【知識庫參考資料——房型細節詢問時的唯一來源】\n以下是民宿完整介紹文件，包含每個房型的空間、設施、床型、衛浴、景觀、陽台、辦公設備等所有細節。\n\n資料使用時機（嚴格區分）：\n・客人「初次詢問」房型或方案 → 使用定價計算機的簡介列出方案與價格，不必展開細節\n・客人「進一步詢問」設施或特色（例：有浴缸嗎、陽台多大、有辦公桌嗎、哪間適合辦公、景觀如何、床型是什麼）→ 必須查閱本區塊給出具體描述，禁止再重複簡介\n・判斷原則：只要客人的問題是關於「有沒有」「多大」「哪間」「適不適合」等設施/空間/特色問題，就屬於細節詢問，應從本區塊回答\n・禁止對細節問題回答「請參考網站」或重複貼定價計算機的同一段簡介\n\n${knowledgeBase.slice(0, 20000)}` : ''}${customerSection}${campaignOffersSection}${propertyAvailSection}${closingToolkitSection}${reviewsSection}${faqSection}${externalDataSection}${deterministicQuoteSection}${breakfastSection}${langEnforcement}${bookingCompletionInstruction}`

  // Build user turn — multimodal when image is provided
  type MsgContent = string | Array<{ type: 'text'; text: string } | { type: 'image'; image: Uint8Array; mimeType: string }>
  const userTurnContent: MsgContent = (imageBase64 && imageMimeType)
    ? [
        ...(message?.trim() ? [{ type: 'text' as const, text: message }] : [{ type: 'text' as const, text: '客人傳送了一張圖片' }]),
        { type: 'image' as const, image: new Uint8Array(Buffer.from(imageBase64, 'base64')), mimeType: imageMimeType },
      ]
    : message

  const msgHistory = [
    ...history.slice(-6).map((h: { role: string; content: string }) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user' as const, content: userTurnContent },
  ]

  let reply = ''
  let provider = 'FreeLLM'

  // High-risk (投訴/退款) → Claude Sonnet directly, no proxy
  if (shouldEscalate) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      provider = 'Claude'
      try {
        const anthropic = createAnthropic({ apiKey: anthropicKey })
        const { text } = await generateText({
          model: anthropic('claude-sonnet-4-6'),
          system: systemPrompt,
          messages: msgHistory,
        })
        reply = text
      } catch { /* fall through to CS chain */ }
    }
  }

  // Normal CS：advancedSupport 方案的搜尋需求走搜尋分支、圖片／中等複雜問題走 L3（gemini-3-flash），其餘走 L2（Groq Qwen3.6 27B 為主力）
  if (!reply) {
    const useSearch = planFeatures.webSearch && needsSearch
    const useL3 = !useSearch && planFeatures.advancedSupport && (customerSentImage || risk === 'medium')
    const result = useSearch
      ? await generateCsReplySearch(systemPrompt, msgHistory)
      : useL3
        ? await generateCsReplyL3(systemPrompt, msgHistory)
        : await generateCsReplyL2(systemPrompt, msgHistory)
    if (result) {
      reply = result.reply
      provider = result.provider
    } else {
      return NextResponse.json({ error: '所有模型失敗，請稍後再試' }, { status: 500 })
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

  // ── Persist customer tracking ─────────────────────────────────────────────
  if (fromId) {
    try {
      let stage = customer?.stage ?? 'new'
      if (/預訂|預約|確認|成交|下單|報名|訂位/.test(intent)) stage = 'won'
      else if (convoPriceAsks >= 2) stage = 'negotiating'
      else if (isPriceAskNow) stage = 'quoted'
      else if (stage === 'new') stage = 'inquiring'
      await supabase.from('cs_customers').upsert({
        user_id: user.id,
        platform,
        from_id: fromId,
        industry,
        name: knownName || customer?.name || null,
        stage,
        price_ask_count: (customer?.price_ask_count ?? 0) + (isPriceAskNow ? 1 : 0),
        message_count: (customer?.message_count ?? 0) + 1,
        last_intent: intent,
        summary: summary || customer?.summary || null,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform,from_id,industry' })
    } catch { /* 表可能尚未建立，略過追蹤 */ }
  }

  // ── Record AI Usage for CS Chat ──
  try {
    const inTokens = estimateTextTokens(message) + 150
    const outTokens = estimateTextTokens(reply)
    let modelId = 'groq-qwen3-32b'
    let sourceChannel: 'cliproxy' | 'freellm' | 'groq' | 'google' = 'groq'

    if (provider?.includes('CLIProxy')) {
      modelId = 'cliproxy:gemini-3-flash'
      sourceChannel = 'cliproxy'
    } else if (provider?.includes('FreeLLM')) {
      modelId = 'freellm:glm-4.7-flash'
      sourceChannel = 'freellm'
    } else if (provider?.includes('Gemini')) {
      modelId = 'gemini-2.0-flash'
      sourceChannel = 'google'
    }

    const costs = calculateModelCosts(modelId, inTokens, outTokens, sourceChannel)
    const finishReasonMeta = JSON.stringify({
      source: sourceChannel,
      model: modelId,
      savedUsd: costs.savedCostUsd,
      isFree: costs.isFree,
      service: 'cs',
    })

    await supabase.from('messages').insert({
      user_id: user.id,
      conversation_id: null,
      role: 'assistant',
      content: reply.slice(0, 500),
      model_id: modelId,
      input_tokens: inTokens,
      output_tokens: outTokens,
      cost_usd: costs.actualCostUsd,
      latency_ms: latencyMs,
      finish_reason: finishReasonMeta,
    })

    const today = new Date().toISOString().split('T')[0]
    const { data: existingUd } = await supabase
      .from('usage_daily')
      .select('id, message_count, input_tokens, output_tokens, total_cost_usd')
      .eq('user_id', user.id)
      .eq('model_id', modelId)
      .eq('date', today)
      .maybeSingle()

    if (existingUd) {
      await supabase.from('usage_daily').update({
        message_count: (existingUd.message_count || 0) + 1,
        input_tokens: (existingUd.input_tokens || 0) + inTokens,
        output_tokens: (existingUd.output_tokens || 0) + outTokens,
        total_cost_usd: (existingUd.total_cost_usd || 0) + costs.actualCostUsd,
      }).eq('id', existingUd.id)
    } else {
      await supabase.from('usage_daily').insert({
        user_id: user.id,
        model_id: modelId,
        date: today,
        message_count: 1,
        input_tokens: inTokens,
        output_tokens: outTokens,
        total_cost_usd: costs.actualCostUsd,
      })
    }
  } catch (usageErr) {
    console.error('[cs-chat] usage recording error:', usageErr)
  }

  return NextResponse.json({ reply, intent, risk, provider, latencyMs, summary, images })
}
