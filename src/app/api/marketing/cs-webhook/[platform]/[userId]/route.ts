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
import { isSafeWebhookUrl } from '@/lib/ssrf'
import { buildDeterministicQuote } from '@/lib/cs/quote'
import { buildBookingModuleQuote } from '@/lib/cs/booking-quote'
import { queryBnbCheckin, checkBeforeCheckin, queryBookingByGuestName, queryBookingByPhone, noDataFoundSuffix, NAME_VERIFY_ASK_RE, wrapImageDerivedResultForConfirm, looksLikeGuestName, isAffirmativeReply } from '@/lib/cs/checkin-lookup'
import { getCsEntitlements } from '@/lib/cs/entitlements'
import { generateCsReplyL2, generateCsReplyL3, generateCsReplySearch, IMAGE_DOWNGRADE_REPLY, notifyOwnerUpgradeNudge } from '@/lib/cs/csReply'
import { findLatestPendingApproval, resumeRunAfterApproval } from '@/lib/agents/approvals'
import type { CsFormField, CsFormNotifyTarget } from '@/app/api/marketing/cs-forms/route'
import { formatFormSubmission, notifyFormSubmission } from '@/lib/cs/formNotify'
import { isFormAvailableToday } from '@/lib/cs/formSchedule'
import { resolveTodaySubmission, verifyRoomCheckedInToday } from '@/lib/cs/formSubmitGuard'
import { sendToCustomer } from '@/lib/cs/send'

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
  discount_offered_at: string | null
  facts: Record<string, string> | null
}

// 偵測猶豫關鍵字
const HESITATION_RE = /考慮|再想想|比較|猶豫|還沒決定|再看看|回頭|之後再|有點貴|太貴|划算|值得嗎|其他家|別家|下次|想一下|想想看|不確定|先問問|問一下/

// 業務輔助只在客人猶豫時才啟動；平時只保留客戶上下文
function buildSellSection(cust: CsCustomerRow | null, convoPriceAsks: number, isPriceAskNow: boolean, currentMessage: string): string {
  const lines: string[] = []

  // 客戶記憶：永遠保留（不影響話術）
  if (cust?.name) lines.push(`\n\n客戶稱呼：${cust.name}，請自然稱呼對方。`)
  if (cust?.summary) lines.push(`回頭客背景：「${cust.summary}」，勿重問已知資訊。`)
  // 已核對過的身分事實（訂單號碼/電話/訂房大名）——真實案例：客人已經在對話中提供
  // 過並且查詢成功核對過這些資訊，隔一陣子或換一則訊息再問，AI 完全不記得又重新
  // 要求客人提供一次，客人會覺得完全沒被記住。這裡不是要 AI 跳過查詢直接洩漏密碼，
  // 而是讓 AI 知道「這些身分資訊已經跟客人核對過」，不用再重複詢問或請客人重打一次。
  const factLabels: Record<string, string> = { confirmedName: '訂房大名', orderNumber: '訂單號碼', phone: '手機號碼' }
  const factEntries = Object.entries(cust?.facts ?? {}).filter(([, v]) => v)
  if (factEntries.length) {
    lines.push(`\n\n【客人已核對過的身分資訊——不用再詢問或請客人重新提供，需要查詢資料時可直接使用】\n${factEntries.map(([k, v]) => `${factLabels[k] ?? k}：${v}`).join('\n')}`)
  }

  // 偵測猶豫：關鍵字 OR 第 2 次以上問價 OR 已在 negotiating 階段
  const isHesitating = HESITATION_RE.test(currentMessage) || convoPriceAsks >= 2 || cust?.stage === 'negotiating'

  if (isHesitating) {
    lines.push(cust?.discount_offered_at
      ? '\n\n【客戶正在猶豫——此刻才啟動業務模式】這位客人這次對話已經拿過一次優惠了（見下方標記），同理客戶的考量、簡短找出真正顧慮並用非金錢的方式回應（例如說明品質、服務保證、解答疑慮），最後用二選一收尾推進決定；絕對不可以再追加折扣或贈品，優惠一個對話只能給一次。'
      : '\n\n【客戶正在猶豫——此刻才啟動業務模式】同理客戶的考量，簡短找出真正顧慮，提供一個具體誘因或解法，最後用二選一收尾推進決定。語氣溫暖，不施壓，不拖長篇幅。')
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
// 退換貨/退款：沒有任何方案支援 AI 自動執行，一律轉人工（L3 決策）。
// 但「退款」這個字本身也會出現在單純問政策的問句裡（例如「取消政策是要多久前
// 取消才能退款」），這種客人只是想知道規則、不是要立刻辦退款，卻被當成退款請求
// 直接轉真人，AI 完全沒回答到問題——要求真的採取行動（我要退/幫我退/申請退款）
// 才轉人工，單純問政策/規則/流程的問句讓 AI 照常回答（知識庫有寫就照答，沒寫就
// 誠實說不確定並建議聯繫客服，不會答錯，只是不會被錯誤攔截成一句罐頭回覆）。
const REFUND_RE = /退款|退費|退貨|取消訂單|refund|cancel.*order/i
const REFUND_ACTION_RE = /我要(退|取消)|幫我(退|取消)|申請退款|要求退款|請(幫我)?退款|退我|退錢給我|要取消(我的)?訂單|想取消(我的)?訂單|麻煩取消/i
// 真實案例：客人問「如天候因素船隻不能成行，請問可否退款？」——這是問「假設某種情況
// 發生，退款政策是什麼」，不是真的要求退款，但原本的規則只認「政策/規定/退款方式」
// 這類明確字眼，沒涵蓋「如果/若/萬一 + 某條件 + 可否/能否退款」這種很常見的假設性
// 問法，導致被誤判成真的要退款、觸發永久轉真人；轉真人後沒有任何自動恢復機制，
// 客人接下來好幾天的訊息全部石沉大海（見下方 hasOpenHandoff 的逾時安全閥修正）。
// 新增「如果/若/萬一/假如 ... 退/取消」與「可否/能否/是否 ... 退」這類假設語氣，
// 讓知識庫本來就寫好的退款政策（例如「若因風浪封島，會提早通知並全額退款」）能
// 直接照常回答，不用轉真人。
const REFUND_POLICY_RE = /政策|規定|規則|辦法|退款(方式|流程|條件)|取消(方式|流程|條件)|多久.{0,4}(前|之前)|幾天前|如何.{0,6}(取消|退)|怎麼.{0,6}(取消|退)|(如果|若|萬一|假如).{0,20}(退|取消)|可否.{0,4}退|能否.{0,4}退|是否.{0,4}(可退|能退|退款)/i
// 免費層客訴偵測：AI 照常回覆，但額外通知老闆有升級空間
const COMPLAINT_RE = /投訴|抱怨|complaint/i
// 需要即時網路資訊（天氣、附近景點、路況等知識庫不會有的即時資料）僅 PRO+ 觸發搜尋分支
// 真實案例：客人問「有推薦的當地特產嗎？比如鴨賞之類的」完全沒有落入下面任何一個字，
// 搜尋分支沒被觸發，AI 只能誠實說系統資料沒有，沒有機會用網路搜尋幫客人找當地美食／
// 伴手禮這類知識庫本來就不會有、但客人很常問的在地資訊。
const SEARCH_RE = /天氣|氣溫|下雨|附近|景點|怎麼走|路況|交通|開了嗎|營業中嗎|特產|名產|伴手禮|美食|小吃|好吃|好玩|必吃|必買|必去|哪裡(買|吃|玩)|weather|nearby|traffic/i

// 工單開超過這麼久還沒被員工處理（狀態一直沒變成 resolved/closed），視為員工可能
// 漏看或這條規則誤觸發——真實案例：客人問「如天候因素船隻不能成行，請問可否退款？」
// 這種假設性政策問題被誤判成真的要退款，轉真人後從此沒有任何人回應，客人接下來
// 4 天、十幾則訊息全部石沉大海，也沒有任何自動恢復機制。超過這個時數就先讓 AI
// 恢復回覆，避免客人永遠卡住；工單本身仍然維持 open，員工看到還是可以隨時真的接手。
const HANDOFF_STALE_HOURS = 24

// Is there an unresolved human-handoff ticket for this customer? (→ stop auto-replying)
async function hasOpenHandoff(userId: string, customerId: string): Promise<boolean> {
  try {
    const { data } = await getServiceClient()
      .from('cs_tickets')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('from_id', customerId)
      .eq('intent', '人工客服請求')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
    const ticket = data?.[0]
    if (!ticket) return false
    const ageHours = (Date.now() - new Date(ticket.created_at as string).getTime()) / 3600_000
    return ageHours < HANDOFF_STALE_HOURS
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

// 工作台「工單通知設定」（unit_data[12].notifyWebhooks，LINE Messaging API / Telegram
// Bot / Webhook 三選多）——過去只有工作台「測試」分頁的模擬對談會呼叫到（cs-chat/route.ts
// 的 dispatchHandoffTicket），真實客人在這支路由觸發的工單完全沒有串接，商家設定了
// Telegram/Webhook 通知也永遠收不到。這裡補上同一套發送邏輯，跟下面的 notifyStaffOrder
// （LINE OA 綁定專員清單，另一套獨立機制）並存，兩邊都會通知。
type NotifyWebhook = { type: 'line_messaging' | 'webhook' | 'telegram'; value: string; target?: string }

const NOTIFY_PLATFORM_LABELS: Record<string, string> = {
  line: 'LINE', 'line-oa': 'LINE', whatsapp: 'WhatsApp', 'whatsapp-biz': 'WhatsApp',
  'whatsapp-personal': 'WhatsApp', telegram: 'Telegram', zalo: 'Zalo', 'zalo-oa': 'Zalo', wechat: 'WeChat',
}

// 真實案例：專員收到 Telegram/LINE 工單通知，訊息裡完全沒說是哪位客人（只有訊息內容），
// 專員不知道要去哪裡找這位客人，Telegram 上直接回覆也不會送到客人的 LINE（單向通知，
// 不是雙向橋接）。這裡在每則通知都補上「客人是誰（平台＋ID/大名）」＋「點此直接開啟
// 對話回覆」的深連結（開到工作台收件匣、自動選取這位客人），專員點了就能用工作台
// 真的回覆客人，不用自己在清單裡大海撈針，也不會誤以為在 Telegram 回覆就會送到客人手上。
function dispatchTicketNotify(
  notifyWebhooks: NotifyWebhook[],
  info: { platform: string; customerId: string; industry: string; fromName?: string },
  body: string,
): void {
  if (!notifyWebhooks?.length) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const platLabel = NOTIFY_PLATFORM_LABELS[info.platform] ?? info.platform
  const who = info.fromName?.trim() ? `${info.fromName.trim()}（${platLabel}）` : `${platLabel} 客人（${info.customerId}）`
  const link = `${appUrl}/cs/inbox?industry=${encodeURIComponent(info.industry)}&platform=${encodeURIComponent(info.platform)}&to=${encodeURIComponent(info.customerId)}`
  const notifyMsg = `${body}\n\n客人：${who}\n點此直接回覆客人：${link}`
  void Promise.allSettled(notifyWebhooks.filter(wh => wh.value?.trim()).map(wh => {
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
      if (!isSafeWebhookUrl(wh.value.trim())) return Promise.resolve()  // block SSRF to internal hosts
      return fetch(wh.value.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: notifyMsg }),
      })
    }
  }))
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

// 真實案例：客人整段訂房完全是自由對話談成的（商家自訂了 systemPrompt，等於
// buildBookingSystemPrompt 那套「所有預訂步驟已完成」的結構化偵測跟著失效），
// AI 問完匯款帳號末五碼、客人回覆一串數字後，AI 說「您的訂房已處理完成」，
// 但系統完全沒有建立任何工單或訂單紀錄——客人事後想查訂單號碼，系統當然查無
// 資料，只能不斷循環要求換方式查詢。「AI 剛問完匯款末五碼、客人回一串數字」
// 是金流確認的強訊號，不管前面的訂房走的是哪一套流程，都直接建工單通知管家
// 核對並手動建立訂單，不能讓已經付款的客人查無憑據。
const PAYMENT_SUFFIX_ASK_RE = /末五碼|後五碼|末三碼|末3碼|帳號後五碼|轉帳帳號後/
const PAYMENT_SUFFIX_REPLY_RE = /^\D{0,6}\d{3,6}\D{0,6}$/

// 真實案例：客人不是被動回覆「末五碼」問句，而是主動用一整句話回報匯款（「我已於
// 2026/08/28 從彰化銀行帳戶後五碼 42600，轉帳 $2,000 給您囉！」），這種完整句子
// 不會落在 PAYMENT_SUFFIX_REPLY_RE 那種「幾乎整句都是數字」的窄範圍內，需要另外
// 用「訊息同時提到轉帳/匯款關鍵字，又帶了一組後五碼」來偵測。
const PAYMENT_KEYWORD_RE = /轉帳|匯款/
const PAYMENT_SUFFIX_CODE_RE = /(?:後|末)(?:五|5)碼\s*[:：]?\s*\d{4,6}/

// Order confirmed → open a follow-up ticket so staff see it in the inbox.
// The AI only *says* "會安排專員跟進"; without this nothing notifies staff.
async function maybeCreateOrderTicket(
  userId: string, platform: string, customerId: string, industry: string,
  history: HistoryMsg[], text: string, notifyWebhooks: NotifyWebhook[], fromName?: string,
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
    // 工單之外，另用 LINE OA 主動 push 通知已綁定的專員 + 工作台設定的工單通知管道
    void notifyStaffOrder(userId, lastAssistant)
    dispatchTicketNotify(notifyWebhooks, { platform, customerId, industry, fromName }, `🔔 有新訂單已確認，請盡快跟進：\n\n${lastAssistant.slice(0, 900)}`)
  } catch { /* 不中斷主流程 */ }
}

// 客人提供匯款末五碼 → 不管訂房前面走的是結構化流程還是自由對話，都直接建工單
// 通知管家核對並手動建立訂單，見上方 PAYMENT_SUFFIX_ASK_RE 註解。
async function maybeCreatePaymentProofTicket(
  userId: string, platform: string, customerId: string, industry: string,
  history: HistoryMsg[], text: string, notifyWebhooks: NotifyWebhook[], fromName?: string,
): Promise<void> {
  try {
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant')?.content ?? ''
    // 訊號一：AI 剛問完末五碼，客人回一串幾乎全是數字的訊息
    // 訊號二：客人主動用一整句話回報匯款（不管 AI 前一句問了什麼）
    const isSuffixReply = PAYMENT_SUFFIX_ASK_RE.test(lastAssistant) && PAYMENT_SUFFIX_REPLY_RE.test(text.trim())
    const isProofStatement = PAYMENT_KEYWORD_RE.test(text) && PAYMENT_SUFFIX_CODE_RE.test(text)
    if (!isSuffixReply && !isProofStatement) return
    const { data: existing } = await getServiceClient()
      .from('cs_tickets')
      .select('id')
      .eq('user_id', userId).eq('from_id', customerId)
      .eq('intent', '付款確認待跟進')
      .in('status', ['open', 'in_progress'])
      .limit(1)
    if (existing?.length) return
    const recentText = history.slice(-10).map(m => `${m.role === 'user' ? '客人' : 'AI'}：${m.content}`).join('\n')
    await getServiceClient().from('cs_tickets').insert({
      user_id: userId, industry, platform, from_id: customerId,
      subject: '客人已匯款，需人工核對並建立/更新訂單',
      description: `客人回報匯款資訊：「${text.trim()}」，請專員核對款項並手動建立或更新訂單紀錄（本次訂房可能是自由對話談成，系統未必已有結構化訂單資料）。\n\n【近期對話】\n${recentText.slice(0, 1500)}`,
      priority: 'high', intent: '付款確認待跟進',
    })
    const notifyMsg = `客人已回報匯款：「${text.trim()}」，請核對款項並手動建立/更新訂單。`
    void notifyStaffOrder(userId, notifyMsg)
    dispatchTicketNotify(notifyWebhooks, { platform, customerId, industry, fromName }, notifyMsg)
  } catch { /* 不中斷主流程 */ }
}

// 開發票/收據需要人工實際處理（列印、放置指定房間、報稅登錄），AI 只能負責收集
// 抬頭與統一編號後轉交，絕對不能自己說「已經幫您開立」或編造發票資訊——真實案例：
// 知識庫本來就有「請提供抬頭與統一編號」的問答，但客人回覆抬頭與統編後，系統完全
// 沒有任何機制通知專員，資訊石沉大海，發票永遠開不出來，也沒人知道要放哪個房間。
const INVOICE_ASK_RE = /抬頭|統一編號|統編/
const TAX_ID_RE = /(?<!\d)\d{8}(?!\d)/

async function maybeCreateInvoiceTicket(
  userId: string, platform: string, customerId: string, industry: string,
  history: HistoryMsg[], text: string, notifyWebhooks: NotifyWebhook[], fromName?: string,
): Promise<void> {
  try {
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant')?.content ?? ''
    if (!INVOICE_ASK_RE.test(lastAssistant) || !TAX_ID_RE.test(text)) return
    const { data: existing } = await getServiceClient()
      .from('cs_tickets')
      .select('id')
      .eq('user_id', userId).eq('from_id', customerId)
      .eq('intent', '發票開立待處理')
      .in('status', ['open', 'in_progress'])
      .limit(1)
    if (existing?.length) return
    await getServiceClient().from('cs_tickets').insert({
      user_id: userId, industry, platform, from_id: customerId,
      subject: '客人提供發票抬頭/統一編號，需人工開立發票',
      description: `客人回報發票資訊：「${text.trim()}」，請專員協助實際開立發票（若客人訂了多間房，也請確認發票/收據要放在哪個房間）。`,
      priority: 'medium', intent: '發票開立待處理',
    })
    dispatchTicketNotify(notifyWebhooks, { platform, customerId, industry, fromName }, `🔔 客人提供發票資訊，需人工開立發票：\n\n${text.slice(0, 300)}`)
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
    dispatchTicketNotify(knowledge.notifyWebhooks, { platform, customerId, industry: knowledge.industry, fromName }, `🔔 客人要求人工客服：\n\n${text.slice(0, 300)}`)
    const reply = '好的，已為您安排專人服務，客服人員會盡快與您聯繫，請稍候 🙏'
    void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply, fromName)
    return reply
  }

  // ── 退換貨/退款：一律轉人工（沒有任何方案支援 AI 自動執行退款）──────────
  // 單純問取消/退款政策（沒有要求真的採取行動）不轉人工，讓 AI 照常回答問題。
  const isRefundPolicyQuestion = REFUND_POLICY_RE.test(text) && !REFUND_ACTION_RE.test(text)
  if (REFUND_RE.test(text) && !isRefundPolicyQuestion) {
    try {
      await getServiceClient().from('cs_tickets').insert({
        user_id: userId, industry: knowledge.industry, platform, from_id: customerId,
        subject: text.slice(0, 80), description: '客人提出退換貨/退款需求',
        priority: 'high', intent: '人工客服請求',
      })
    } catch { /* ignore */ }
    dispatchTicketNotify(knowledge.notifyWebhooks, { platform, customerId, industry: knowledge.industry, fromName }, `🔔 客人提出退換貨/退款需求：\n\n${text.slice(0, 300)}`)
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
      .select('name, summary, stage, price_ask_count, message_count, discount_offered_at, facts')
      .eq('user_id', userId).eq('platform', platform).eq('from_id', customerId).eq('industry', knowledge.industry)
      .single()
    cust = (data as CsCustomerRow | null) ?? null
  } catch { /* 表可能尚未建立 */ }

  const rawReply = await getAIReply(text, knowledge, history, userId, buildSellSection(cust, convoPriceAsks, isPriceAskNow, text), gapNote, imageBuffer, imageMimeType, platform, customerId, !!cust?.discount_offered_at)
  const { visibleReply: withoutForm, submit: formSubmit } = extractFormSubmit(rawReply)
  const { visibleReply: reply, offered: discountJustOffered } = extractDiscountOffered(withoutForm)
  if (formSubmit) void saveFormSubmissionFromChat(userId, platform, customerId, knowledge.industry, knowledge.csForms, formSubmit)
  void logCsMessage(userId, platform, customerId, knowledge.industry, text, reply, fromName)

  // 客人確認訂單 → 開待跟進工單（AI 只會口頭說「安排專員」，本身不通知）
  if (knowledge.bookingFlowEnabled) {
    void maybeCreateOrderTicket(userId, platform, customerId, knowledge.industry, history, text, knowledge.notifyWebhooks, fromName)
  }
  // 客人提供匯款末五碼 → 不論訂房走的是哪套流程，都直接建工單通知管家核對
  void maybeCreatePaymentProofTicket(userId, platform, customerId, knowledge.industry, history, text, knowledge.notifyWebhooks, fromName)
  // 客人回覆發票抬頭/統一編號 → 直接建工單通知專員實際開立發票，不能只靠 AI 口頭收下
  void maybeCreateInvoiceTicket(userId, platform, customerId, knowledge.industry, history, text, knowledge.notifyWebhooks, fromName)

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
      discount_offered_at: cust?.discount_offered_at ?? (discountJustOffered ? new Date().toISOString() : null),
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
  slug: string
  fields: CsFormField[]
  trigger_keywords: string
  notify_target: CsFormNotifyTarget
  confirm_before_fields: boolean
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
  corrections: string
  notifyWebhooks: NotifyWebhook[]
  contactPhone1: string
  contactPhone2: string
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
  let notifyWebhooks: NotifyWebhook[] = []
  let contactPhone1 = ''
  let contactPhone2 = ''
  const knowledgeParts: string[] = []

  // CS 設定（systemPrompt、付款資訊、訂房流程等）只採用「最新一筆有內容的 campaign」，
  // 避免多筆 campaign 各自局部覆寫造成設定互相打架。
  //
  // 但知識庫內容（直接輸入知識、上傳的對話檔）改成合併「所有」campaign，不再只取
  // 最新一筆就整批捨棄其他 campaign 的知識——真實案例：喬民宿同時有多筆 campaign
  // 各自存了不同知識（一筆是完整的民宿 FAQ 對話檔，另一筆是後來新增的國旅補助活動
  // 說明），舊寫法只認「最新更新的那一筆」，只要任何一筆 campaign 之後被其他操作
  // （例如編輯自建表單、通知設定）順手更新一下 updated_at，就會整批換成另一筆
  // campaign 的內容，原本在用的知識庫就整個消失、客人問到的資訊 AI 完全答不出來，
  // 也不會有任何錯誤訊息可以察覺。
  let settingsLoaded = false
  if (campaigns?.length) {
    for (const camp of campaigns) {
      const unit12 = (camp.unit_data as Record<string, unknown>)?.[12] as Record<string, unknown> | undefined
      if (!unit12) continue

      const hasContent = !!(unit12.systemPrompt || unit12.knowledgeBase
        || (Array.isArray(unit12.dialogueFiles) && unit12.dialogueFiles.length > 0))

      if (!settingsLoaded && hasContent) {
        if (unit12.systemPrompt) systemPrompt = String(unit12.systemPrompt)
        if (unit12.escalationThreshold) escalationThreshold = unit12.escalationThreshold as 'medium' | 'high'
        if (unit12.replyLanguage) replyLanguage = String(unit12.replyLanguage)
        if (unit12.bookingFlowEnabled) bookingFlowEnabled = Boolean(unit12.bookingFlowEnabled)
        if (unit12.paymentInfo) paymentInfo = String(unit12.paymentInfo)
        if (Array.isArray(unit12.bookingFlows)) bookingFlows = unit12.bookingFlows as BookingFlowDef[]
        if (typeof unit12.discountMaxPct === 'number') discountMaxPct = unit12.discountMaxPct
        if (unit12.discountGifts) discountGifts = String(unit12.discountGifts)
        if (Array.isArray(unit12.notifyWebhooks)) notifyWebhooks = unit12.notifyWebhooks as NotifyWebhook[]
        if (unit12.contactPhone1) contactPhone1 = String(unit12.contactPhone1)
        if (unit12.contactPhone2) contactPhone2 = String(unit12.contactPhone2)
        settingsLoaded = true
      }

      // Direct text knowledge input（合併全部 campaign）
      if (unit12.knowledgeBase) knowledgeParts.push(`【直接輸入知識】\n${String(unit12.knowledgeBase)}`)

      // Dialogue files（CS 專用，合併全部 campaign）
      const dialogueFiles = (unit12.dialogueFiles ?? []) as Array<{ name: string; textContent?: string }>
      for (const f of dialogueFiles) {
        if (f.textContent) {
          knowledgeParts.push(`【知識庫｜${f.name}】\n${f.textContent}`)
        }
      }
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

  // 自建表單：只載入有設定觸發關鍵字、啟用中、且今天有開放的表單
  // （沒有關鍵字的表單只能靠公開連結填寫；今天不開放的表單直接不讓 AI 知道，
  // 不會讓 AI 先問完一堆欄位才在最後才發現今天不能送——同一個場景要「某幾天用
  // 別的表單/別的通知對象」，就建多個表單、各自設定開放星期即可）
  const { data: formRows } = await supabase
    .from('cs_forms')
    .select('id, name, slug, fields, trigger_keywords, notify_target, available_weekdays, confirm_before_fields')
    .eq('user_id', userId)
    .eq('enabled', true)
    .neq('trigger_keywords', '')
  const csForms = ((formRows ?? []) as (CsChatForm & { available_weekdays: number[] })[])
    .filter(f => isFormAvailableToday(f.available_weekdays))

  // 員工在工作台回報的「AI 回答修正」——授權協作者不用每次都經過 owner 本人處理，
  // 貼上錯誤回覆＋正確做法後立即生效，owner 事後可在工作台一鍵撤銷（見 cs_ai_corrections）
  const { data: correctionRows } = await supabase
    .from('cs_ai_corrections')
    .select('situation, wrong_reply, correct_guidance')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(30)
  const corrections = (correctionRows ?? []).length
    ? (correctionRows ?? []).map((c, i) =>
        `${i + 1}. 情境：${c.situation}\n   之前錯誤回覆：${c.wrong_reply}\n   正確做法：${c.correct_guidance}`,
      ).join('\n')
    : ''

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
    corrections,
    notifyWebhooks,
    contactPhone1,
    contactPhone2,
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
// 手機號碼（09 開頭，可能有 +886/886 國碼、可能有 -／空白分隔），跟 NUMERIC_ORDER_RE
// 不會撞在一起（訂單號規則要求開頭 1-9 且無 0），可以放心並存判斷。
const PHONE_RE = /(?<!\d)(?:\+?886[-\s]?9\d{2}|09\d{2})[-\s]?\d{3}[-\s]?\d{3}(?!\d)/
// 訂房平台給客人看的訂單碼常常有英文字母前綴（例如易遊網「ORD0031572074」），既不是
// NUMERIC_ORDER_RE（純數字）也不是 NAME_ONLY_RE（純文字）——這種訊息以前完全沒有觸發
// 任何查詢，externalDataSection 維持空白，AI 在沒有任何系統資料的情況下自己編了一組
// 房號密碼給客人（真實案例：客人給「ORD0031572074」，AI 回「房號301,密碼2937#」，
// 兩者都是憑空捏造，真實資料完全不同）。加這條規則確保只要訊息長得像一組訂單代碼，
// 就算查不到系統裡的號碼，也會強制查一次、注入「查無資料」的誠實訊息，而不是放著讓
// AI 自由發揮。
const ALPHANUMERIC_ORDER_RE = /\b[A-Za-z]{2,8}[-\s]?\d{5,}\b/

// 客人只報「訂房大名」、沒給訂單號碼時，用來判斷「這則訊息本身像不像一個姓名」
// （中英文姓名、無問句、無多餘內容），搭配對話中出現訂單/訂房相關字眼才觸發查詢
const NAME_ONLY_RE = /^[A-Za-z一-鿿][A-Za-z一-鿿\s.'-]{1,39}$/
const BOOKING_INTENT_RE = /訂單|訂房|預訂|預定|入住|訂位|reservation|booking|大名|姓名/i
// 常見的簡短應答／確認詞——雖然符合 NAME_ONLY_RE（純文字、無數字），但客人回覆這些字時
// 絕對不是在報訂房姓名（常見情境：客服剛傳完付款帳號，客人回「OK」確認收到，卻被誤判成
// 姓名去查訂單，查無資料後 AI 講出「查無訂單編號為『OK』的資料」這種文不對題的回覆）
const NON_NAME_ACK_RE = /^(ok+|okay|k|kk|好|好的|好喔|好啊|嗯|嗯嗯|收到|了解|明白|知道了|謝謝|謝了|感謝|thanks?|thank\s*you|yes|yep|yeah|no|不用|不是|是的|是|對|對的|沒問題|可以|沒事|辛苦了)$/i

// ── 訂單號碼／手機號碼／訂房姓名任兩種方式都查無資料 → 真的建立工單通知專員 ──
// 之前的修法只讓 AI 引導客人「換個方式再查一次」，但客人如果換了方式仍然查無資料，
// 代表這真的需要人工協助（可能是系統資料沒建好），這時才真的建立工單通知專員，
// 不能讓客人一直被要求換方式、卻永遠等不到真人回覆。
// 真實案例：客人先給了電話（查無資料），後來又給了訂房平台訂單編號（也查無資料），
// 但因為他從沒有單獨傳過一則「只有姓名」的訊息（一直是「平台 XXX / 姓名 XXX」這種
// 複合格式），原本要求「訂單、電話、姓名三種都要各自失敗過一次」才建工單的條件永遠
// 湊不齊 name 這一種，導致系統無限迴圈地要求客人「換個方式再查一次」——甚至還會
// 要求客人重新提供「剛剛已經給過、已經查無資料」的同一組電話，讓客人以為 AI 完全沒
// 记住前面講過的話。改成只要有任兩種不同方式都失敗過，就視為已經充分嘗試、真的建
// 工單，不必湊滿三種。
type LookupKind = 'order' | 'phone' | 'name'

function classifyLookupKind(text: string, recentText: string): LookupKind | null {
  const t = text.trim()
  if (NUMERIC_ORDER_RE.test(t) || ALPHANUMERIC_ORDER_RE.test(t)) return 'order'
  if (PHONE_RE.test(t)) return 'phone'
  if (NAME_ONLY_RE.test(t) && !NON_NAME_ACK_RE.test(t) && BOOKING_INTENT_RE.test(recentText)) return 'name'
  return null
}

// 掃過去對話紀錄，找出客人「試過但查無資料」的識別方式種類（用查詢結果訊息裡
// 固定會出現的「查無」二字判斷該次查詢是否失敗）
function priorFailedLookupKinds(history: HistoryMsg[]): Set<LookupKind> {
  const kinds = new Set<LookupKind>()
  for (let i = 0; i < history.length; i++) {
    const m = history[i]
    if (m.role !== 'user') continue
    const recentText = history.slice(Math.max(0, i - 4), i).map(x => x.content).join('\n')
    const kind = classifyLookupKind(m.content, recentText)
    if (!kind) continue
    const nextAssistant = history[i + 1]
    if (nextAssistant?.role === 'assistant' && nextAssistant.content.includes('查無')) {
      kinds.add(kind)
    }
  }
  return kinds
}

// 三種方式都查無資料時才會呼叫——真的建立工單，之後才能讓 AI 誠實告知客人已建立工單
async function createExhaustedLookupTicket(
  userId: string, platform: string, customerId: string, industry: string, lastMessage: string, notifyWebhooks: NotifyWebhook[],
): Promise<void> {
  try {
    const { data: existing } = await getServiceClient()
      .from('cs_tickets')
      .select('id')
      .eq('user_id', userId).eq('from_id', customerId)
      .eq('intent', '查無資料人工協助')
      .in('status', ['open', 'in_progress'])
      .limit(1)
    if (existing?.length) return  // 已有未結工單，不重複建立
    await getServiceClient().from('cs_tickets').insert({
      user_id: userId, industry, platform, from_id: customerId,
      subject: '客人訂單號碼/手機號碼/訂房姓名皆查無資料',
      description: `客人依序嘗試訂單號碼、手機號碼、訂房姓名三種方式查詢，系統都查無對應資料，需要專員人工協助核對。\n\n最後一則訊息：${lastMessage.slice(0, 300)}`,
      priority: 'high', intent: '查無資料人工協助',
    })
    dispatchTicketNotify(notifyWebhooks, { platform, customerId, industry }, `🔔 客人訂單號碼/手機號碼/訂房姓名皆查無資料：\n\n${lastMessage.slice(0, 300)}`)
  } catch { /* 不中斷主流程 */ }
}

// 客人身分事實（訂單號碼/電話/訂房大名）在「查詢成功比對到訂單」的當下直接記住，
// 供之後對話（甚至是之後開的新對話）直接引用，不用每次都重新要求客人提供已經核對
// 過的資訊——真實案例：客人已核對過的姓名/電話，換一則訊息或隔一段時間再問，AI
// 又從頭問一次，客人會覺得完全沒被記住。fire-and-forget，不影響主流程。
async function saveConfirmedFacts(
  userId: string, platform: string, customerId: string, industry: string,
  facts: Record<string, string>,
): Promise<void> {
  try {
    const sb = getServiceClient()
    const { data: existing } = await sb
      .from('cs_customers')
      .select('facts')
      .eq('user_id', userId).eq('platform', platform).eq('from_id', customerId).eq('industry', industry)
      .maybeSingle()
    const merged = { ...(existing?.facts as Record<string, string> | null ?? {}), ...facts }
    await sb.from('cs_customers').upsert({
      user_id: userId, platform, from_id: customerId, industry, facts: merged,
      last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform,from_id,industry' })
  } catch { /* 不中斷主流程 */ }
}

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
async function buildSalesContext(userId: string, discountMaxPct: number, discountGifts: string, discountAlreadyOffered: boolean): Promise<string> {
  const supabase = getServiceClient()
  const sections: string[] = []

  // Property availability + gentle urgency (homestay; empty for other industries)
  try {
    const { data: properties } = await supabase
      .from('properties').select('id, name, description, max_guests, base_price, extra_guest_fee, max_extra_beds, extra_bed_fee, dynamic_pricing_enabled')
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
        const bedNote = p.max_extra_beds > 0 ? `，可加床最多 ${p.max_extra_beds} 床${p.extra_bed_fee ? `（$${Number(p.extra_bed_fee).toLocaleString()}/床/晚）` : ''}` : ''
        const dynNote = p.dynamic_pricing_enabled ? '（假日/特定日期價格另計，請客人提供入住日期以精算實際房價）' : ''
        lines.push(`\n▸ ${p.name}${p.description ? `（${p.description}）` : ''}，最多 ${p.max_guests ?? '—'} 人，基本價 $${p.base_price ?? '—'}/晚${feeNote}${bedNote}${dynNote}`)
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

  // Closing toolkit (discounts / gifts) —— 整個對話最多只能主動提供一次，真實案例：
  // 客人在同一次對話裡分兩次表達價格不滿（第一次擔心暈船、第二次抱怨長輩票價變貴），
  // AI 依規則兩次都各自送出一次優惠（折價券 + 再折現金），把整趟行程的利潤折光，
  // 因為規則本身沒有記錄「這次對話是否已經給過優惠」。現在用 cs_customers.discount_offered_at
  // 這個實際欄位擋住第二次，而不是只靠提示詞叫 AI 自己記得。
  const giftList = (discountGifts ?? '').split('\n').map(g => g.trim()).filter(Boolean)
  if (discountMaxPct > 0 || giftList.length) {
    if (discountAlreadyOffered) {
      sections.push('【促成工具箱——這位客人這次對話已經拿過優惠了】絕對不可以再提供任何折扣或贈品，就算客人又表達不滿或抱怨也一樣；只能同理客戶的感受、用非金錢方式回應（例如強調品質、服務保證、解答疑慮），不要提到「已經用完優惠額度」這類會讓客人追問的說法，自然地把話題帶回行程本身。')
    } else {
      const lines = ['【促成工具箱——客人猶豫或嫌貴時才使用，整個對話最多主動提供一次，用過就不能再用】']
      lines.push('使用時機：客人第一次表現出價格猶豫或不滿就要主動提出，不要等客人講第二次才給——包括但不限於「有點貴」「我再想想」「考慮看看」「太貴了」「能不能便宜一點」「以前/之前訂比較便宜」「怎麼差那麼多」「別家比較便宜」等任何對價格表達疑慮或比較的說法，只要客人在問完價格後表達了「不滿意/意外/猶豫」的情緒，就算沒有用到上面例句的字眼，也要主動提出優惠，不要只顧著解釋定價邏輯而不提供優惠')
      if (discountMaxPct > 0) lines.push(`\n可提供折扣：最多 ${discountMaxPct}% off（算出折後金額告知客人，客人確認則生效）`)
      if (giftList.length) { lines.push('\n可贈送項目（從以下選一項，問客人偏好）：'); giftList.forEach(g => lines.push(`• ${g}`)) }
      lines.push('\n優惠確認後必須在最終訂單確認清單中標注（例：含免費早餐 / 享9折優惠）')
      lines.push('\n【重要】這個優惠整個對話只能主動提供一次——一旦你在這則回覆裡真的提出折扣或贈品，就要在回覆最後另起一行，原樣輸出（客人看不到，系統會自動移除）：\n<<<DISCOUNT_OFFERED>>>\n如果只是在解釋定價、還沒有真正給出優惠，就不要輸出這行。')
      sections.push(lines.join('\n'))
    }
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

// 促成工具箱標記——AI 這則回覆真的有給折扣/贈品時才會輸出，用來讓伺服器記住
// 「這位客人這次對話已經拿過優惠」，下一輪起擋掉促成工具箱，不能靠 AI 自己記得
// （見 buildSalesContext 註解：真實案例客人分兩次抱怨，AI 兩次都各自給了優惠）
const DISCOUNT_OFFERED_RE = /\n*<<<DISCOUNT_OFFERED>>>\n*/

function extractDiscountOffered(reply: string): { visibleReply: string; offered: boolean } {
  const offered = DISCOUNT_OFFERED_RE.test(reply)
  return { visibleReply: offered ? reply.replace(DISCOUNT_OFFERED_RE, '').trim() : reply, offered }
}

function buildFormsSection(forms: CsChatForm[]): string {
  if (!forms.length) return ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const list = forms.map(f => {
    const kws = f.trigger_keywords.split(',').map(k => k.trim()).filter(Boolean).join('、')
    const fieldLines = f.fields.map(field => {
      const opt = field.options?.length ? `，選項：${field.options.join('、')}` : ''
      return `  - id="${field.id}" ${field.label}${field.required ? '（必填）' : '（選填）'}${opt}`
    }).join('\n')
    const confirmNote = f.confirm_before_fields
      ? `開始問欄位之前：如果同一件事上方知識庫另外還列了其他替代方案或選項（例如同一個需求有兩種不同的滿足方式），要先把選項列給客人選、確認客人明確選的是這個表單對應的方案，才能開始依序問欄位；客人選的是其他替代方案，就依知識庫內容回答，不要問這裡的欄位。如果知識庫沒有列出替代方案，可以直接開始問欄位，不用多問一輪。`
      : `這個表單不用先確認替代方案，客人提到觸發字詞就可以直接依序開始問下面的欄位。`
    const linkNote = appUrl ? `這個表單的公開填寫連結是：${appUrl}/f/${f.slug}——客人如果想要自己點連結填寫（而不是在對話裡一題一題回答），或明確要求「給我連結/網址」，可以直接照抄提供這個連結，不用只靠對話問欄位這一種方式。` : ''
    return `【表單：${f.name}】(formId="${f.id}")\n觸發：客人提到「${kws}」等字詞時可能想使用這個表單。${confirmNote}${linkNote ? `\n${linkNote}` : ''}\n一次只問一個欄位，已回答的不要重複問：\n${fieldLines}`
  }).join('\n\n')

  // 真實案例：早餐表單「房號」欄位是下拉選單（列出 5 個房型），客人整棟包下、
  // 10 位大人一起訂早餐（不屬於任何單一房號），AI 卻堅持要客人從選項裡選一個
  // 「代表房號」，客人已經明確說「包棟」了，AI 還是聽不懂、無限迴圈追問，最後
  // 只能真人介入手動下單。選項清單是商家預設的常見情境，不是客人回答的唯一
  // 合法範圍——客人的回答只要清楚對應到這個欄位在問的事，就算不在選項清單裡
  // （例如「包棟」「都可以」「以上皆是」這類不屬於單一選項的合理答案），也要
  // 直接採用客人原本的說法記錄下來，不能為了「一定要選單裡的其中一個」而卡住
  // 不放，讓客人重複解釋同一件事。
  const outOfListNote = `\n\n選項清單是商家列出的常見情境，不是客人唯一能選的範圍：客人的回答只要清楚對應到該欄位在問的事，即使不在選項清單裡（例如「包棟」「都可以」這類不屬於單一選項的合理答案），也要直接照客人原本的說法記錄，不要因為答案不在清單裡就重複追問或卡住。`

  return `\n\n【自建表單問答——比照下方規則執行】
${list}${outOfListNote}

當上面某個表單的所有「必填」欄位都已在對話中得到客人明確回答後：
1. 先用一句自然的話回覆客人（例如「已收到，謝謝您！」），不要提到「表單」「系統」「標記」等字眼
2. 接著另起一行，原樣輸出（客人看不到這行，系統會自動移除，格式不可更動）：
<<<FORM_SUBMIT:{"formId":"對應的 formId","answers":{"欄位id":"客人的回答"}}>>>
必填欄位尚未問完前，絕對不可輸出這行；不同表單一次只處理一個。

表單只要已經開始問（有任一欄位得到回答），就算「進行中」，在必填欄位問完、輸出上面那行標記之前：
- 絕對不能用「已幫您記下/已登記/已完成/已為您安排/已收到您的訂單」這類讓客人以為已經送出成功的說法，要讓客人清楚知道還缺哪個必填欄位、還沒有完成。
- 客人中途問了不相關的問題或切換話題（例如問停車、問行李寄放、問密碼），正常回答那個問題就好，但回答完一定要接著問這個表單還缺的必填欄位，不能就此放棄不再問，也不能誤以為表單已經結束。
- 如果客人在其他情境下提供的內容剛好能回答這個進行中表單缺少的必填欄位（例如客人為了核對身份講出房號，而這個房號正好也是表單缺少的欄位），把這個值視為已回答該欄位，不用讓客人重複講一次。`
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
// AI 在生成這則回覆時已經跟客人說「已收到」，這裡如果查到當天已有一模一樣的內容，
// 代表是重複送出（同一份訂單被問完兩次），靜默略過即可，不用再打擾客人；但如果是
// 查無入住紀錄，代表可能不是當天入住的客人，AI 沒能力事先擋下（標記是回覆生成完
// 才解析出來），只能事後主動補一則訊息請客人確認，而不是照樣通知員工出餐。
async function saveFormSubmissionFromChat(
  userId: string, platform: string, customerId: string, industry: string,
  forms: CsChatForm[], submit: ParsedFormSubmit,
): Promise<void> {
  const form = forms.find(f => f.id === submit.formId)
  if (!form) return
  try {
    const supabase = getServiceClient()
    const match = await resolveTodaySubmission(supabase, form.id, form.fields, submit.answers)
    if (match.kind === 'duplicate') return

    const roomCheck = await verifyRoomCheckedInToday(supabase, userId, form.fields, submit.answers)
    if (!roomCheck.ok) {
      void sendToCustomer(userId, platform, customerId, `不好意思，${roomCheck.reason}`)
      return
    }

    const notifyTarget = form.notify_target
    const isImmediate = notifyTarget?.batchMode === 'immediate'
    const isUpdate = match.kind === 'update'
    // 同一個房號當天已有紀錄、但這次答案不同 → 客人是在改原本的訂單，直接覆蓋原紀錄，
    // 不要另開一筆讓員工分不清哪筆才是最終版本（見 resolveTodaySubmission 註解）
    const { data: row } = isUpdate
      ? await supabase.from('cs_form_submissions')
          .update({ answers: submit.answers, updated_at: new Date().toISOString(), notified_at: null, notify_error: null })
          .eq('id', match.existingId!)
          .select('id')
          .single()
      : await supabase.from('cs_form_submissions').insert({
          form_id: form.id, user_id: userId, industry,
          answers: submit.answers, source: 'cs_chat', platform, from_id: customerId,
        }).select('id').single()
    // notified_at 只在真的送出成功才標記——之前不管有沒有送成功都直接標記，
    // 通知因為 LINE token 失效送不出去時完全沒有人知道。
    if (isImmediate && row) {
      void notifyFormSubmission(
        userId, notifyTarget, form.name,
        formatFormSubmission(form.name, form.fields, submit.answers, null, isUpdate),
        { fields: form.fields, answers: submit.answers, roomRef: null },
      ).then(result => getServiceClient()
        .from('cs_form_submissions')
        .update(result.ok ? { notified_at: new Date().toISOString() } : { notify_error: result.error ?? '未知錯誤' })
        .eq('id', row.id))
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
    // 網址後面緊接中文/全形標點卻沒有換行或空白，通訊軟體的超連結偵測會把後面的文字
    // 也吃進同一個超連結，變成打不開的錯誤網址（真實案例：「...parkingread。日後若
    // 需要查詢...」整段被判斷成一個超連結）。不只靠提示詞叫 AI 自己換行——這裡直接
    // 在輸出端偵測「網址後面緊接中文字/全形標點」就強制插入換行，不管 AI 有沒有照做。
    .replace(/(https?:\/\/[^\s　-鿿＀-￯]+)(?=[　-鿿＀-￯])/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')                  // bold
    .replace(/(?<!\d)\*(?!\d)(.+?)(?<!\d)\*(?!\d)/g, '$1') // italic (skip * next to digits)
    .replace(/^[\*\-] /gm, '')                         // bullets
    .replace(/^#{1,6} /gm, '')                         // headings
    .replace(/---+/g, '')                              // hr
    .trim()
}

// ── 密碼/房號輸出的最後一道防線：不靠指令，靠事實 ──────────────────────────
// 前面加了再多「禁止捏造」的系統提示，本質上都只是「拜託模型別亂講」，模型仍然可能
// 不遵守（真實案例：客人給的訂單碼格式沒觸發任何查詢，模型還是自己編了一組房號密碼）。
// 這裡不再靠「猜有哪些輸入格式該觸發查詢」來補洞，而是直接在輸出端做事實查核：
// 回覆裡如果出現「密碼/房號/門鎖代碼」後面接著一串英數字，但這組值從來沒有出現在系統
// 真正查到的資料（externalDataSection）或這通對話先前已經給過的內容裡，一律視為捏造，
// 攔截换成制式的「請提供識別資訊」，不讓這種回覆真的送到客人手上。
// 上限從 10 拉到 32：門鎖/WiFi 密碼偶爾比 10 碼長（例如知識庫常見的英數混合密碼），
// 上限太短會讓超長的捏造值完全落在偵測範圍外、悄悄放行。
// 用捕獲群組留住標籤（密碼/房號/門鎖代碼），房號的「有憑有據」判斷比密碼更嚴格——見下方。
const SENSITIVE_REVEAL_RE = /(密碼|房號|門鎖代碼)[：:是為]?\s*([A-Za-z0-9#]{3,32})/g
// 真實案例：客人說「已付訂金1000元，想確認餘款」，系統其實從未查詢、也查不到任何訂金／
// 餘額資料（check-in 查詢流程只回房號密碼，不含金流明細），AI 卻直接編了一個「剩餘款項
// 為1200元」給客人——3132-1000 根本不等於1200，純屬憑空捏造。餘款/尾款這類金額跟房號
// 一樣是「這位客人專屬」的事實，永遠不能讓知識庫的內容背書（知識庫不會寫特定客人欠多少
// 錢），只能來自這次真的查到的訂單資料；目前系統本來就沒有訂金/餘額查詢功能，等於這類
// 宣告一律會被攔截，逼 AI 老實說查無明細，而不是自己算一個數字出來。
const BALANCE_REVEAL_RE = /(餘款|尾款|剩餘款項|餘額|差額)[：:是為約]{0,2}\s*(?:NT\$|NTD\$?|\$)?\s*([\d,]{2,10})\s*元?/g
const NO_FABRICATION_FALLBACK = '不好意思，目前無法為您查詢到相關資訊，麻煩提供您的訂單編號、訂房大名或訂房手機號碼，我立即為您確認。'
const BALANCE_ESCALATION_FALLBACK = '不好意思，系統目前無法查詢訂金與餘額明細，我已經幫您通知管家人工核對，確認後會盡快回覆您正確的金額，謝謝您的耐心等候。'

// 客人問訂金/餘款時，系統本來就沒有金流查詢功能，不能只丟一句「查無資料」就結束——
// 真實案例顯示這種情況客人會反覆追問，AI 也可能在後續某一輪又忍不住編一個數字。
// 這裡直接建立工單通知管家人工核對，比照 createExhaustedLookupTicket 的「先真的建立
// 工單，才能讓 AI 誠實說已經轉真人」邏輯，避免又是一句沒有兌現的空話。
async function createBalanceCheckTicket(
  userId: string, platform: string, customerId: string, industry: string, lastMessage: string, notifyWebhooks: NotifyWebhook[],
): Promise<void> {
  try {
    const { data: existing } = await getServiceClient()
      .from('cs_tickets')
      .select('id')
      .eq('user_id', userId).eq('from_id', customerId)
      .eq('intent', '訂金餘款人工核對')
      .in('status', ['open', 'in_progress'])
      .limit(1)
    if (existing?.length) return  // 已有未結工單，不重複建立
    await getServiceClient().from('cs_tickets').insert({
      user_id: userId, industry, platform, from_id: customerId,
      subject: '客人詢問訂金/餘款，系統無金流查詢功能',
      description: `客人詢問訂金或剩餘款項，系統沒有訂金/付款明細查詢功能，AI 已誠實告知查無資料，需要專員人工核對金額。\n\n最後一則訊息：${lastMessage.slice(0, 300)}`,
      priority: 'high', intent: '訂金餘款人工核對',
    })
    dispatchTicketNotify(notifyWebhooks, { platform, customerId, industry }, `🔔 客人詢問訂金/餘款，需人工核對：\n\n${lastMessage.slice(0, 300)}`)
  } catch { /* 不中斷主流程 */ }
}

async function enforceNoFabricatedReveal(
  reply: string, externalDataSection: string, history: HistoryMsg[], knowledgeBase: string,
  userId: string, platform: string, customerId: string, industry: string, lastMessage: string,
  notifyWebhooks: NotifyWebhook[] = [],
): Promise<string> {
  const idMatches = [...reply.matchAll(SENSITIVE_REVEAL_RE)]
  const balanceMatches = [...reply.matchAll(BALANCE_REVEAL_RE)]
  if (!idMatches.length && !balanceMatches.length) return reply
  const priorAssistantText = history.filter(m => m.role === 'assistant').map(m => m.content).join('\n')
  const backedByQuery = (v: string) => externalDataSection.includes(v) || priorAssistantText.includes(v)
  // 真實案例：查無資料的情況下，AI 還是自己編了一個「房號：201」——201 剛好也出現在
  // 知識庫的房型介紹清單裡（房型列表本來就會列出全部房號），舊版邏輯把「知識庫裡有出現
  // 這個字串」當成有憑有據，結果知識庫的房型清單反而變成 AI 捏造房號時的擋箭牌。
  // 房號是「這位客人的房間是幾號」這種客人專屬事實，只能來自這次真的查到的訂單資料，
  // 不能只因為知識庫的房型列表剛好提到同一個數字就當作有根據；密碼/門鎖代碼則維持原本
  // 允許知識庫背書（全館通用的 WiFi 密碼、公共門鎖代碼本來就白紙黑字寫在知識庫裡，不是
  // 客人專屬資料，不需要走查詢流程）。
  const hasUnbackedId = idMatches.some(([, label, value]) => {
    if (backedByQuery(value)) return false
    if (label === '房號') return true
    return !knowledgeBase.includes(value)
  })
  const hasUnbackedBalance = balanceMatches.some(([, , value]) => !backedByQuery(value.replace(/,/g, '')))
  if (hasUnbackedBalance) {
    await createBalanceCheckTicket(userId, platform, customerId, industry, lastMessage, notifyWebhooks)
    return BALANCE_ESCALATION_FALLBACK
  }
  return hasUnbackedId ? NO_FABRICATION_FALLBACK : reply
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
  platform = '',
  customerId = '',
  discountAlreadyOffered = false,
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

    // 真實案例：管家人工提示客人「輸入『帳號』二字取得付款資訊」（民宿慣用的付款觸發詞，
    // 知識庫的賞鯨付款說明也是這樣寫），但客人真的只回一個「帳號」時，這則訊息完全沒有
    // 上下文可依循（跟管家提示之間常常隔了好幾小時，系統會判斷成新的一輪對話），AI 只能
    // 自己猜「帳號」是在問什麼，結果猜成 WiFi 帳號。這裡直接把它當成固定觸發詞處理，
    // 不讓 AI 用猜的。
    // 這支路由是全平台商家共用的同一份程式碼，不是只服務單一商家——「帳號＝匯款帳號」
    // 只是民宿業「線上訂房/訂行程一律用匯款」這種場景的慣例，換成其他產業（例如會員制、
    // 教育類），客人講「帳號」很可能是在問登入帳號，此時套用這條規則反而會答錯，所以
    // 額外限制只在 homestay 產業才啟用，避免這條規則影響到其他產業的商家。
    const PAYMENT_ACCOUNT_KEYWORD_RE = /^(匯款)?帳(號|戶)$/
    if (knowledge.industry === 'homestay' && PAYMENT_ACCOUNT_KEYWORD_RE.test(message.trim()) && knowledge.paymentInfo) {
      externalDataSection = `\n\n【系統提示——客人輸入的「帳號」是本民宿詢問付款/匯款帳號的固定觸發詞，不是在問 WiFi 帳號或其他帳號，請直接提供以下匯款資訊】\n${knowledge.paymentInfo}${externalDataSection}`
    }

    // 偵測訂單號 → 提供入住密碼（兩種來源都受入住時間限制）
    let orderLookupDone = false
    let currentLookupKind: LookupKind | null = null
    let currentLookupFailed = false
    if (userId) {
      // 上一輪如果是「請問訂房登記的姓名是不是「XXX」呢？」的身份核對問句，且客人這則訊息
      // 是明確的肯定回覆（且沒有夾帶新的訂單號碼/電話，那種情況讓下面照舊走新的查詢），
      // 才用這個已經核對過的姓名重查、直接給密碼——沒有核對過的模糊比對絕對不能直接洩漏。
      // 真實案例：客人回「對對！」，固定 regex 只認得單獨「對」字或「是的／沒錯」等固定
      // 詞語，判斷失敗後系統再也不會用核對過的姓名重查，客人被卡在一直被要求提供手機
      // 號碼（但那組手機號碼本來就查不到）的死循環裡，永遠拿不到密碼——改用 LLM 判斷
      // 客人是否為肯定回覆，涵蓋各種口語說法。
      const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant')?.content ?? ''
      const verifyMatch = lastAssistantMsg.match(NAME_VERIFY_ASK_RE)
      let handledByConfirm = false
      if (verifyMatch && !NUMERIC_ORDER_RE.test(message) && !ALPHANUMERIC_ORDER_RE.test(message) && !PHONE_RE.test(message)
        && (await isAffirmativeReply(message.trim(), google('gemini-3.1-flash-lite'))) === 'yes') {
        handledByConfirm = true
        orderLookupDone = true
        currentLookupKind = 'name'
        try {
          const confirmedName = verifyMatch[1]
          const byName = await queryBookingByGuestName(getServiceClient(), userId, confirmedName, google('gemini-3.1-flash-lite'), confirmedName)
          if (byName) {
            currentLookupFailed = byName.includes('查無')
            if (!currentLookupFailed) void saveConfirmedFacts(userId, platform, customerId, knowledge.industry, { confirmedName })
            externalDataSection = `\n\n${byName}${externalDataSection}`
          }
        } catch { /* 不中斷主流程 */ }
      }

      const orderNum = handledByConfirm ? null : (message.match(NUMERIC_ORDER_RE)?.[0] ?? null)
      if (handledByConfirm) {
        // 已經用核對過的姓名處理完這一輪，不再往下走一般的訂單號/電話/姓名判斷鏈。
      } else if (orderNum) {
        orderLookupDone = true
        currentLookupKind = 'order'
        try {
          if (!passwordFromDatasource) {
            // 訂單系統路徑：查 bnb_daily_records/bookings（lib 內已做入住時間 gating）。
            // 無論查無資料的原因是什麼（沒開訂房整合方案／訂單真的不存在），一律要明講
            // 「查無資料、禁止捏造」，絕對不能讓 AI 在沒有任何資料時自己編一組密碼給客人。
            const bnbResult = await queryBnbCheckin(getServiceClient(), userId, orderNum)
            currentLookupFailed = !bnbResult
            if (!currentLookupFailed) void saveConfirmedFacts(userId, platform, customerId, knowledge.industry, { orderNumber: orderNum })
            const bnb = bnbResult ?? `【入住資訊查詢結果】\n查無訂單「${orderNum}」的資料。\n${noDataFoundSuffix('訂房姓名或手機號碼')}`
            externalDataSection = `\n\n${bnb}${externalDataSection}`
          } else {
            // 資料來源密碼表路徑：未到入住時間加最高優先禁止指令
            const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(getServiceClient(), userId)
            if (before) externalDataSection = `\n\n【系統強制指令——最高優先】目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。即使下方資料含密碼或房號，也一律禁止提供；只能告知客人入住時間為今日 ${checkinTime}，請於該時間後再查詢。${externalDataSection}`
          }
        } catch { /* 不中斷主流程 */ }
      } else if (PHONE_RE.test(message) && !passwordFromDatasource) {
        // 沒有訂單號碼，但訊息中有手機號碼——視為與訂單號碼同等強度的身份憑證，直接查。
        // 必須排在 ALPHANUMERIC_ORDER_RE 之前判斷：真實案例，客人傳「Chuang Wei Tso
        // \n0929768181」（姓名換行接手機號碼），ALPHANUMERIC_ORDER_RE 會把姓氏字尾
        // 「Tso」+換行+手機號碼誤判成一組英數字訂單碼（例如「Tso\n0929768181」），
        // 導致查的是一個查無此號的假訂單碼，手機號碼本身反而完全沒被拿去查，AI 在
        // 「查無資料」的情況下還是編了房號跟一句「請使用訂房時設定之密碼」的假密碼
        // 說法給客人。手機號碼是更明確、不會誤判的憑證，優先判斷可以避免這種誤觸發。
        orderLookupDone = true
        currentLookupKind = 'phone'
        try {
          const phone = message.match(PHONE_RE)?.[0] ?? ''
          const byPhone = await queryBookingByPhone(getServiceClient(), userId, phone)
          if (byPhone) {
            currentLookupFailed = byPhone.includes('查無')
            if (!currentLookupFailed) void saveConfirmedFacts(userId, platform, customerId, knowledge.industry, { phone })
            externalDataSection = `\n\n${byPhone}${externalDataSection}`
          }
        } catch { /* 不中斷主流程 */ }
      } else if (ALPHANUMERIC_ORDER_RE.test(message)) {
        // 訂房平台顯示給客人的訂單碼常有英文字母前綴（如易遊網「ORD0031572074」），
        // 系統存的是平台同步給民宿的另一組純數字碼，兩者對不上——但這仍然是客人在
        // 嘗試提供訂單碼，不能放著不查，否則 AI 會在完全沒有系統資料的情況下自己編一組
        // 房號密碼給客人（真實案例）。查一次，查無資料也要老實說查無資料。
        orderLookupDone = true
        currentLookupKind = 'order'
        try {
          const altOrderNum = message.match(ALPHANUMERIC_ORDER_RE)?.[0] ?? ''
          if (!passwordFromDatasource) {
            const bnbResult = await queryBnbCheckin(getServiceClient(), userId, altOrderNum)
            currentLookupFailed = !bnbResult
            if (!currentLookupFailed) void saveConfirmedFacts(userId, platform, customerId, knowledge.industry, { orderNumber: altOrderNum })
            const bnb = bnbResult ?? `【入住資訊查詢結果】\n查無訂單「${altOrderNum}」的資料，系統中沒有這筆訂單（有些訂房平台顯示給客人的訂單號跟系統收到的不同）。\n${noDataFoundSuffix('訂房姓名或手機號碼')}`
            externalDataSection = `\n\n${bnb}${externalDataSection}`
          } else {
            const { before, checkinTime, nowHHMM } = await checkBeforeCheckin(getServiceClient(), userId)
            if (before) externalDataSection = `\n\n【系統強制指令——最高優先】目前台灣時間 ${nowHHMM} 尚未到入住時間（${checkinTime}）。即使下方資料含密碼或房號，也一律禁止提供；只能告知客人入住時間為今日 ${checkinTime}，請於該時間後再查詢。${externalDataSection}`
          }
        } catch { /* 不中斷主流程 */ }
      } else {
        // 沒有訂單號碼/手機號碼，但這則訊息看起來只是「一個姓名」——只有在「上一輪 AI 自己
        // 剛問過客人的訂房大名/姓名」時才觸發查詢，不能只因為最近幾則對話有出現「入住」等
        // 廣義關鍵字就觸發。真實案例：AI 只問了「請問您是今天入住嗎？」（沒有問姓名），客人
        // 回「我在門口」——這不是姓名，也不是在回答姓名，卻被當成姓名去查訂單、比對到不相干
        // 的客人資料。用「上一輪 AI 是否真的問了姓名」這個更精準的條件避免這種誤觸發。
        const lastAssistantTurn = [...history].reverse().find(m => m.role === 'assistant')?.content ?? ''
        const askedForName = /大名|姓名/.test(lastAssistantTurn)
        if (NAME_ONLY_RE.test(message.trim()) && !NON_NAME_ACK_RE.test(message.trim()) && askedForName && !passwordFromDatasource) {
          // NAME_ONLY_RE 只能抓「形式像姓名（無數字無符號）」，抓不到語意——像「我在門口」
          // 這種完整句子一樣會通過形式檢查，所以再用 LLM 判斷這句話語意上是不是真的在報姓名，
          // 不是的話（例如在描述位置、回答是非題）就不觸發查詢，避免拿無關的話去比對訂單。
          if (await looksLikeGuestName(message.trim(), google('gemini-3.1-flash-lite'))) {
            orderLookupDone = true
            currentLookupKind = 'name'
            try {
              const byName = await queryBookingByGuestName(getServiceClient(), userId, message.trim(), google('gemini-3.1-flash-lite'))
              if (byName) {
                currentLookupFailed = byName.includes('查無')
                if (!currentLookupFailed) void saveConfirmedFacts(userId, platform, customerId, knowledge.industry, { confirmedName: message.trim() })
                externalDataSection = `\n\n${byName}${externalDataSection}`
              }
            } catch { /* 不中斷主流程 */ }
          }
        }
      }

      // 客人傳照片（例如訂單/房卡截圖）而不是打字報訂單號時，圖片裡的文字不能直接被
      // 回覆模型當成「已核對」的系統資料採信——先用便宜的圖片辨識抽出訂單號/姓名候選，
      // 一樣走真正的資料庫查詢，查無資料要老實說查無資料。
      if (!orderLookupDone && imageBuffer && imageMimeType) {
        try {
          const clue = await extractOrderClueFromImage(imageBuffer, imageMimeType, google('gemini-3.1-flash-lite'))
          if (clue?.order_number) {
            currentLookupKind = 'order'
            const bnbResult = await queryBnbCheckin(getServiceClient(), userId, clue.order_number)
            currentLookupFailed = !bnbResult
            // 圖片辨識出的訂單號終究是 AI 視覺模型的猜測，不是客人自己打的——即使剛好比對到
            // 系統裡一筆真實存在的訂單，也可能是別人的訂單截圖，查到資料一律先跟客人核對
            // 身份（見 wrapImageDerivedResultForConfirm），不能直接把密碼給出去。
            const bnb = bnbResult
              ? wrapImageDerivedResultForConfirm(bnbResult)
              : `【入住資訊查詢結果】\n查無訂單「${clue.order_number}」的資料。\n${noDataFoundSuffix('訂房姓名或手機號碼')}`
            externalDataSection = `\n\n${bnb}${externalDataSection}`
          } else if (clue?.guest_name) {
            currentLookupKind = 'name'
            const byName = await queryBookingByGuestName(getServiceClient(), userId, clue.guest_name, google('gemini-3.1-flash-lite'))
            if (byName) {
              currentLookupFailed = byName.includes('查無')
              // 圖片辨識出的姓名同樣不是客人自己打的，即使剛好比對到系統裡的訂單，
              // 也要先跟客人核對身份，不能直接洩漏密碼。
              externalDataSection = `\n\n${wrapImageDerivedResultForConfirm(byName)}${externalDataSection}`
            }
          }
        } catch { /* 不中斷主流程 */ }
      }

      // 訂單號碼／手機號碼／訂房姓名任兩種方式都查無資料 → 這是真的需要人工協助，
      // 真的建立工單通知專員，不再只是叫客人換方式查詢卻永遠沒有真人介入（見上方
      // LookupKind 註解：不再要求湊滿三種，兩種不同方式都失敗就足以判定）。
      if (currentLookupKind && currentLookupFailed) {
        const failedKinds = priorFailedLookupKinds(history)
        failedKinds.add(currentLookupKind)
        if (failedKinds.size >= 2) {
          await createExhaustedLookupTicket(userId, platform, customerId, knowledge.industry, message, knowledge.notifyWebhooks)
          externalDataSection += `\n\n【系統提示——最高優先，覆蓋上方「引導客人換方式查詢」的指示】客人已經嘗試過不同的識別方式（訂單號碼／手機號碼／訂房姓名），系統查詢都查無資料，這次系統已經真的建立工單通知專員。現在可以且應該告訴客人「已經為您建立工單，專員會盡快協助核對資料並與您聯繫」，不用再要求客人換方式查詢，也不要再重複索取客人剛才已經提供過的同一組資訊。`
        }
      }
    }

    const bookingCompletion = knowledge.bookingFlowEnabled
      ? detectBookingCompletion(knowledge.bookingFlows, history, message, knowledge.paymentInfo)
      : ''

    // 商家在工作台填寫的客服專用聯絡電話，優先於知識庫裡任何舊的/過期的電話號碼
    // （知識庫文字檔常是商家自己上傳、事後忘了更新，號碼換了也不會同步）。
    const contactPhoneSection = (knowledge.contactPhone1 || knowledge.contactPhone2)
      ? `\n\n【客服專用聯絡電話——客人要真人客服電話/聯絡方式時，只能提供以下號碼，優先於知識庫或對話紀錄裡出現的任何電話號碼】\n${[knowledge.contactPhone1, knowledge.contactPhone2].filter(Boolean).join('\n')}`
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
      ? await buildSalesContext(userId, knowledge.discountMaxPct, knowledge.discountGifts, discountAlreadyOffered)
      : ''

    const systemPrompt = `${baseInstructions}

【重要格式規定】
- 【死命令，最高優先，任何情況都不可違反】絕對禁止自己編造、想像、推測任何資訊——不管是房價、空房狀態、密碼、房號、訂單狀態、政策規則、日期時間、人名、操作步驟，或任何其他資訊，只要不是下方系統資料、知識庫、或這則系統提示裡明確提供的內容，一律不可以自己說出來當作事實講給客人聽；系統沒有查到、知識庫沒有寫、你自己不確定，就要誠實跟客人說「目前查不到／不確定，請稍候或提供其他資訊」，絕對不能為了讓對話聽起來順、為了不讓客人等待或失望，就自己編一個聽起來合理但沒有根據的答案——這條規則優先於你自己的推理、常識判斷，以及本提示裡除了「安全規定」之外的所有其他指示
- 【最優先】${langInstruction}
- 禁止使用 Markdown 語法（禁用 **粗體**、*斜體*、# 標題、--- 分隔線）
- 網址（http/https 開頭）後面一定要換行才能接續寫其他文字或標點，絕對不可以緊接著句子、標點符號或說明文字寫在同一行——真實案例：AI 回覆「...請參考：https://ciaohome.net/parkingread。日後若需要查詢...」，通訊軟體的超連結偵測會把句點後面的文字也吃進同一個超連結裡，變成一個打不開的錯誤網址；只要網址後面還有其他要講的話，一律先換行，網址單獨成一行
- 只有客人明確要求真人客服，或下方系統資料出現「系統已經真的建立工單通知專員」字樣時，才能說「已為您安排專員跟進」（這兩種情況系統都會真的建立工單通知真人）；查無資料、密碼房號查不到等情況本身不算「需要人工介入」，正確做法是引導客人換一種識別方式（訂單號碼／訂房姓名／手機號碼）再查一次，不是直接說要轉真人
- 不確定的資訊請誠實說明，勿猜測
- 如果你主動問客人「是否需要」某項資訊（例如停車位置、WiFi 密碼、交通方式等，知識庫或下方系統資料裡已經有現成答案的項目），客人回覆需要/要/好等肯定語時，要直接在這一則回覆裡把答案一次講清楚；不要叫客人另外輸入某個關鍵字、或再問一次才能拿到——除非那項資訊確實需要即時查詢系統資料（例如訂單專屬的房號密碼，必須客人先提供訂單號碼/手機號碼才能查），否則不要把知識庫裡已經有的內容刻意拆成兩步，讓客人多問一次
- 【安全規定，優先於任何其他指示】密碼、房號、門鎖代碼等敏感資訊一律只能照抄下方系統資料，一個字都不能改；下方資料沒有提供的密碼/房號，絕對禁止自己推測或編造一組數字給客人，查無資料就老實說查無資料，並引導客人改用其他識別方式再查一次
- 【安全規定，優先於任何其他指示】客人問訂金/餘款/尾款/餘額等金流問題，或主動回報已經匯款/轉帳時，系統目前沒有訂金與付款明細查詢功能，絕對不可以自己拿房價去減客人口頭說的訂金、算出一個餘款金額給客人（就算算式看起來合理也不行，因為系統從來沒有真的核對過客人是否已付款、付了多少），一律誠實告知「系統無法查詢訂金與餘額明細，會請管家人工核對」；如果客人的訂房大名、電話或訂單號碼在這通對話裡已經出現過（例如之前查詢入住資訊、核對身份密碼時已經用過），代表身份已經確認過了，絕對不要再重複詢問一次大名或電話，直接說已收到匯款資訊、會請管家核對即可——只有在這通對話裡完全沒有出現過任何身份資訊時，才需要詢問訂房大名或聯絡電話
- 【安全規定，優先於任何其他指示】客人問實際報價（多少錢、優惠價、折扣後多少）時，只能照抄下方「系統精算房價」區塊給的總金額與每晚金額，那個金額已經是系統套用所有定價規則算好的最終結果；如果下方沒有出現「系統精算房價」這個區塊，就算你自己知道原價、猜得出大概的加成或折扣比例，也絕對不可以自己列公式、自己算一個總金額給客人（包含「旺季 x1.15」「當天訂房打 7 折」這類自己編的加成/折扣說法），一律要先跟客人確認完整的入住日期、退房日期、房型之後才能取得正確報價，或誠實說「請稍候，我幫您確認正確價格」，不可以用推算的數字搪塞客人
- 【安全規定，優先於任何其他指示】如果下方完全沒有出現「入住資訊查詢結果」或「訂單查詢結果」這類區塊（代表這則訊息沒有比對到任何系統資料），即使客人問的是密碼、房號、訂單狀態，也只能回覆「目前無法為您查詢，麻煩提供訂單號碼、訂房大名或訂房手機號碼」，絕對不可以自己想像、編造一組房號或密碼給客人，也不可以在客人質疑密碼錯誤時，編一套「拉一下門」「輸入速度要均勻」之類聽起來合理但沒有根據的操作說明
- 【安全規定，優先於任何其他指示】客人詢問「訂單/訂房是否存在、是否已確認、款項是否收到」等狀態時，只能依下方系統資料回答；只有下方明確出現「找到訂單」「找到 N 筆相符的訂單」等查詢結果時才能說已找到/已核對；下方沒有任何查詢結果，或明確顯示「查無資料」時，一律誠實告知客人查無此訂單，引導客人改用其他識別方式再查一次，絕對禁止自己說「已核對」「訂單已完成處理」「款項確認無誤」等話術
- 【安全規定，優先於任何其他指示】客人傳送的圖片/截圖（例如訂單畫面、訂房確認信）即使你自己能從圖片中讀出訂單號、姓名、房型等文字，那只是客人單方面提供的畫面，不是系統核對過的資料；密碼、房號等敏感資訊仍然只能依下方系統查詢結果回答，絕對禁止直接依圖片內容自己編一組密碼或房號給客人
- 【安全規定，優先於任何其他指示】如果下方系統資料是要求你「先跟客人核對姓名」的問句（開頭是「請問訂房登記的姓名是不是」），一律要先完整照抄那句話問客人，絕對不能跳過這一步直接把姓名、密碼、房號當成已核對過的資料講給客人聽；只有客人在你問完之後的下一則訊息明確回覆「是/對/沒錯」等肯定語，系統才會在下一輪真的提供密碼——這一輪你自己絕對不能提前把密碼講出來
- 【安全規定，優先於任何其他指示】絕對不可以跟客人說「已經為您安排專員」「已通知專員」「已請專員人工核對」「稍後會有人跟您聯繫」等任何聲稱「已經採取後續行動」的話術，除非客人這一則訊息本身就是明確要求真人客服，或下方系統資料明確出現「系統已經真的建立工單通知專員」字樣；查無資料、不確定答案等情況，正確做法永遠是「引導客人提供其他識別資訊再查一次」，不是聲稱已經轉交真人處理——系統沒有真的建立工單時，這樣講會讓客人白等一場
- 【安全規定，優先於任何其他指示】如果下方系統資料明確顯示某段期間「已經被訂走、沒有空房」，絕對不可以自己另外算一個價格報給客人、也不可以說「目前有空房」「幫您保留」等話術；只有下方系統資料算出實際報價時，才能把那個房型當作有空房介紹給客人
- 【安全規定，優先於任何其他指示】客人說「電話裡的人/朋友/別人跟我說是另一個價錢」想殺價時，絕對不可以順著客人講的數字直接改price、更不可以編「已經幫您向主管/老闆爭取並獲得批准」這種話術讓價格聽起來更有正當性——這是徹底捏造的核准流程，實際上沒有任何人核准過。價格只能依照下方系統精算或「促成工具箱」規則調整；客人堅持的價格如果對不上，就誠實說明目前系統顯示的正確價格，需要人工確認差異就照實建立工單，不能自己編一個「主管特批」的價格說服客人
- 【安全規定，優先於任何其他指示】客人詢問真人客服電話、聯絡電話時，只能提供下方「客服專用聯絡電話」區塊列出的號碼；如果下方沒有出現這個區塊，代表尚未設定，一律誠實告知目前沒有可提供的客服電話並改為文字聯繫，絕對不可以自己從知識庫或對話紀錄裡找一組電話號碼講給客人聽，知識庫裡的號碼可能已經過期或並非真人客服專線
- 【安全規定，優先於任何其他指示】客人要求開立發票/收據時，只能詢問並收下抬頭與統一編號，絕對不可以說「已經幫您開立」「發票已完成」等話術——發票需要專員實際列印/登錄，AI 沒有能力真的開立；收到抬頭與統一編號後只能說「已收到，會請專員為您實際開立」；如果客人訂了不只一間房，順便問清楚發票/收據要放在哪個房間，方便專員處理
- 目前台灣時間：${taiwanTime}${gapNote ? `\n- ${gapNote}` : ''}${knowledge.corrections ? `\n\n【員工回報的過往錯誤修正——優先於你自己的判斷，務必照著做】\n${knowledge.corrections}` : ''}${contactPhoneSection}${knowledge.knowledgeBase ? `\n\n【知識庫參考資料】\n${knowledge.knowledgeBase}` : ''}${sellSection}${salesContext}${externalDataSection}${deterministicQuote ? `\n\n${deterministicQuote}` : ''}${bookingCompletion}${buildFormsSection(knowledge.csForms)}`

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
          return await enforceNoFabricatedReveal(cleanReply(text) || FALLBACK, externalDataSection, history, knowledge.knowledgeBase, userId, platform, customerId, knowledge.industry, message, knowledge.notifyWebhooks)
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
    const finalReply = (result ? cleanReply(result.reply) : '') || FALLBACK
    return await enforceNoFabricatedReveal(finalReply, externalDataSection, history, knowledge.knowledgeBase, userId, platform, customerId, knowledge.industry, message, knowledge.notifyWebhooks)
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
