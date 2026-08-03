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
import { generateText, type LanguageModel } from 'ai'
import { buildDeterministicQuote } from '@/lib/cs/quote'
import { buildBookingModuleQuote } from '@/lib/cs/booking-quote'
import { queryBnbCheckin, checkBeforeCheckin, queryBookingByGuestName } from '@/lib/cs/checkin-lookup'
import { getCsEntitlements } from '@/lib/cs/entitlements'
import { generateCsReplyL2, generateCsReplyL3, generateCsReplySearch, IMAGE_DOWNGRADE_REPLY, notifyOwnerUpgradeNudge } from '@/lib/cs/csReply'
import { findLatestPendingApproval, resumeRunAfterApproval } from '@/lib/agents/approvals'
import type { CsFormField, CsFormNotifyTarget } from '@/app/api/marketing/cs-forms/route'
import { formatFormSubmission, notifyFormSubmission } from '@/lib/cs/formNotify'

// Agent 核准請求走這個 webhook 通知老闆自己的 LINE（見 src/lib/agents/notify.ts），
// 老闆用同一個 LINE 帳號回覆時走這裡辨識，不會被當成一般客服訊息處理。
//
// 注意：只做「完整訊息＝關鍵字」的精確比對，不做 startsWith 前綴比對。
// 「好」「可以」「OK」這類極常見的中文口頭禪常常只是句子開頭（例如「好，我再想想」
// 「可以先不要嗎」），若用前綴比對會被誤判成核准/拒絕，直接執行掉真的會送出的動作
// （發客戶訊息、開 PR、改帳務）。老闆若有待核准項目卻傳來不是完整關鍵字的訊息，
// 一律歸類為 feedback（原樣記錄供 Agent 參考），不會自動核准或拒絕。
const AGENT_APPROVE_KEYWORDS = ['核准', '通過', '同意', 'ok', 'okay', 'approve', 'approved', 'yes', '好', '好的', '可以', '👍', '✅']
const AGENT_REJECT_KEYWORDS = ['拒絕', '不行', '不同意', 'no', 'reject', 'rejected', '不可以', '❌']

// 去除常見句尾標點（。！.!～~）後再比對，讓「同意。」「OK!」也算精確符合
function normalizeApprovalText(text: string): string {
  return text.trim().toLowerCase().replace(/[。！!.～~\s]+$/g, '')
}

function detectAgentApprovalOutcome(text: string): 'approved' | 'rejected' | 'feedback' {
  const normalized = normalizeApprovalText(text)
  if (AGENT_APPROVE_KEYWORDS.some(kw => normalized === kw.toLowerCase())) return 'approved'
  if (AGENT_REJECT_KEYWORDS.some(kw => normalized === kw.toLowerCase())) return 'rejected'
  return 'feedback'
}

// ── Supabase service role client ───────────────────────────────────────────────
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// LINE 省額度：暫存「AI 未使用」的 reply token 供收件匣 1 分鐘內免費回覆；
// token 為空字串代表 AI 已用掉 → 清除。表未建立時靜默略過（自動 fallback Push）。
async function persistLineReplyToken(userId: string, platform: string, fromId: string, replyToken: string) {
  if (platform !== 'line' && platform !== 'line-oa') return
  try {
    const sb = getServiceClient()
    if (!replyToken) {
      await sb.from('cs_reply_tokens').delete()
        .eq('user_id', userId).eq('platform', platform).eq('from_id', fromId)
    } else {
      await sb.from('cs_reply_tokens').upsert(
        { user_id: userId, platform, from_id: fromId, reply_token: replyToken, created_at: new Date().toISOString() },
        { onConflict: 'user_id,platform,from_id' }
      )
    }
  } catch { /* 表可能尚未建立，不中斷主流程 */ }
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

// 偵測猶豫關鍵字
const HESITATION_RE = /考慮|再想想|比較|猶豫|還沒決定|再看看|回頭|之後再|有點貴|太貴|划算|值得嗎|其他家|別家|下次|想一下|想想看|不確定|先問問|問一下/

// 業務輔助只在客人猶豫時才啟動；平時只保留客戶上下文
function buildSellSection(cust: CsCustomerRow | null, convoPriceAsks: number, isPriceAskNow: boolean, currentMessage: string): string {
  const lines: string[] = []

  // 客戶記憶：永遠保留（不影響話術）
  if (cust?.name) lines.push(`\n\n客戶稱呼：${cust.name}，請自然稱呼對方。`)
  if (cust?.summary) lines.push(`回頭客背景：「${cust.summary}」，勿重問已知資訊。`)

  // 偵測猶豫：關鍵字 OR 第 2 次以上問價 OR 已在 negotiating 階段
  const isHesitating = HESITATION_RE.test(currentMessage) || convoPriceAsks >= 2 || cust?.stage === 'negotiating'

  if (isHesitating) {
    lines.push('\n\n【客戶正在猶豫——此刻才啟動業務模式】同理客戶的考量，簡短找出真正顧慮，提供一個具體誘因或解法，最後用二選一收尾推進決定。語氣溫暖，不施壓，不拖長篇幅。')
  }

  // 報價提示：只加一句，不展開銷售話術
  if (isPriceAskNow && !isHesitating) {
    lines.push('\n\n【報價提醒】報完價後問一個關鍵需求（日期或人數），以便推薦最適方案。')
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

// gapNote 提示 AI 這通訊息與上一則客人訊息間隔多久：間隔久（新的一輪對話）可以正常
// 重新問候；間隔短（同一輪對話進行中）則要接續上一則問題，不能重新問候或重新列選單。
// 沒有這個提示時，AI 只能靠訊息內容自行判斷，容易誤判成需要重新開始。
const CONVERSATION_GAP_HOURS = 3

async function loadHistory(userId: string, customerId: string): Promise<{ history: HistoryMsg[]; gapNote: string }> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('cs_conversations')
    .select('history, updated_at')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .single()
  // PGRST116 = no row found，正常情況（新客人）；其他錯誤代表對話記憶讀取失敗，
  // 若靜默吞掉，AI 會誤以為每次都是全新對話、完全沒有上下文，務必記錄。
  if (error && error.code !== 'PGRST116') console.error('[cs-webhook] loadHistory failed:', error)
  const history = (data?.history as HistoryMsg[]) ?? []

  let gapNote = ''
  if (history.length && data?.updated_at) {
    const hoursSince = (Date.now() - new Date(data.updated_at).getTime()) / 3_600_000
    gapNote = hoursSince >= CONVERSATION_GAP_HOURS
      ? `距離客人上一則訊息已經過了約 ${Math.round(hoursSince)} 小時，可視為新的一輪對話：請簡短重新問候並確認需求，不必假設客人還記得先前的流程進度。`
      : '這是同一輪對話的延續：客人剛剛的回覆通常是在回答你上一則問的問題，請直接接續判斷並回答下一步，不要重新問候或重新列出主選單。'
  }

  return { history, gapNote }
}

async function saveHistory(userId: string, customerId: string, history: HistoryMsg[]) {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('cs_conversations')
    .upsert(
      { user_id: userId, customer_id: customerId, history: history.slice(-20), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,customer_id' }
    )
  if (error) console.error('[cs-webhook] saveHistory failed:', error)
}

// 平台 webhook（尤其 LINE）在我們回應太慢或網路重試時會重送同一個事件；沒有防重會
// 讓同一句客人訊息被回覆兩次（甚至兩次答案還不一樣，因為 LLM 生成本身非決定性）。
// 用 (platform, event_id) 當唯一鍵搶插入：搶到的人繼續處理，搶不到（重複）就跳過。
async function isDuplicateEvent(platform: string, eventId: string): Promise<boolean> {
  if (!eventId) return false
  const { error } = await getServiceClient().from('cs_processed_events').insert({ platform, event_id: eventId })
  if (!error) return false
  if (error.code === '23505') return true  // 違反唯一鍵 → 確定是重複事件
  // 其他錯誤（網路、表格問題）一律當作沒重複，寧可偶爾重覆回覆，也不能因此漏回客人的訊息
  console.error('[cs-webhook] isDuplicateEvent insert failed:', error)
  return false
}

// ── Persist a customer turn to cs_messages (powers the dashboard metrics) ─────
async function logCsMessage(userId: string, platform: string, customerId: string, industry: string, message: string, reply: string, fromName?: string) {
  try {
    await getServiceClient().from('cs_messages').insert({
      user_id: userId, industry, platform, from_id: customerId, from_name: fromName ?? null, message, reply,
    })
  } catch { /* metrics logging must never break the reply flow */ }
}

// LINE 的 userId（U + 32 hex）在畫面上完全看不出是誰，call 一次 Profile API 換顯示名稱。
// 先查 cs_messages 有沒有存過這個客人的名字，省下重複呼叫 LINE API。
async function resolveLineDisplayName(userId: string, customerId: string, token: string): Promise<string | undefined> {
  try {
    const { data } = await getServiceClient()
      .from('cs_messages').select('from_name')
      .eq('user_id', userId).eq('from_id', customerId)
      .not('from_name', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data?.from_name) return data.from_name as string
  } catch { /* 表可能尚未建立，往下改用 API 查詢 */ }

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return undefined
    const d = await res.json()
    return d.displayName ?? undefined
  } catch { return undefined }
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
// 退換貨/退款：沒有任何方案支援 AI 自動執行，一律轉人工（L3 決策）
const REFUND_RE = /退款|退費|退貨|取消訂單|refund|cancel.*order/i
// 免費層客訴偵測：AI 照常回覆，但額外通知老闆有升級空間
const COMPLAINT_RE = /投訴|抱怨|complaint/i
// 需要即時網路資訊（天氣、附近景點、路況等知識庫不會有的即時資料）僅 PRO+ 觸發搜尋分支
const SEARCH_RE = /天氣|氣溫|下雨|附近|景點|怎麼走|路況|交通|開了嗎|營業中嗎|weather|nearby|traffic/i

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

// ── 專員訂單通知（LINE OA push；LINE Notify 已停用，改用個人 LINE 加 OA）─────────
// LINE OA push（主動推播，非 reply）
async function pushLine(to: string, text: string, token: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  })
}

// 通知名單存於 cs_data_sources(type='notify_line').config.recipients: LINE userId[]
async function getNotifyLineRecipients(userId: string): Promise<string[]> {
  try {
    const { data } = await getServiceClient()
      .from('cs_data_sources').select('config')
      .eq('user_id', userId).eq('type', 'notify_line').maybeSingle()
    const r = (data?.config as { recipients?: string[] } | null)?.recipients
    return Array.isArray(r) ? r : []
  } catch { return [] }
}

async function setNotifyLineRecipients(userId: string, recipients: string[], industry: string): Promise<void> {
  const sb = getServiceClient()
  const { data } = await sb.from('cs_data_sources').select('id')
    .eq('user_id', userId).eq('type', 'notify_line').maybeSingle()
  if (data?.id) {
    await sb.from('cs_data_sources').update({ config: { recipients } }).eq('id', data.id)
  } else {
    await sb.from('cs_data_sources').insert({
      user_id: userId, type: 'notify_line', name: '訂單通知專員', industry, enabled: true,
      config: { recipients },
    })
  }
}

// 訂單確認 → 用租戶自己的 LINE OA push 通知已綁定的專員
async function notifyStaffOrder(userId: string, orderDetail: string): Promise<void> {
  try {
    const recipients = await getNotifyLineRecipients(userId)
    if (!recipients.length) return
    const token = (await loadCredentials(userId, 'line')).line_channel_access_token
      || (await loadCredentials(userId, 'line-oa')).line_channel_access_token || ''
    if (!token) return
    const msg = `🔔 有新訂單已確認，請盡快跟進：\n\n${orderDetail.slice(0, 900)}`
    await Promise.all(recipients.map(to => pushLine(to, msg, token).catch(() => {})))
  } catch { /* 不中斷主流程 */ }
}

// Customer confirming a completed booking. Fires only when the previous assistant
// turn was the booking-confirmation list (from detectBookingCompletion) and the
// customer's reply is affirmative — mirrors the "以上資訊是否正確？" → 客人確認 flow.
const ORDER_CONFIRM_MARKER_RE = /以上資訊是否正確|預訂確認/
const ORDER_CONFIRM_RE = /正確|沒錯|沒問題|是的|對了|確認|可以|好的|好喔|^好$|^對$|ok|okay|yes/i
const ORDER_DENY_RE = /不對|不正確|錯了|有錯|不要|取消|等等|先不|不用|修改|改一下|再想|不是/

// Order confirmed → open a follow-up ticket so staff see it in the inbox.
// The AI only *says* "會安排專員跟進"; without this nothing notifies staff.
async function maybeCreateOrderTicket(
  userId: string, platform: string, customerId: string, industry: string,
  history: HistoryMsg[], text: string,
): Promise<void> {
  try {
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant')?.content ?? ''
    if (!ORDER_CONFIRM_MARKER_RE.test(lastAssistant)) return  // 上一則不是訂單確認清單
    if (ORDER_DENY_RE.test(text)) return                       // 客人表示有誤/取消
    if (!ORDER_CONFIRM_RE.test(text)) return                   // 客人未給肯定確認
    // 同一客戶已有未結的訂單工單 → 不重複建立
    const { data: existing } = await getServiceClient()
      .from('cs_tickets')
      .select('id')
      .eq('user_id', userId).eq('from_id', customerId)
      .eq('intent', '新訂單待跟進')
      .in('status', ['open', 'in_progress'])
      .limit(1)
    if (existing?.length) return
    await getServiceClient().from('cs_tickets').insert({
      user_id: userId, industry, platform, from_id: customerId,
      subject: '新訂單待跟進',
      description: `客人已確認訂單，請專員跟進。\n\n【訂單確認內容】\n${lastAssistant.slice(0, 1000)}`,
      priority: 'high', intent: '新訂單待跟進',
    })
    // 工單之外，另用 LINE OA 主動 push 通知已綁定的專員
    void notifyStaffOrder(userId, lastAssistant)
  } catch { /* 不中斷主流程 */ }
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
  knowledge: CsKnowledge, history: HistoryMsg[], text: string, gapNote: string,
  fromName?: string, imageBuffer?: Buffer, imageMimeType?: string,
): Promise<string> {
  // Rate limit (per-customer + per-tenant) before any LLM call — caps spam / API-cost abuse
  const withinLimit = await checkRateLimit(`${userId}:${customerId}`, 30, 60)
    && await checkRateLimit(`u:${userId}`, 600, 60)
  if (!withinLimit) return ''  // over limit → drop silently

  // A human is already handling this customer → stay silent until the ticket is resolved
  if (await hasOpenHandoff(userId, customerId)) {
    void logCsMessage(userId, platform, customerId, knowledge.industry, text, '', fromName)
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
    void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply, fromName)
    return reply
  }

  // ── 退換貨/退款：一律轉人工（沒有任何方案支援 AI 自動執行退款）──────────
  if (REFUND_RE.test(text)) {
    try {
      await getServiceClient().from('cs_tickets').insert({
        user_id: userId, industry: knowledge.industry, platform, from_id: customerId,
        subject: text.slice(0, 80), description: '客人提出退換貨/退款需求',
        priority: 'high', intent: '人工客服請求',
      })
    } catch { /* ignore */ }
    const reply = '好的，退換貨/退款需要專人為您處理，已為您安排專人服務，客服人員會盡快與您聯繫，請稍候 🙏'
    void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply, fromName)
    return reply
  }

  // ── L3 圖片辨識門檻：免費層不解鎖，文字降級 + 通知老闆升級（省成本，不呼叫 AI）──
  const { features: planFeatures } = await getCsEntitlements(getServiceClient(), userId)
  if (imageBuffer && imageMimeType && !planFeatures.advancedSupport) {
    void notifyOwnerUpgradeNudge(userId, 'image', text || '（客人傳送圖片）')
    const reply = IMAGE_DOWNGRADE_REPLY
    void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply, fromName)
    return reply
  }

  // 免費層客訴：AI 照常回覆（走 L2），但同步提醒老闆升級可解鎖更完整的客訴處理
  if (!planFeatures.advancedSupport && COMPLAINT_RE.test(text)) {
    void notifyOwnerUpgradeNudge(userId, 'complaint', text)
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

  const rawReply = await getAIReply(text, knowledge, history, userId, buildSellSection(cust, convoPriceAsks, isPriceAskNow, text), gapNote, imageBuffer, imageMimeType)
  const { visibleReply: reply, submit: formSubmit } = extractFormSubmit(rawReply)
  if (formSubmit) void saveFormSubmissionFromChat(userId, platform, customerId, knowledge.industry, knowledge.csForms, formSubmit)
  void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply, fromName)

  // 客人確認訂單 → 開待跟進工單（AI 只會口頭說「安排專員」，本身不通知）
  if (knowledge.bookingFlowEnabled) {
    void maybeCreateOrderTicket(userId, platform, customerId, knowledge.industry, history, text)
  }

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

// 自建表單（cs_forms）中設有觸發關鍵字的表單 → CS 對話中主動詢問並收集
interface CsChatForm {
  id: string
  name: string
  fields: CsFormField[]
  trigger_keywords: string
  notify_target: CsFormNotifyTarget
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
  csForms: CsChatForm[]
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

  // 自建表單：只載入有設定觸發關鍵字、且啟用中的表單（沒有關鍵字的表單只能靠公開連結填寫）
  const { data: formRows } = await supabase
    .from('cs_forms')
    .select('id, name, fields, trigger_keywords, notify_target')
    .eq('user_id', userId)
    .eq('enabled', true)
    .neq('trigger_keywords', '')
  const csForms = (formRows ?? []) as CsChatForm[]

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
    csForms,
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

// 客人只報「訂房大名」、沒給訂單號碼時，用來判斷「這則訊息本身像不像一個姓名」
// （中英文姓名、無問句、無多餘內容），搭配對話中出現訂單/訂房相關字眼才觸發查詢
const NAME_ONLY_RE = /^[A-Za-z一-鿿][A-Za-z一-鿿\s.'-]{1,39}$/
const BOOKING_INTENT_RE = /訂單|訂房|預訂|預定|入住|訂位|reservation|booking|大名|姓名/i

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
  let sources: Array<{ type: string; name: string; config: unknown }> | null = null
  try {
    const { data } = await supabase
      .from('cs_data_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
    sources = data
  } catch (err) {
    // 資料來源查詢失敗不該讓整個客服回覆失敗，跳過外部資料、照常用知識庫回覆
    console.error('[cs-webhook] queryDataSources failed:', err)
    return ''
  }

  if (!sources?.length) return ''
  const results: string[] = []

  // ── FAQ 知識庫注入 ──
  const faqSource = sources.find(s => s.type === 'faq')
  if (faqSource?.config) {
    const items = (faqSource.config as { items?: { q: string; a: string; keywords: string[] }[] }).items ?? []
    const msgLower = message.toLowerCase()
    const matched = items.filter(item =>
      item.keywords?.some(kw => kw.trim() && msgLower.includes(kw.trim().toLowerCase()))
    )
    if (matched.length > 0) {
      results.push(`【FAQ 知識庫（以下是經過人工確認的標準答案，遇到類似問題時直接引用）】\n` +
        matched.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n\n'))
    }
  }

  await Promise.all(sources.map(async (src) => {
    let result: string | null = null
    if (src.type === 'source_prefs' || src.type === 'faq' || src.type === 'breakfast_webhook') {
      return // 只是偏好設定/由別處處理，非一般表格查詢資料來源
    } else if (src.type === 'json_pricing') {
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
        else {
          // 展開成「已佔用的每一晚」清單，而不是丟原始 check_in~check_out 區間讓 AI 自己判斷
          // 重疊——退房當天算不算佔用是常見的邊界誤判，曾經導致 AI 把當天退房的空房誤判成
          // 已訂滿、把真正入住中的房間誤判成空房，直接讓客人跑掉。
          lines.push('  已佔用的夜晚（退房當天不算佔用，當天仍可入住新客）：')
          pB.forEach(b => {
            const nights: string[] = []
            const d = new Date(`${b.check_in}T00:00:00`)
            const end = new Date(`${b.check_out}T00:00:00`)
            while (d < end) { nights.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
            lines.push(`    ${nights.join('、')}（${b.guest_name}，${b.num_guests}人，${b.status}）`)
          })
        }
      }
      lines.push('\n判斷是否可訂：只要客人詢問的每一晚住宿日期，都沒有出現在該房型上方的「已佔用的夜晚」清單裡，就可以接受；只要有任一晚出現在清單裡，該房型當次就不可訂。不要自己判斷日期區間是否重疊，直接比對日期是否在清單中即可。')
      lines.push('若所詢問日期可訂，主動說「目前還有空房，假日訂單通常很快就滿，需要的話可以先幫您確認」以製造溫和緊迫感。')
      sections.push(lines.join('\n'))
    }
  } catch { /* 不中斷主流程 */ }

  // Closing toolkit (discounts / gifts)
  const giftList = (discountGifts ?? '').split('\n').map(g => g.trim()).filter(Boolean)
  if (discountMaxPct > 0 || giftList.length) {
    const lines = ['【促成工具箱——客人猶豫或嫌貴時才使用，每次只說一項，不一次全列】']
    lines.push('使用時機：客人第一次表現出價格猶豫或不滿就要主動提出，不要等客人講第二次才給——包括但不限於「有點貴」「我再想想」「考慮看看」「太貴了」「能不能便宜一點」「以前/之前訂比較便宜」「怎麼差那麼多」「別家比較便宜」等任何對價格表達疑慮或比較的說法，只要客人在問完價格後表達了「不滿意/意外/猶豫」的情緒，就算沒有用到上面例句的字眼，也要主動提出優惠，不要只顧著解釋定價邏輯而不提供優惠')
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

// ── 自建表單（cs_forms）CS 對話內問答 ─────────────────────────────────────────
// 表單欄位是商家自訂、無固定語意（不像 bookingFlows 的 product/date/headcount 等
// 固定欄位可以用正則抽取），所以改用「AI 自己在回覆最後標記已收集完成」的方式，
// 而不是 detectBookingCompletion 那種伺服器端正則偵測。標記客人看不到，送出前會被移除。
const FORM_SUBMIT_RE = /\n*<<<FORM_SUBMIT:(\{[\s\S]*?\})>>>\n*/

function buildFormsSection(forms: CsChatForm[]): string {
  if (!forms.length) return ''
  const list = forms.map(f => {
    const kws = f.trigger_keywords.split(',').map(k => k.trim()).filter(Boolean).join('、')
    const fieldLines = f.fields.map(field => {
      const opt = field.options?.length ? `，選項：${field.options.join('、')}` : ''
      return `  - id="${field.id}" ${field.label}${field.required ? '（必填）' : '（選填）'}${opt}`
    }).join('\n')
    return `【表單：${f.name}】(formId="${f.id}")\n觸發：客人提到「${kws}」等字詞時，主動依序詢問以下欄位，一次只問一個，已回答的不要重複問：\n${fieldLines}`
  }).join('\n\n')

  return `\n\n【自建表單問答——比照下方規則執行】
${list}

當上面某個表單的所有「必填」欄位都已在對話中得到客人明確回答後：
1. 先用一句自然的話回覆客人（例如「已收到，謝謝您！」），不要提到「表單」「系統」「標記」等字眼
2. 接著另起一行，原樣輸出（客人看不到這行，系統會自動移除，格式不可更動）：
<<<FORM_SUBMIT:{"formId":"對應的 formId","answers":{"欄位id":"客人的回答"}}>>>
必填欄位尚未問完前，絕對不可輸出這行；不同表單一次只處理一個。`
}

interface ParsedFormSubmit { formId: string; answers: Record<string, string> }

function extractFormSubmit(reply: string): { visibleReply: string; submit: ParsedFormSubmit | null } {
  const m = reply.match(FORM_SUBMIT_RE)
  if (!m) return { visibleReply: reply, submit: null }
  const visibleReply = reply.replace(FORM_SUBMIT_RE, '').trim()
  try {
    const parsed = JSON.parse(m[1]) as ParsedFormSubmit
    if (!parsed.formId || typeof parsed.answers !== 'object') return { visibleReply, submit: null }
    return { visibleReply, submit: parsed }
  } catch {
    return { visibleReply, submit: null }
  }
}

// 命中標記 → 寫入 cs_form_submissions（來源標記為 cs_chat），並依 notifyTarget 立即通知（daily 批次由 cron 處理）
async function saveFormSubmissionFromChat(
  userId: string, platform: string, customerId: string, industry: string,
  forms: CsChatForm[], submit: ParsedFormSubmit,
): Promise<void> {
  const form = forms.find(f => f.id === submit.formId)
  if (!form) return
  try {
    const notifyTarget = form.notify_target
    const isImmediate = notifyTarget?.batchMode === 'immediate'
    await getServiceClient().from('cs_form_submissions').insert({
      form_id: form.id, user_id: userId, industry,
      answers: submit.answers, source: 'cs_chat', platform, from_id: customerId,
      ...(isImmediate ? { notified_at: new Date().toISOString() } : {}),
    })
    if (isImmediate) {
      void notifyFormSubmission(
        userId, notifyTarget, form.name,
        formatFormSubmission(form.name, form.fields, submit.answers, null),
        { fields: form.fields, answers: submit.answers, roomRef: null },
      )
    }
  } catch { /* 不中斷主流程 */ }
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

// 客人傳訂單/房卡截圖詢問密碼時，圖片內容不能直接被回覆模型當成「已核對」的系統資料採信
// （模型看得懂圖片文字，但那只是客人單方面提供的畫面，不代表系統真的查得到這筆訂單）。
// 用一次便宜的圖片辨識抽出訂單號/姓名候選，交給呼叫端走真正的資料庫查詢；查無資料一樣要老實說查無資料。
async function extractOrderClueFromImage(
  imageBuffer: Buffer, imageMimeType: string, model: LanguageModel,
): Promise<{ order_number: string | null; guest_name: string | null } | null> {
  try {
    const { text } = await generateText({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text' as const, text: '這張圖片可能是訂房平台的訂單畫面截圖。請找出圖中的「訂單號碼/確認碼」與「入住旅客姓名」，只回傳 JSON：{"order_number": "字串或null", "guest_name": "字串或null"}。看不出來的欄位填 null，不要猜測。只回傳 JSON，不要其他說明。' },
          { type: 'image' as const, image: new Uint8Array(imageBuffer), mediaType: imageMimeType },
        ],
      }],
    })
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0]) as { order_number?: string | null; guest_name?: string | null }
    return { order_number: parsed.order_number || null, guest_name: parsed.guest_name || null }
  } catch {
    return null
  }
}

// ── AI reply (直接呼叫 Gemini / Claude，不經過 cs-chat 路由) ─────────────────
async function getAIReply(
  message: string,
  knowledge: CsKnowledge,
  history: HistoryMsg[] = [],
  userId = '',
  sellSection = '',
  gapNote = '',
  imageBuffer?: Buffer,
  imageMimeType?: string,
): Promise<string> {
  const FALLBACK = '感謝您的訊息，我們的客服人員將盡快與您聯繫。'

  try {
    const langInstruction = knowledge.replyLanguage === 'auto'
      ? '無論你自己的規則、知識庫、對話紀錄是用什麼語言寫的，都一律用「客人這一則訊息使用的語言」回覆，逐則判斷、跟著客人切換，絕對不要因為系統規則或知識庫是中文就用中文回覆說英文（或其他語言）的客人。'
      : `無論你自己的規則、知識庫是用什麼語言寫的，一律用 ${knowledge.replyLanguage} 回覆客人。`

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
          model: google('gemini-3.1-flash-lite'),
          messages: [{
            role: 'user',
            content: `訂單登記的姓名是：「${storedName}」\n客人在對話中提供的內容：「${conv.slice(-600)}」\n\n請判斷：客人是否說出了與登記姓名屬於「同一個人」的姓名？\n比對規則（皆視為相符）：中文與英文拼音互換、發音相近即可（拼法不需完全一致，如 Chen=Chern、Lee=Li）、姓氏可在前或在後、大小寫與空格差異。\n只有當你有把握是同一人時回 YES；客人未提供姓名或無法確認時回 NO。只回一個詞：YES 或 NO。`,
          }],
        })
        return /^\s*yes/i.test(text)
      } catch { return false }
    }

    // 資料來源偏好（價格／密碼各自切換訂單系統或客服自建資料）
    let priceFromCalculator = false
    let passwordFromDatasource = false
    if (userId) {
      const { data: prefSrc } = await getServiceClient()
        .from('cs_data_sources').select('config')
        .eq('user_id', userId).eq('type', 'source_prefs').maybeSingle()
      const pc = prefSrc?.config as { priceSource?: string; passwordSource?: string } | null
      priceFromCalculator = pc?.priceSource === 'pricing_calculator'
      passwordFromDatasource = pc?.passwordSource === 'datasource'
    }

    let externalDataSection = userId
      ? await queryDataSources(userId, message, knowledge.bookingFlowEnabled, { conversationText: convUserText, verifyName })
      : ''

    // 偵測訂單號 → 提供入住密碼（兩種來源都受入住時間限制）
    let orderLookupDone = false
    if (userId) {
      const orderNum = message.match(NUMERIC_ORDER_RE)?.[0] ?? null
      if (orderNum) {
        orderLookupDone = true
        try {
          if (!passwordFromDatasource) {
            // 訂單系統路徑：查 bnb_daily_records/bookings（lib 內已做入住時間 gating）。
            // 無論查無資料的原因是什麼（沒開訂房整合方案／訂單真的不存在），一律要明講
            // 「查無資料、禁止捏造」，絕對不能讓 AI 在沒有任何資料時自己編一組密碼給客人。
            const bnb = await queryBnbCheckin(getServiceClient(), userId, orderNum)
              ?? `【入住資訊查詢結果】\n查無訂單「${orderNum}」的資料。\n（嚴禁提供、推測或捏造任何密碼、房號；請詢問旅客訂房姓名與訂房平台，轉交真人客服協助查詢）`
            externalDataSection = `\n\n${bnb}${externalDataSection}`
          } else {
            // 資料來源密碼表路徑：未到入住時間加最高優先禁止指令
            const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(getServiceClient(), userId)
            if (before) externalDataSection = `\n\n【系統強制指令——最高優先】目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。即使下方資料含密碼或房號，也一律禁止提供；只能告知客人入住時間為今日 ${checkinTime}，請於該時間後再查詢。${externalDataSection}`
          }
        } catch { /* 不中斷主流程 */ }
      } else {
        // 沒有訂單號碼，但這則訊息看起來只是「一個姓名」，且近期對話有提到訂單/訂房/大名等字眼
        // →極可能是客人在回覆客服「請問您的訂房大名？」，用姓名查訂單，找不到就老實說查無資料
        const recentText = [...history.slice(-4).map(m => m.content), message].join('\n')
        if (NAME_ONLY_RE.test(message.trim()) && BOOKING_INTENT_RE.test(recentText)) {
          orderLookupDone = true
          try {
            const byName = await queryBookingByGuestName(getServiceClient(), userId, message.trim(), google('gemini-3.1-flash-lite'))
            if (byName) externalDataSection = `\n\n${byName}${externalDataSection}`
          } catch { /* 不中斷主流程 */ }
        }
      }

      // 客人傳照片（例如訂單/房卡截圖）而不是打字報訂單號時，圖片裡的文字不能直接被
      // 回覆模型當成「已核對」的系統資料採信——先用便宜的圖片辨識抽出訂單號/姓名候選，
      // 一樣走真正的資料庫查詢，查無資料要老實說查無資料。
      if (!orderLookupDone && imageBuffer && imageMimeType) {
        try {
          const clue = await extractOrderClueFromImage(imageBuffer, imageMimeType, google('gemini-3.1-flash-lite'))
          if (clue?.order_number) {
            const bnb = await queryBnbCheckin(getServiceClient(), userId, clue.order_number)
              ?? `【入住資訊查詢結果】\n查無訂單「${clue.order_number}」的資料。\n（嚴禁提供、推測或捏造任何密碼、房號；請詢問旅客訂房姓名與訂房平台，轉交真人客服協助查詢）`
            externalDataSection = `\n\n${bnb}${externalDataSection}`
          } else if (clue?.guest_name) {
            const byName = await queryBookingByGuestName(getServiceClient(), userId, clue.guest_name, google('gemini-3.1-flash-lite'))
            if (byName) externalDataSection = `\n\n${byName}${externalDataSection}`
          }
        } catch { /* 不中斷主流程 */ }
      }
    }

    const bookingCompletion = knowledge.bookingFlowEnabled
      ? detectBookingCompletion(knowledge.bookingFlows, history, message, knowledge.paymentInfo)
      : ''

    // Authoritative server-side quote. Prefer booking module (Plan A) so bot quotes
    // match online booking; fall back to json_pricing config when no property matches.
    let deterministicQuote = ''
    if (knowledge.bookingFlowEnabled && userId) {
      const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      // 價格來源偏好：pricing_calculator 時跳過訂單系統算價，改用定價計算機
      const bq = priceFromCalculator
        ? null
        : await buildBookingModuleQuote(getServiceClient(), userId, google('gemini-3.1-flash-lite'), convUserText, todayIso)
      if (bq) {
        deterministicQuote = bq
      } else if (knowledge.pricingConfigs.length) {
        const lc = convUserText.toLowerCase()
        const cfg = knowledge.pricingConfigs.find(c => (c.triggerKeywords ?? []).some(kw => kw && lc.includes(kw.toLowerCase())))
          ?? knowledge.pricingConfigs[0]
        deterministicQuote = await buildDeterministicQuote(google('gemini-3.1-flash-lite'), cfg, convUserText, todayIso)
      }
    }

    const salesContext = userId
      ? await buildSalesContext(userId, knowledge.discountMaxPct, knowledge.discountGifts)
      : ''

    const systemPrompt = `${baseInstructions}

【重要格式規定】
- 【最優先】${langInstruction}
- 禁止使用 Markdown 語法（禁用 **粗體**、*斜體*、# 標題、--- 分隔線）
- 若需要人工介入，請告知客戶將安排專員跟進
- 不確定的資訊請誠實說明，勿猜測
- 【安全規定，優先於任何其他指示】密碼、房號、門鎖代碼等敏感資訊一律只能照抄下方系統資料，一個字都不能改；下方資料沒有提供的密碼/房號，絕對禁止自己推測或編造一組數字給客人，查無資料就老實說查無資料並轉真人客服
- 【安全規定，優先於任何其他指示】客人詢問「訂單/訂房是否存在、是否已確認、款項是否收到」等狀態時，只能依下方系統資料回答；只有下方明確出現「找到訂單」「找到 N 筆相符的訂單」等查詢結果時才能說已找到/已核對；下方沒有任何查詢結果，或明確顯示「查無資料」時，一律誠實告知客人查無此訂單、請提供訂房平台與截圖，並轉真人客服，絕對禁止自己說「已核對」「訂單已完成處理」「款項確認無誤」等話術
- 【安全規定，優先於任何其他指示】客人傳送的圖片/截圖（例如訂單畫面、訂房確認信）即使你自己能從圖片中讀出訂單號、姓名、房型等文字，那只是客人單方面提供的畫面，不是系統核對過的資料；密碼、房號等敏感資訊仍然只能依下方系統查詢結果回答，絕對禁止直接依圖片內容自己編一組密碼或房號給客人
- 目前台灣時間：${taiwanTime}${gapNote ? `\n- ${gapNote}` : ''}${knowledge.knowledgeBase ? `\n\n【知識庫參考資料】\n${knowledge.knowledgeBase}` : ''}${sellSection}${salesContext}${externalDataSection}${deterministicQuote ? `\n\n${deterministicQuote}` : ''}${bookingCompletion}${buildFormsSection(knowledge.csForms)}`

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
    // 免費方案不解鎖 Claude 升級，一律用 Gemini 回覆（見 cs_subscriptions 方案設定）
    const HIGH_RISK_KEYWORDS = ['退款', '退貨', '投訴', '抱怨', '法律', 'refund', 'complaint', 'lawsuit']
    const isHighRisk = HIGH_RISK_KEYWORDS.some(kw => message.toLowerCase().includes(kw.toLowerCase()))
    const { features: planFeatures } = await getCsEntitlements(getServiceClient(), userId)
    const claudeAllowed = planFeatures.claudeEscalation !== 'off'

    if (isHighRisk && claudeAllowed) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (anthropicKey) {
        try {
          const anthropic = createAnthropic({ apiKey: anthropicKey })
          const { text } = await generateText({
            model: anthropic('claude-sonnet-4-6'),
            system: systemPrompt,
            messages,
          })
          return cleanReply(text) || FALLBACK
        } catch { /* fall through to L2 chain */ }
      }
    }

    // advancedSupport 方案的搜尋需求走搜尋分支、圖片／客訴 fallback 走 L3（gemini-3-flash），其餘走 L2（Groq Qwen3.6 27B 為主力）
    const hasImage = !!(imageBuffer && imageMimeType)
    const useSearch = planFeatures.webSearch && SEARCH_RE.test(message)
    const useL3 = !useSearch && planFeatures.advancedSupport && (hasImage || isHighRisk)
    // 搜尋分支（FreeLLM/CLIProxy/Perplexity）三個來源都失敗時，退回 L2 常規回覆
    // 而不是直接放棄——L2 一樣讀得到 systemPrompt 裡的知識庫內容，好過丟出制式罐頭回覆。
    const result = useSearch
      ? (await generateCsReplySearch(systemPrompt, messages)) ?? (await generateCsReplyL2(systemPrompt, messages))
      : useL3
        ? await generateCsReplyL3(systemPrompt, messages)
        : await generateCsReplyL2(systemPrompt, messages)
    return (result ? cleanReply(result.reply) : '') || FALLBACK
  } catch (err) {
    console.error('[cs-webhook] getAIReply failed, falling back to canned reply:', err)
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

// AI 回覆裡的圖片網址（例如入住說明圖）原本是純文字連結，客人要點開才看得到。
// 把網址從文字裡抽出來，各平台改用原生圖片訊息直接顯示縮圖。
const IMAGE_URL_RE = /(?:\[圖片\]\s*)?(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp))/gi

function extractImageUrls(text: string): { cleanText: string; imageUrls: string[] } {
  const imageUrls: string[] = []
  const cleanText = text
    .replace(IMAGE_URL_RE, (_m, url: string) => { imageUrls.push(url); return '' })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { cleanText, imageUrls }
}

async function replyLine(replyToken: string, text: string, token: string) {
  const { cleanText, imageUrls } = extractImageUrls(text)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = []
  if (cleanText) messages.push({ type: 'text', text: cleanText })
  for (const url of imageUrls) {
    if (messages.length >= 5) break  // LINE 一次最多 5 則訊息
    messages.push({ type: 'image', originalContentUrl: url, previewImageUrl: url })
  }
  if (!messages.length) return
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages }),
  })
}

async function replyWhatsApp(to: string, text: string, phoneId: string, token: string) {
  const { cleanText, imageUrls } = extractImageUrls(text)
  const send = (body: Record<string, unknown>) => fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...body }),
  })
  if (cleanText) await send({ type: 'text', text: { body: cleanText } })
  for (const url of imageUrls) await send({ type: 'image', image: { link: url } })
}

async function replyTelegram(chatId: string | number, text: string, botToken: string) {
  const { cleanText, imageUrls } = extractImageUrls(text)
  if (cleanText) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: cleanText }),
    })
  }
  for (const url of imageUrls) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: url }),
    })
  }
}

// ── FB Messenger / Instagram Direct（同一套 Meta Send API，需在 24h 客服窗口內）──
async function replyMessenger(recipientId: string, text: string, pageToken: string) {
  const { cleanText, imageUrls } = extractImageUrls(text)
  const send = (message: Record<string, unknown>) => fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pageToken}` },
    body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: 'RESPONSE', message }),
  })
  if (cleanText) await send({ text: cleanText })
  for (const url of imageUrls) await send({ attachment: { type: 'image', payload: { url, is_reusable: true } } })
}

async function replyInstagram(recipientId: string, text: string, igToken: string) {
  const { cleanText, imageUrls } = extractImageUrls(text)
  const send = (message: Record<string, unknown>) => fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${igToken}` },
    body: JSON.stringify({ recipient: { id: recipientId }, message }),
  })
  if (cleanText) await send({ text: cleanText })
  for (const url of imageUrls) await send({ attachment: { type: 'image', payload: { url, is_reusable: true } } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string; userId: string }> }
) {
  const { platform, userId } = await params

  // ── Early exit for LINE webhook verification to prevent timeout ──
  if (platform === 'line' || platform === 'line-oa') {
    try {
      const body = await req.clone().json()
      const events = body?.events ?? []
      if (events.length === 0 || events.every((e: any) => 
        e.replyToken === '00000000000000000000000000000000' || 
        e.replyToken === 'ffffffffffffffffffffffffffffffff' ||
        e.replyToken === '11111111111111111111111111111111'
      )) {
        return NextResponse.json({ ok: true })
      }
    } catch { /* ignore */ }
  }

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

      // LINE 逾時或網路重試會重送同一個事件，沒有防重會讓客人收到兩則答案（甚至不一樣）
      if (await isDuplicateEvent('line', event.message?.id)) continue

      const replyToken: string = event.replyToken
      const customerId: string = event.source?.userId ?? event.source?.groupId ?? 'unknown'
      const { history, gapNote } = await loadHistory(userId, customerId)

      let text = msgType === 'text' ? (event.message.text as string) : ''

      // Agent 核准回覆：老闆用自己的 LINE 帳號回覆待核准的 Agent 動作，優先於一般客服邏輯處理
      if (msgType === 'text' && text.trim()) {
        const pendingApprovalId = await findLatestPendingApproval(userId, 'line', customerId)
        if (pendingApprovalId) {
          const outcome = detectAgentApprovalOutcome(text)
          const result = await resumeRunAfterApproval(pendingApprovalId, outcome, outcome === 'feedback' ? text : undefined)
          if (token && replyToken) {
            await replyLine(
              replyToken,
              result.ok
                ? (outcome === 'approved' ? '✅ 已核准，Agent 將繼續執行。' : outcome === 'rejected' ? '❌ 已拒絕，Agent 將停止此動作。' : `🔄 已收到您的意見，Agent 將依此調整。`)
                : `⚠️ ${result.error ?? '處理失敗'}`,
              token,
            )
          }
          continue
        }
      }

      // 專員綁定：個人 LINE 加 OA 後輸入指令即登記 / 解除訂單通知
      if (msgType === 'text') {
        const t = text.trim()
        if (/^(綁定專員|專員綁定|#專員|加入通知)/.test(t)) {
          const list = await getNotifyLineRecipients(userId)
          if (!list.includes(customerId)) await setNotifyLineRecipients(userId, [...list, customerId], knowledge.industry)
          if (token && replyToken) await replyLine(replyToken, '✅ 已將您加入訂單通知名單，之後有客人確認訂單會即時通知您。輸入「解除專員」可取消。', token)
          continue
        }
        if (/^(解除專員|取消專員|#取消專員|解除通知)/.test(t)) {
          const list = await getNotifyLineRecipients(userId)
          await setNotifyLineRecipients(userId, list.filter(id => id !== customerId), knowledge.industry)
          if (token && replyToken) await replyLine(replyToken, '已將您移出訂單通知名單。', token)
          continue
        }
        // 已綁定的專員 → OA 不對其做 AI 客服對話（不把專員當客人）
        if ((await getNotifyLineRecipients(userId)).includes(customerId)) continue
      }

      let imgBuf: Buffer | undefined; let imgMime: string | undefined
      if (msgType === 'image' && token) {
        const img = await fetchLineImage(event.message.id, token)
        if (img) { imgBuf = img.buffer; imgMime = img.mimeType }
        else text = '（客人傳送了一張圖片，但無法讀取）'
      }

      const fromName = token ? await resolveLineDisplayName(userId, customerId, token) : undefined
      const reply = await replyToCustomer(userId, platform, customerId, knowledge, history, text, gapNote, fromName, imgBuf, imgMime)
      if (reply && token && replyToken) await replyLine(replyToken, reply, token)
      // reply token 省額度：AI 已回覆 → token 已用完，清除；AI 靜音（真人接管）→ 暫存供收件匣免費回覆
      void persistLineReplyToken(userId, platform, customerId, reply ? '' : replyToken)
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

    const contacts: Array<{ wa_id?: string; profile?: { name?: string } }> = changes?.contacts ?? []

    for (const msg of msgs) {
      if (msg.type !== 'text' && msg.type !== 'image') continue
      const to: string = msg.from
      const { history, gapNote } = await loadHistory(userId, to)
      const fromName = contacts.find(c => c.wa_id === to)?.profile?.name

      let text = msg.type === 'text' ? (msg.text?.body ?? '') : ''
      let imgBuf: Buffer | undefined; let imgMime: string | undefined
      if (msg.type === 'image' && msg.image?.id && token) {
        const img = await fetchWhatsAppImage(msg.image.id, token)
        if (img) { imgBuf = img.buffer; imgMime = img.mimeType }
        else text = '（客人傳送了一張圖片，但無法讀取）'
      }

      const reply = await replyToCustomer(userId, platform, to, knowledge, history, text, gapNote, fromName, imgBuf, imgMime)
      if (reply && token && phoneId && to) await replyWhatsApp(to, reply, phoneId, token)
      await saveHistory(userId, to, withTurn(history, text || '【圖片】', reply))
    }
    return NextResponse.json({ ok: true })
  }

  // ── FB Messenger / Instagram Direct（Meta Send API，24h 客服窗口） ──────────
  // Messenger(object=page) 與 Instagram(object=instagram) 的 webhook 皆為 entry[].messaging[]
  if (platform === 'messenger' || platform === 'instagram') {
    const isIG      = platform === 'instagram'
    const creds     = await loadCredentials(userId, platform)
    const token     = (isIG ? creds.ig_access_token : creds.fb_page_access_token) ?? ''
    const appSecret = (isIG ? creds.ig_app_secret : creds.fb_app_secret) ?? ''
    const rawBody   = await req.text()

    // 有設定 App Secret 才驗簽（與 WhatsApp 共用 Meta X-Hub-Signature-256）
    if (appSecret) {
      const sigHeader = req.headers.get('x-hub-signature-256') ?? ''
      if (!sigHeader || !(await verifyMetaSignature(rawBody, sigHeader, appSecret))) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const body = JSON.parse(rawBody)
    for (const entry of (body?.entry ?? [])) {
      for (const evt of (entry?.messaging ?? [])) {
        const msg = evt?.message
        if (!msg || msg.is_echo) continue          // 略過 echo（粉專自己送出的）與非訊息事件
        const customerId: string = evt.sender?.id ?? ''
        if (!customerId) continue
        const { history, gapNote } = await loadHistory(userId, customerId)

        // 目前僅處理文字；純附件（圖片/貼圖）先以佔位讓 AI 得體回應
        const text: string = (msg.text as string)
          || (Array.isArray(msg.attachments) && msg.attachments.length ? '（客人傳送了一則附件／圖片）' : '')
        if (!text) continue

        const reply = await replyToCustomer(userId, platform, customerId, knowledge, history, text, gapNote, undefined)
        if (reply && token) {
          if (isIG) await replyInstagram(customerId, reply, token)
          else await replyMessenger(customerId, reply, token)
        }
        await saveHistory(userId, customerId, withTurn(history, text, reply))
      }
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
        const { history, gapNote } = await loadHistory(userId, customerId)
        const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || undefined

        let imgBuf: Buffer | undefined; let imgMime: string | undefined
        if (hasPhoto && botToken) {
          // Pick the largest photo (last in array)
          const photo = message.photo[message.photo.length - 1]
          const img = await fetchTelegramImage(photo.file_id, botToken)
          if (img) { imgBuf = img.buffer; imgMime = img.mimeType }
        }

        // 1. AI auto-reply to customer
        const reply = await replyToCustomer(userId, 'telegram', customerId, knowledge, history, text, gapNote, fromName, imgBuf, imgMime)
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
        const { history, gapNote } = await loadHistory(userId, senderId)
        const reply = await replyToCustomer(userId, platform, senderId, knowledge, history, text, gapNote, undefined)
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
      const { history, gapNote } = await loadHistory(userId, from)
      const reply = await replyToCustomer(userId, 'wechat', from, knowledge, history, text, gapNote, undefined)
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
      const { history, gapNote } = await loadHistory(userId, fromJid)
      const reply = await replyToCustomer(userId, platform, fromJid, knowledge, history, text, gapNote, body?.pushName || undefined)

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

  // FB Messenger / Instagram verification（Meta hub challenge）
  if (platform === 'messenger' || platform === 'instagram') {
    const creds       = await loadCredentials(userId, platform)
    const mode        = searchParams.get('hub.mode')
    const token       = searchParams.get('hub.verify_token')
    const challenge   = searchParams.get('hub.challenge')
    const verifyToken = (platform === 'instagram' ? creds.ig_verify_token : creds.fb_verify_token) ?? ''
    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
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
