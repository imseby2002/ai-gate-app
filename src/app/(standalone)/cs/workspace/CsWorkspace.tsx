'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  BarChart3, Upload, Headphones, Plus, Loader2, CheckCircle2, RefreshCw, Star,
  FileText, X, Sparkles, Wand2, Zap, TrendingUp, Check, AlertTriangle,
  ClipboardList, PieChart, Clock as ClockIcon, ThumbsUp, Lock,
  MessageSquare, BookOpen, Database, Calculator, FlaskConical, Ticket, Inbox,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HelpTip } from '@/components/cs/HelpTip'
import type { CsPlanFeatures } from '@/lib/cs/entitlements'

// ─── 與 marketing-auto 共用的小型型別／helper（原本定義在 marketing-auto/page.tsx，
// 這裡各自保留一份，比照 CS_PLATFORMS 與 CsChannels.tsx 既有的重複慣例） ──────────

interface UploadedFile {
  url: string
  name: string
  category: 'logo' | 'image' | 'document' | 'faq'
  mimeType: string
  sizeKb: number
  textContent?: string
}

interface Branch {
  id: string
  name: string
  address: string
  phone?: string
  lat?: number
  lng?: number
  notes?: string
}

interface Unit2Data {
  companyName?: string
  industry?: string
  employees?: string
  capital?: string
  founded?: string
  address?: string
  website?: string
  description?: string
  products?: string
  targetAudience?: string
  brandTone?: string
  competitiveAdvantage?: string
  branches?: Branch[]
  files?: UploadedFile[]
}

async function patchCampaign(id: string, body: Record<string, unknown>) {
  await fetch(`/api/marketing/campaign/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Unit 12: 客服系統 ────────────────────────────────────────────────────────

interface CsLogEntry {
  message: string
  reply: string
  intent: string
  risk: 'low' | 'medium' | 'high'
  provider: 'Gemini' | 'Claude'
  latencyMs: number
  ts: string
}

interface CsDialogueFile {
  url: string
  name: string
  sizeKb: number
  textContent: string
}

type BookingStep =
  | 'product'       // 行程/產品/房型 選擇
  | 'date_depart'   // 出發日期
  | 'date_checkin'  // 入住日期
  | 'date_checkout' // 退房日期
  | 'timeslot'      // 出發/入住 時段/班次
  | 'headcount'     // 人數（大人/小孩/嬰兒）
  | 'passenger_id'  // 乘客資料（姓名+生日+身分證，逐人，團保用）
  | 'booker_name'   // 訂房/訂位人姓名
  | 'quote'         // 報價（AI 自動套定價計算機計算並告知）
  | 'email'         // 電子郵件
  | 'plate'         // 車牌號碼
  | 'phone'         // 聯絡電話
  | 'special_req'   // 特殊需求

const BOOKING_STEPS: BookingStep[] = [
  'product', 'date_depart', 'date_checkin', 'date_checkout', 'timeslot',
  'headcount', 'passenger_id', 'booker_name', 'quote', 'email', 'plate', 'phone', 'special_req',
]

interface BookingFlowDef {
  id: string
  name: string
  triggerKeywords: string
  dataHint: string
  steps: BookingStep[]
  paymentInfo: string
  simpleMode?: boolean          // AI 只問方案/人數/報價，確認後彈出表單
  requirePassengerId?: boolean  // 表單要求身分證（幼兒永遠免填）
}

interface BookingParticipant {
  name: string
  birthday: string  // YYYY-MM-DD
  idNumber: string
}

interface BookingFormConfig {
  flowId: string
  packageName: string
  requirePassengerId: boolean
  headcount: number
}

function calcParticipantAge(birthday: string): number {
  if (!birthday) return -1
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function getAgeCategory(age: number): '幼兒' | '小孩' | '成人' {
  if (age <= 3) return '幼兒'
  if (age < 12) return '小孩'
  return '成人'
}

const DEFAULT_FLOWS: BookingFlowDef[] = [
  {
    id: 'tour',
    name: '行程預訂（賞鯨/出海）',
    triggerKeywords: '賞鯨,繞島,登島,出海,行程',
    dataHint: '賞鯨',
    steps: ['product', 'date_depart', 'timeslot', 'headcount'],
    paymentInfo: '',
    simpleMode: true,
    requirePassengerId: true,
  },
]

interface CsTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  platform: string
  from_name?: string
  intent?: string
  created_at: string
  updated_at: string
}

interface CsInboxMessage {
  id: string
  platform: string
  from_id: string
  from_name?: string
  message: string
  reply?: string
  intent?: string
  risk?: string
  latency_ms?: number
  created_at: string
}

interface NotifyWebhook {
  id: string
  type: 'line_messaging' | 'webhook' | 'telegram'
  label: string
  value: string   // LINE: Channel Access Token；Webhook: URL；Telegram: Bot Token
  target?: string // LINE: User ID 或 Group ID；Telegram: Chat ID
}

interface Unit12Data {
  systemPrompt?: string
  knowledgeBase?: string
  escalationThreshold?: 'medium' | 'high'
  replyLanguage?: string
  logs?: CsLogEntry[]
  dialogueFiles?: CsDialogueFile[]
  bookingFlowEnabled?: boolean
  paymentInfo?: string
  bookingFlows?: BookingFlowDef[]
  vipList?: string
  autoCloseMinutes?: number
  notifyWebhooks?: NotifyWebhook[]
  discountMaxPct?: number
  discountGifts?: string
}

const CS_PLATFORMS = [
  {
    id: 'line',
    name: 'LINE OA',
    color: '#00B900',
    envVars: ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET'],
    note: 'LINE Developers Console → Messaging API → 填入下方 Webhook URL',
    docUrl: 'https://developers.line.biz/en/docs/messaging-api/getting-started/',
    showWebhook: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    color: '#25D366',
    envVars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'],
    note: 'Meta Developer → WhatsApp → Configuration → 填入下方 Webhook URL',
    docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    showWebhook: true,
  },
  {
    id: 'whatsapp_personal',
    name: 'WhatsApp 個人版',
    color: '#128C7E',
    envVars: ['WHATSAPP_PERSONAL_BRIDGE_URL', 'WHATSAPP_PERSONAL_API_KEY'],
    note: '需自行架設 Baileys Bridge Server（Node.js），掃 QR 碼後即可接收個人帳號訊息',
    docUrl: 'https://github.com/WhiskeySockets/Baileys',
    showWebhook: false,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#2AABEE',
    envVars: ['TELEGRAM_BOT_TOKEN'],
    note: '向 @BotFather 建立 Bot，取得 Bot Token 填入。設定管理員 Chat ID 後，客戶訊息將同步轉發給管理員，管理員可直接在 Bot 對話中回覆客戶。',
    docUrl: 'https://core.telegram.org/bots/tutorial',
    showWebhook: false,
  },
  {
    id: 'zalo',
    name: 'Zalo OA',
    color: '#0068FF',
    envVars: ['ZALO_OA_ACCESS_TOKEN'],
    note: 'Zalo for Business → Official Account → Webhook → 填入下方 Webhook URL',
    docUrl: 'https://developers.zalo.me/docs/official-account',
    showWebhook: true,
  },
  {
    id: 'wechat',
    name: 'WeChat',
    color: '#07C160',
    envVars: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'],
    note: 'WeChat Official Account → 開發設定 → 伺服器配置 → 填入下方 Webhook URL',
    docUrl: 'https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html',
    showWebhook: true,
  },
]

type Cs12Tab = 'platforms' | 'ai-settings' | 'dialogue-files' | 'data-sources' | 'pricing' | 'test' | 'logs' | 'tickets' | 'inbox'

interface CsDataSource {
  id: string
  name: string
  enabled: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>
  type?: string
}

// ─── Industry Templates ───────────────────────────────────────────
interface IndustryTemplate {
  label: string
  emoji: string
  systemPrompt: string
  knowledgeBase: string
  bookingFlowEnabled: boolean
  bookingFlows: BookingFlowDef[]
  recommendedSheets: Array<{
    name: string
    description: string
    keyColumn: string
    returnColumnsExample: string
    triggerKeywords: string
    triggerMode: 'keyword' | 'numeric' | 'both'
  }>
  pricingButtons: Array<{ key: string; label: string }>
}

const CS_INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  homestay: {
    label: '民宿 / 旅遊',
    emoji: '🏡',
    systemPrompt: '你是【民宿名稱】的親切專業客服助理。請用溫暖友善的語氣回應客人問題，協助房型查詢、預訂流程、退訂政策說明與周邊行程安排建議。\n\n【核心任務】\n1. 房型查詢：介紹各房型特色、容納人數、價格（平假日）\n2. 訂房引導：依序收集入住/退房日期、人數、姓名、電話\n3. 退訂政策：入住 48 小時前可免費取消，逾時收一晚費用\n4. 行程推薦：根據客人需求推薦周邊景點與活動\n\n若客人詢問無法確定的問題，請主動說「我幫您轉接人工客服確認」。',
    knowledgeBase: '【房型資訊】\n- 海景雙人房：2人，平日 2,800，假日 3,500\n- 山景家庭房：4人，平日 4,200，假日 5,500，含早餐\n- 豪華套房：2人，平日 4,800，假日 6,000\n\n【入住須知】\nCheck-in：15:00 後　Check-out：11:00 前\n停車：免費，限一台\n寵物：不可攜帶\n\n【退訂政策】\n- 入住 48 小時前取消：全額退款\n- 48 小時內取消：收取一晚費用\n- 當日取消：不退款\n\n【周邊景點】\n車程 10 分鐘：老街、夜市\n車程 20 分鐘：國家公園、瀑布步道',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'room', name: '訂房', triggerKeywords: '預訂,訂房,入住,房型,空房,有沒有房', dataHint: '房型定價', steps: ['product', 'date_checkin', 'date_checkout', 'headcount', 'booker_name', 'phone', 'special_req'], paymentInfo: '' },
      { id: 'tour', name: '行程諮詢', triggerKeywords: '行程,景點,推薦,附近,玩什麼', dataHint: '行程', steps: ['date_checkin', 'headcount', 'phone'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '訂單密碼表', description: '客人輸入訂單號自動回覆房號、密碼（不含定價）', keyColumn: '訂單編號', returnColumnsExample: '房號,大門密碼,房間密碼,入住日,退房日', triggerKeywords: '訂單,密碼,房號', triggerMode: 'numeric' },
    ],
    pricingButtons: [{ key: 'accommodation', label: '+ 訂房定價' }, { key: 'tour', label: '+ 行程定價' }, { key: 'custom', label: '+ 自訂' }],
  },
  ecommerce: {
    label: '電商 / 零售',
    emoji: '🛍️',
    systemPrompt: '你是【品牌名稱】的專業電商客服助理。請協助客人查詢訂單狀態、處理退換貨申請、追蹤物流進度，以及解答商品問題與促銷資訊。\n\n【核心任務】\n1. 訂單查詢：請客人提供訂單號，自動查詢狀態\n2. 退換貨：說明退換貨流程（7天鑑賞期），收集客人資料\n3. 商品問題：說明商品規格、材質、尺寸\n4. 物流追蹤：提供預計到貨時間與物流單號\n\n若客人情緒激動，請先表達理解與歉意，再轉接人工處理。',
    knowledgeBase: '【退換貨政策】\n收到商品 7 天內可申請退換貨（商品須未使用、含原包裝）\n退款時間：審核通過後 5-7 個工作天\n\n【物流說明】\n台灣本島：下單後 1-3 個工作天出貨\n離島地區：額外 1-2 個工作天\n\n【促銷活動】\n滿 $1,000 免運費\n首購優惠碼：WELCOME88（折扣 88 元）\n\n【商品保固】\n電子商品：1年保固\n服飾：無品質瑕疵不退（非人為損壞）',
    bookingFlowEnabled: false,
    bookingFlows: [
      { id: 'return', name: '退換貨申請', triggerKeywords: '退貨,換貨,退款,瑕疵,壞掉,不喜歡', dataHint: '退換貨', steps: ['product', 'booker_name', 'phone', 'email', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '訂單查詢表', description: '客人輸入訂單號自動回覆物流狀態（不含定價）', keyColumn: '訂單編號', returnColumnsExample: '訂單編號,商品名稱,數量,物流單號,配送狀態,預計到貨日', triggerKeywords: '訂單,查詢,到貨,物流,進度', triggerMode: 'numeric' },
      { name: '商品規格目錄', description: '客人詢問商品材質/尺寸/規格，不含價格（價格用定價計算機）', keyColumn: '商品名稱', returnColumnsExample: '商品名稱,規格,材質說明,尺寸對照,庫存狀態,注意事項', triggerKeywords: '規格,尺寸,材質,怎麼選', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 商品定價' }, { key: 'custom', label: '+ 運費方案' }],
  },
  restaurant: {
    label: '餐廳 / 餐飲',
    emoji: '🍽️',
    systemPrompt: '你是【餐廳名稱】的熱情客服助理。請協助客人線上訂位、查詢菜單與價格、了解外送時間與範圍，以及安排包廂服務。\n\n【核心任務】\n1. 訂位：確認日期、時段、人數，收集姓名電話\n2. 菜單查詢：介紹招牌菜、套餐內容與價格\n3. 外送服務：說明外送範圍、最低消費、預計時間\n4. 包廂預訂：說明包廂規格、最低消費、預約流程\n\n請用熱情親切的語氣，讓每位客人感受到賓至如歸。',
    knowledgeBase: '【訂位說明】\n用餐時段：11:30-14:00（午餐）、17:30-21:00（晚餐）\n包廂：可容納 8-20 人，需預訂，最低消費 $3,000\n訂位需提前 1 天，當日訂位請來電確認\n\n【套餐資訊】\n商業午餐套餐（平日限定）：$350/人，含主菜+湯+飲料\n家庭套餐：$1,200/4人，含 6 道菜\n\n【外送說明】\n外送範圍：3 公里內\n最低消費：$500\n外送費：$60（滿 $800 免外送費）\n預計時間：30-45 分鐘\n\n【過敏原說明】\n含麩質、蛋、奶製品，請有過敏需求提前告知',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'reservation', name: '訂位', triggerKeywords: '訂位,用餐,訂桌,包廂,座位,預約', dataHint: '訂位', steps: ['date_depart', 'timeslot', 'headcount', 'booker_name', 'phone', 'special_req'], paymentInfo: '' },
      { id: 'delivery', name: '外送點餐', triggerKeywords: '外送,外帶,訂餐,送餐,點餐', dataHint: '外送', steps: ['booker_name', 'phone', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '訂位可用時段', description: '客人詢問今日/特定日期是否有位可訂', keyColumn: '日期', returnColumnsExample: '日期,午餐可訂時段,晚餐可訂時段,包廂是否可用,備註', triggerKeywords: '訂位,有沒有位,時段,包廂,今天', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 套餐定價' }, { key: 'custom', label: '+ 包廂費用' }, { key: 'custom', label: '+ 自訂' }],
  },
  clinic: {
    label: '診所 / 醫美',
    emoji: '🏥',
    systemPrompt: '你是【診所名稱】的專業客服助理。請協助患者預約掛號、了解療程項目與費用、查詢術後照護，以及回答診所相關問題。\n\n【核心任務】\n1. 療程查詢：介紹各療程項目、效果說明、適合對象\n2. 費用查詢：說明自費項目費用（健保項目請現場確認）\n3. 預約引導：收集療程、醫師偏好、日期時段、姓名電話\n4. 術後照護：說明術後注意事項與回診時間\n\n⚠️ 涉及具體醫療診斷或治療建議，請務必引導「建議到診所與醫師當面諮詢」。',
    knowledgeBase: '【主要療程】\n- 玻尿酸注射：$6,000 起/次，效果 6-12 個月\n- 肉毒桿菌：$3,000 起（依部位），效果 4-6 個月\n- 淨膚雷射：$2,500/次，建議每月 1 次\n- 醫美諮詢：免費，需事先預約\n\n【掛號須知】\n看診時段：週一~週五 10:00-19:00，週六 10:00-17:00\n初診請提前 15 分鐘到院填寫資料\n\n【術後照護】\n注射後 24 小時勿揉壓部位\n注射後 1 週回診確認效果\n有任何不適請立即聯繫診所\n\n【費用說明】\n醫美療程為自費項目，無法使用健保',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'appointment', name: '預約掛號', triggerKeywords: '預約,掛號,看診,療程,諮詢,想做', dataHint: '療程', steps: ['product', 'date_depart', 'timeslot', 'booker_name', 'phone', 'email', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '醫師/諮詢師排班', description: '客人詢問特定醫師何時有空可預約（不含費用）', keyColumn: '醫師姓名', returnColumnsExample: '醫師姓名,專長,週一,週二,週三,週四,週五,週六', triggerKeywords: '醫師,排班,什麼時候有,誰', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 療程費用' }, { key: 'custom', label: '+ 套療方案' }],
  },
  beauty: {
    label: '美容 / 美髮 / SPA',
    emoji: '💆',
    systemPrompt: '你是【店家名稱】的貼心客服助理。請協助客人預約服務、查詢價目表、了解設計師專長，以及提供護理保養建議。\n\n【核心任務】\n1. 服務查詢：介紹各項服務項目與價格（依髮長計費）\n2. 設計師推薦：根據客人需求推薦合適設計師\n3. 預約引導：收集服務項目、設計師、日期時段、姓名電話\n4. 護理建議：提供燙染後護理、日常保養建議\n\n請用溫柔親切的語氣，讓每位客人都感到被重視。',
    knowledgeBase: '【服務價目】\n剪髮：短髮 $300，中長髮 $350，長髮 $400\n染髮：短髮 $1,800 起，長髮 $2,500 起（依色系調整）\n燙髮：短髮 $2,000 起，長髮 $3,000 起\n護髮：$800-1,500（依長度）\n\n【設計師介紹】\n小美設計師：擅長自然染、修護燙，客人評價★★★★★\n阿傑設計師：擅長造型剪、韓系風格，客人評價★★★★\n\n【預約說明】\n建議提前 3 天預約\n如需更改請提前 1 天告知\n\n【注意事項】\n燙染後 3 天勿洗頭\n懷孕或過敏體質請事先告知設計師',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'booking', name: '服務預約', triggerKeywords: '預約,剪髮,染髮,護髮,燙髮,美甲,SPA,按摩', dataHint: '服務', steps: ['product', 'date_depart', 'timeslot', 'booker_name', 'phone', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '設計師排班表', description: '客人指定設計師時查詢可預約時段（不含服務定價）', keyColumn: '設計師姓名', returnColumnsExample: '設計師,專長,週一,週二,週三,週四,週五,週六,週日', triggerKeywords: '設計師,排班,什麼時候有,誰', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 服務定價' }, { key: 'custom', label: '+ 組合優惠' }],
  },
  education: {
    label: '教育 / 補習班',
    emoji: '📚',
    systemPrompt: '你是【機構名稱】的專業客服助理。請協助家長與學生了解課程內容、預約試聽、查詢學費方案，以及介紹師資陣容。\n\n【核心任務】\n1. 課程查詢：介紹各年級/程度課程內容與特色\n2. 學費說明：提供月繳/季繳/年繳方案，計算優惠\n3. 試聽預約：收集課程、學生年級、日期時段、家長聯絡資料\n4. 師資介紹：根據學生需求推薦合適老師\n\n請用正向積極的語氣，讓家長與學生對學習充滿信心。',
    knowledgeBase: '【課程項目】\n數學班：國小/國中/高中，各年級分班教學\n英文班：基礎/進階/會話/作文，週 2 堂\n理化班：國中/高中，小班制 8 人\n\n【學費方案】\n月繳：$3,600/月（週 2 堂）\n季繳：$10,000/季（省 $800）\n年繳：$36,000/年（省 $7,200，最優惠）\n\n【試聽說明】\n免費試聽 1 堂，需事先預約\n試聽後 3 天內報名享 9 折優惠\n\n【師資特色】\n師大/師院畢業，平均教學年資 5 年以上\n小班制（最多 10 人），確保學習品質',
    bookingFlowEnabled: true,
    bookingFlows: [
      { id: 'trial', name: '免費試聽預約', triggerKeywords: '試聽,體驗課,報名,想學,課程,補習', dataHint: '課程', steps: ['product', 'date_depart', 'timeslot', 'booker_name', 'phone', 'email', 'special_req'], paymentInfo: '' },
    ],
    recommendedSheets: [
      { name: '試聽可用時段', description: '客人詢問試聽時段時查詢剩餘名額（不含學費）', keyColumn: '課程', returnColumnsExample: '課程,日期,時段,老師,剩餘名額', triggerKeywords: '試聽,什麼時候,有沒有,名額', triggerMode: 'keyword' },
    ],
    pricingButtons: [{ key: 'custom', label: '+ 學費方案' }, { key: 'custom', label: '+ 課程定價' }],
  },
}

function Unit12CustomerService({
  campaignId,
  savedData,
  unit2Data,
  industry,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit12Data
  unit2Data?: Unit2Data
  industry?: string
  onDone: (data: Unit12Data) => void
}) {
  const t = useTranslations('MA')
  const locale = useLocale()
  const stepLabel = (s: BookingStep) => t(`u12.step.${s}`)
  const industryLabel = (id: string) => t.has(`u12.industry.${id}`) ? t(`u12.industry.${id}`) : (CS_INDUSTRY_TEMPLATES[id]?.label ?? id)
  const [tab, setTab] = useState<Cs12Tab>('platforms')

  // CS 方案權限（決定哪些分頁要鎖定顯示升級提示）
  const [csFeatures, setCsFeatures] = useState<CsPlanFeatures | null>(null)
  useEffect(() => {
    fetch('/api/marketing/cs-plan')
      .then(r => r.json())
      .then(d => setCsFeatures(d.features ?? null))
      .catch(() => {})
  }, [])

  const renderLockedUpgrade = (featureName: string) => (
    <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3 bg-gray-50">
      <Lock className="h-6 w-6 text-gray-400 mx-auto" />
      <p className="text-sm font-medium text-gray-700">「{featureName}」為付費方案功能</p>
      <p className="text-xs text-gray-400">升級方案即可解鎖使用。</p>
      <a href="/cs/plan" className="inline-block text-xs text-primary font-medium hover:underline">升級方案 →</a>
    </div>
  )

  // AI settings
  const [systemPrompt, setSystemPrompt] = useState(savedData?.systemPrompt ?? '')
  const [knowledgeBase, setKnowledgeBase] = useState(savedData?.knowledgeBase ?? '')
  const [escalationThreshold, setEscalationThreshold] = useState<'medium' | 'high'>(savedData?.escalationThreshold ?? 'high')
  const [replyLanguage, setReplyLanguage] = useState(savedData?.replyLanguage ?? 'auto')
  const [bookingFlowEnabled, setBookingFlowEnabled] = useState(savedData?.bookingFlowEnabled ?? false)
  const [paymentInfo, setPaymentInfo] = useState(savedData?.paymentInfo ?? '')
  const [bookingFlows, setBookingFlows] = useState<BookingFlowDef[]>(savedData?.bookingFlows ?? DEFAULT_FLOWS)
  const [editingFlow, setEditingFlow] = useState<BookingFlowDef | null>(null)
  // 報名表單 Modal
  const [bookingFormOpen, setBookingFormOpen] = useState(false)
  const [bookingFormConfig, setBookingFormConfig] = useState<BookingFormConfig | null>(null)
  const [bookingParticipants, setBookingParticipants] = useState<BookingParticipant[]>([])
  const [bookingContactPhone, setBookingContactPhone] = useState('')
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  // VIP 識別 + 自動結案
  const [vipList, setVipList] = useState(savedData?.vipList ?? '')
  const [autoCloseMinutes, setAutoCloseMinutes] = useState(savedData?.autoCloseMinutes ?? 0)
  const [notifyWebhooks, setNotifyWebhooks] = useState<NotifyWebhook[]>(savedData?.notifyWebhooks ?? [])
  const [discountMaxPct, setDiscountMaxPct] = useState(savedData?.discountMaxPct ?? 0)
  const [discountGifts, setDiscountGifts] = useState(savedData?.discountGifts ?? '')

  // Dialogue files
  const [dialogueFiles, setDialogueFiles] = useState<CsDialogueFile[]>(savedData?.dialogueFiles ?? [])

  // Sync when savedData loads asynchronously from Supabase
  // Track last savedData ref to avoid overwriting local uploads with stale DB data
  const lastSavedDataRef = useRef<Unit12Data | undefined>(undefined)
  useEffect(() => {
    if (!savedData || savedData === lastSavedDataRef.current) return
    lastSavedDataRef.current = savedData
    if (savedData.systemPrompt !== undefined) setSystemPrompt(savedData.systemPrompt)
    if (savedData.knowledgeBase !== undefined) setKnowledgeBase(savedData.knowledgeBase)
    if (savedData.escalationThreshold) setEscalationThreshold(savedData.escalationThreshold)
    if (savedData.replyLanguage) setReplyLanguage(savedData.replyLanguage)
    if (savedData.bookingFlowEnabled !== undefined) setBookingFlowEnabled(savedData.bookingFlowEnabled)
    if (savedData.paymentInfo !== undefined) setPaymentInfo(savedData.paymentInfo)
    if (savedData.bookingFlows?.length) setBookingFlows(savedData.bookingFlows)
    if (savedData.vipList !== undefined) setVipList(savedData.vipList)
    if (savedData.autoCloseMinutes !== undefined) setAutoCloseMinutes(savedData.autoCloseMinutes)
    if (savedData.notifyWebhooks !== undefined) setNotifyWebhooks(savedData.notifyWebhooks)
    if (savedData.discountMaxPct !== undefined) setDiscountMaxPct(savedData.discountMaxPct)
    if (savedData.discountGifts !== undefined) setDiscountGifts(savedData.discountGifts)
    // Only restore files from DB if local state is empty (don't overwrite user's current session files)
    if (savedData.dialogueFiles?.length) setDialogueFiles(savedData.dialogueFiles)
  }, [savedData])

  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingDialogue, setUploadingDialogue] = useState(false)
  const dialogueInputRef = useRef<HTMLInputElement>(null)

  const handleDialogueUpload = async (file: File) => {
    setUploadingDialogue(true)
    const form = new FormData()
    form.append('file', file)
    form.append('category', 'faq')
    try {
      const res = await fetch('/api/marketing/upload-file', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.url) {
        const newFiles = [...dialogueFiles, {
          url: data.url,
          name: file.name,
          sizeKb: data.sizeKb ?? Math.round(file.size / 1024),
          textContent: data.textContent ?? '',
        }]
        setDialogueFiles(newFiles)
        onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: newFiles, bookingFlowEnabled, paymentInfo, bookingFlows, discountMaxPct, discountGifts })
      }
    } finally {
      setUploadingDialogue(false)
    }
  }

  const removeDialogueFile = (url: string) => {
    const newFiles = dialogueFiles.filter(f => f.url !== url)
    setDialogueFiles(newFiles)
    onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: newFiles, bookingFlowEnabled, paymentInfo, discountMaxPct, discountGifts })
  }

  // Test chat
  const [testInput, setTestInput] = useState('')
  const [testHistory, setTestHistory] = useState<{ role: 'user' | 'assistant'; content: string; images?: string[]; meta?: { intent?: string; risk?: string; provider?: string } }[]>([])
  const [testLoading, setTestLoading] = useState(false)
  const [testImage, setTestImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)

  // 對話摘要
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState('')

  // 智慧草稿
  const [draftMode, setDraftMode] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [draftMeta, setDraftMeta] = useState<{ intent?: string; risk?: string; provider?: string } | null>(null)
  const [draftUserMsg, setDraftUserMsg] = useState('')

  // 自動滿意度問卷 / 結案
  const [caseClosed, setCaseClosed] = useState(false)
  const [autoCloseSecondsLeft, setAutoCloseSecondsLeft] = useState<number | null>(null)
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 工單系統
  const [tickets, setTickets] = useState<CsTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [ticketFilter, setTicketFilter] = useState<string>('all')

  // 統一收件匣
  const [inboxMessages, setInboxMessages] = useState<CsInboxMessage[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [inboxPlatformFilter, setInboxPlatformFilter] = useState<string>('all')

  // Logs
  const [logs, setLogs] = useState<CsLogEntry[]>(savedData?.logs ?? [])

  // Data sources
  const [dataSources, setDataSources] = useState<CsDataSource[]>([])
  const [dsLoading, setDsLoading] = useState(false)
  const [editingDs, setEditingDs] = useState<CsDataSource | null>(null)
  const [editingDsForm, setEditingDsForm] = useState<CsDataSource['config'] & { name: string }>({
    name: '', apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [], triggerMode: 'keyword',
  })
  const [savingDs, setSavingDs] = useState(false)

  // Pricing configs
  const [pricingConfigs, setPricingConfigs] = useState<Array<{ id: string; name: string; enabled: boolean; config: Record<string, unknown> }>>([])
  const [editingPc, setEditingPc] = useState<{ id: string; name: string; jsonText: string } | null>(null)
  const [savingPc, setSavingPc] = useState(false)
  const [pcJsonError, setPcJsonError] = useState('')

  // FAQ 知識庫
  interface FaqItem { id: string; q: string; a: string; keywords: string[]; created_at: string }
  const [faqItems, setFaqItems] = useState<FaqItem[]>([])
  const [faqDialog, setFaqDialog] = useState<{ open: boolean; q: string; a: string; keywords: string; saving: boolean }>({
    open: false, q: '', a: '', keywords: '', saving: false,
  })
  const loadFaq = (ind: string) => {
    fetch(`/api/marketing/cs-faq?industry=${ind}`).then(r => r.json()).then(d => {
      if (d.items) setFaqItems(d.items)
    }).catch(() => {})
  }

  // Breakfast webhook configs (多筆)
  const [breakfastSources, setBreakfastSources] = useState<CsDataSource[]>([])
  const [sourcePrefs, setSourcePrefs] = useState<{ priceSource: string; passwordSource: string; checkinTime: string }>({ priceSource: 'booking_system', passwordSource: 'booking_system', checkinTime: '' })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [editingBreakfast, setEditingBreakfast] = useState<CsDataSource | null | { id: '' }>(null)
  const [editingBreakfastForm, setEditingBreakfastForm] = useState({
    name: '', webhookUrl: '', cutoffTime: '22:00', deliveryTime: '07:50', rooms: '', menu: '',
  })
  const [savingBreakfast, setSavingBreakfast] = useState(false)

  const PRICING_TEMPLATES: Record<string, object> = {
    tour: {
      productType: 'tour',
      triggerKeywords: ['賞鯨', '行程', '出海'],
      currency: 'TWD',
      schedules: [
        { id: 'A', name: 'A班 08:00' },
        { id: 'B', name: 'B班 10:30' },
        { id: 'C', name: 'C班 13:00' },
        { id: 'D', name: 'D班 15:30' },
      ],
      segments: [
        { label: '成人（12歲以上）', key: 'adult', weekdayPrice: 800, weekendPrice: 1000 },
        { label: '兒童（3-11歲）', key: 'child', weekdayPrice: 500, weekendPrice: 600 },
        { label: '嬰兒（0-2歲）', key: 'infant', weekdayPrice: 0, weekendPrice: 0 },
      ],
      packages: [
        { name: '四人家庭套餐', price: 2600, description: '2大2小' },
      ],
      groupDiscounts: [
        { minPeople: 10, discountPercent: 10, note: '10人以上團體' },
      ],
      cancellationPolicy: '出發前 24 小時取消，否則收取全額費用',
      notes: ['颱風警報取消全額退款', '集合地點請洽客服確認'],
    },
    accommodation: {
      productType: 'accommodation',
      triggerKeywords: ['訂房', '住宿', '房間', '入住', '一晚'],
      currency: 'TWD',
      rooms: [
        {
          name: '401高地景觀房',
          capacity: 4,
          weekdayPrice: 2800,
          weekendPrice: 3500,
          holidayPrice: 4200,
          extraPersonFee: 500,
        },
      ],
      cancellationPolicy: '入住前 48 小時取消，否則收取一晚費用',
      notes: ['含早餐', '最晚入住時間 22:00', 'Check-out 11:00'],
    },
    custom: {
      productType: 'custom',
      triggerKeywords: ['產品名稱', '關鍵字'],
      currency: 'TWD',
      customContent: '請在此填入自訂定價說明\n例：單次體驗 $500，月票 $1,500',
      cancellationPolicy: '',
      notes: [],
    },
  }

  const ind = industry ?? 'homestay'

  useEffect(() => {
    fetch(`/api/marketing/cs-datasource?industry=${ind}`).then(r => r.json()).then(d => {
      if (d.sources) {
        setDataSources(d.sources.filter((s: { type: string }) => s.type !== 'json_pricing' && s.type !== 'breakfast_webhook' && s.type !== 'source_prefs'))
        setPricingConfigs(d.sources.filter((s: { type: string }) => s.type === 'json_pricing'))
        setBreakfastSources(d.sources.filter((s: { type: string }) => s.type === 'breakfast_webhook'))
      }
    }).catch(() => {})
  }, [ind])

  useEffect(() => {
    fetch('/api/marketing/cs-source-prefs').then(r => r.json()).then(d => {
      if (d.prefs) setSourcePrefs(d.prefs)
    }).catch(() => {})
  }, [])

  async function saveSourcePrefs(next: { priceSource: string; passwordSource: string; checkinTime: string }) {
    setSourcePrefs(next)
    setSavingPrefs(true)
    try {
      await fetch('/api/marketing/cs-source-prefs', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } finally { setSavingPrefs(false) }
  }

  function openAddPc(templateKey?: string) {
    const template = templateKey ? PRICING_TEMPLATES[templateKey] : PRICING_TEMPLATES.tour
    setEditingPc({ id: '', name: '', jsonText: JSON.stringify(template, null, 2) })
    setPcJsonError('')
  }

  function openEditPc(pc: { id: string; name: string; config: Record<string, unknown> }) {
    setEditingPc({ id: pc.id, name: pc.name, jsonText: JSON.stringify(pc.config, null, 2) })
    setPcJsonError('')
  }

  async function savePc() {
    if (!editingPc) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(editingPc.jsonText)
      setPcJsonError('')
    } catch (e) {
      setPcJsonError(t('u12.jsonError', { error: String(e) }))
      return
    }
    setSavingPc(true)
    try {
      if (editingPc.id) {
        const r = await fetch(`/api/marketing/cs-datasource/${editingPc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingPc.name, config: parsed, enabled: true }),
        })
        const d = await r.json()
        if (d.source) setPricingConfigs(prev => prev.map(p => p.id === editingPc.id ? d.source : p))
      } else {
        const r = await fetch('/api/marketing/cs-datasource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingPc.name, config: parsed, type: 'json_pricing', industry: ind }),
        })
        const d = await r.json()
        if (d.source) setPricingConfigs(prev => [...prev, d.source])
      }
      setEditingPc(null)
    } catch {}
    setSavingPc(false)
  }

  async function deletePc(id: string) {
    await fetch(`/api/marketing/cs-datasource/${id}`, { method: 'DELETE' })
    setPricingConfigs(prev => prev.filter(p => p.id !== id))
  }

  async function togglePc(pc: { id: string; name: string; enabled: boolean; config: Record<string, unknown> }) {
    const r = await fetch(`/api/marketing/cs-datasource/${pc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pc.name, config: pc.config, enabled: !pc.enabled }),
    })
    const d = await r.json()
    if (d.source) setPricingConfigs(prev => prev.map(p => p.id === pc.id ? d.source : p))
  }

  function openAddDs() {
    setEditingDs({ id: '', name: '', enabled: true, config: { apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [], triggerMode: 'keyword' } })
    setEditingDsForm({ name: '', apiKey: '', spreadsheetId: '', sheetName: '', keyColumn: '', returnColumns: [], triggerKeywords: [], triggerMode: 'keyword' })
  }

  function openEditDs(src: CsDataSource) {
    setEditingDs(src)
    setEditingDsForm({
      name: src.name,
      apiKey: src.config.apiKey,
      spreadsheetId: src.config.spreadsheetId,
      sheetName: src.config.sheetName,
      keyColumn: src.config.keyColumn,
      returnColumns: src.config.returnColumns ?? [],
      triggerKeywords: src.config.triggerKeywords ?? [],
      triggerMode: src.config.triggerMode ?? 'keyword',
    })
  }

  async function saveDs() {
    setSavingDs(true)
    try {
      const config = {
        apiKey: editingDsForm.apiKey,
        spreadsheetId: editingDsForm.spreadsheetId,
        sheetName: editingDsForm.sheetName,
        keyColumn: editingDsForm.keyColumn,
        returnColumns: editingDsForm.returnColumns,
        triggerKeywords: editingDsForm.triggerKeywords,
        triggerMode: editingDsForm.triggerMode ?? 'keyword',
      }
      if (editingDs?.id) {
        const r = await fetch(`/api/marketing/cs-datasource/${editingDs.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingDsForm.name, config, enabled: editingDs.enabled }),
        })
        const d = await r.json()
        if (d.source) setDataSources(prev => prev.map(s => s.id === editingDs.id ? d.source : s))
      } else {
        const r = await fetch('/api/marketing/cs-datasource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingDsForm.name, config, industry: ind }),
        })
        const d = await r.json()
        if (d.source) setDataSources(prev => [...prev, d.source])
      }
      setEditingDs(null)
    } catch {}
    setSavingDs(false)
  }

  async function deleteDs(id: string) {
    setDsLoading(true)
    try {
      await fetch(`/api/marketing/cs-datasource/${id}`, { method: 'DELETE' })
      setDataSources(prev => prev.filter(s => s.id !== id))
    } catch {}
    setDsLoading(false)
  }

  function openAddBreakfast() {
    setEditingBreakfast({ id: '' })
    setEditingBreakfastForm({ name: '', webhookUrl: '', cutoffTime: '22:00', deliveryTime: '07:50', rooms: '', menu: '' })
  }

  function openEditBreakfast(src: CsDataSource) {
    setEditingBreakfast(src)
    setEditingBreakfastForm({
      name:         src.name,
      webhookUrl:   src.config.webhookUrl   ?? '',
      cutoffTime:   src.config.cutoffTime   ?? '22:00',
      deliveryTime: src.config.deliveryTime ?? '07:50',
      rooms: (src.config.rooms ?? []).join('\n'),
      menu:  (src.config.menu  ?? []).join('\n'),
    })
  }

  async function saveBreakfast() {
    setSavingBreakfast(true)
    try {
      const config = {
        webhookUrl:   editingBreakfastForm.webhookUrl.trim(),
        cutoffTime:   editingBreakfastForm.cutoffTime.trim(),
        deliveryTime: editingBreakfastForm.deliveryTime.trim(),
        rooms: editingBreakfastForm.rooms.split('\n').map(s => s.trim()).filter(Boolean),
        menu:  editingBreakfastForm.menu.split('\n').map(s => s.trim()).filter(Boolean),
      }
      const bkId = (editingBreakfast as CsDataSource)?.id
      if (bkId) {
        const r = await fetch(`/api/marketing/cs-datasource/${bkId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingBreakfastForm.name || t('u12.shoppingConfig'), config, enabled: true }),
        })
        const d = await r.json()
        if (d.source) setBreakfastSources(prev => prev.map(s => s.id === bkId ? d.source : s))
      } else {
        const r = await fetch('/api/marketing/cs-datasource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingBreakfastForm.name || t('u12.shoppingConfig'), type: 'breakfast_webhook', config, industry: ind }),
        })
        const d = await r.json()
        if (d.source) setBreakfastSources(prev => [...prev, d.source])
      }
      setEditingBreakfast(null)
    } catch {}
    setSavingBreakfast(false)
  }

  async function deleteBreakfast(id: string) {
    await fetch(`/api/marketing/cs-datasource/${id}`, { method: 'DELETE' })
    setBreakfastSources(prev => prev.filter(s => s.id !== id))
  }

  async function toggleBreakfast(src: CsDataSource) {
    const r = await fetch(`/api/marketing/cs-datasource/${src.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: src.name, config: src.config, enabled: !src.enabled }),
    })
    const d = await r.json()
    if (d.source) setBreakfastSources(prev => prev.map(s => s.id === src.id ? d.source : s))
  }

  async function toggleDs(src: CsDataSource) {
    try {
      const r = await fetch(`/api/marketing/cs-datasource/${src.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: src.name, config: src.config, enabled: !src.enabled }),
      })
      const d = await r.json()
      if (d.source) setDataSources(prev => prev.map(s => s.id === src.id ? d.source : s))
    } catch {}
  }

  // Per-user credentials
  const [userId, setUserId] = useState<string | null>(null)
  const [platformCreds, setPlatformCreds] = useState<Record<string, Record<string, string>>>({})
  const [platformPreview, setPlatformPreview] = useState<Record<string, Record<string, string>>>({})
  const [platformConnected, setPlatformConnected] = useState<Record<string, boolean>>({})
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null)
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null)
  const [telegramSetupLoading, setTelegramSetupLoading] = useState(false)
  const [telegramSetupResult, setTelegramSetupResult] = useState<{ ok: boolean; msg: string; webhookUrl?: string } | null>(null)
  const [telegramDiag, setTelegramDiag] = useState<{ info?: Record<string, unknown>; me?: Record<string, unknown>; recentChats?: Array<{ chatId: number; name: string; username?: string }>; endpointStatus?: number; error?: string } | null>(null)
  const [telegramDiagLoading, setTelegramDiagLoading] = useState(false)
  const [telegramTestChatId, setTelegramTestChatId] = useState('')
  const [telegramTestLoading, setTelegramTestLoading] = useState(false)
  const [telegramTestResult, setTelegramTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // WhatsApp Personal (Baileys Bridge) states
  const [waQrData, setWaQrData] = useState<string | null>(null)  // base64 QR image
  const [waStatus, setWaStatus] = useState<string>('not_started') // 'not_started'|'connecting'|'qr'|'connected'|'disconnected'
  const [waPhone, setWaPhone] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState<string | null>(null)
  const waPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.id) setUserId(d.id) }).catch(() => {})
    fetch('/api/social/credentials').then(r => r.json()).then(d => {
      if (d.platforms) {
        const connected: Record<string, boolean> = {}
        const previewData: Record<string, Record<string, string>> = {}
        const valuesData: Record<string, Record<string, string>> = {}
        Object.entries(d.platforms).forEach(([k, v]) => {
          connected[k] = (v as any).is_connected
          previewData[k] = (v as any).preview ?? {}
          valuesData[k] = (v as any).values ?? {}
        })
        setPlatformConnected(connected)
        // Pre-populate form with actual values for non-secret fields
        setPlatformCreds(prev => {
          const next = { ...prev }
          Object.entries(valuesData).forEach(([platform, vals]) => {
            next[platform] = { ...(next[platform] ?? {}), ...vals }
          })
          return next
        })
        // Store preview for secret field indicators
        setPlatformPreview(previewData)
      }
    }).catch(() => {})
  }, [])

  async function savePlatformCreds(platformId: string) {
    const creds = platformCreds[platformId]
    if (!creds) return
    setSavingPlatform(platformId)
    try {
      await fetch('/api/social/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformId, credentials: creds }),
      })
      setPlatformConnected(prev => ({ ...prev, [platformId]: Object.values(creds).some(v => v.trim()) }))
      setEditingPlatform(null)
    } catch {}
    setSavingPlatform(null)
  }

  async function registerTelegramWebhook() {
    setTelegramSetupLoading(true)
    setTelegramSetupResult(null)
    try {
      const res = await fetch('/api/marketing/telegram-setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setTelegramSetupResult({ ok: false, msg: data.error ?? t('u12.tgRegFailed') })
      } else {
        const tgOk = data.setResult?.ok === true
        const webhookSet = data.infoResult?.result?.url ?? ''
        setTelegramSetupResult({
          ok: tgOk,
          msg: tgOk ? t('u12.tgRegOk') : t('u12.tgReturned', { data: JSON.stringify(data.setResult) }),
          webhookUrl: webhookSet,
        })
      }
    } catch (e) {
      setTelegramSetupResult({ ok: false, msg: String(e) })
    }
    setTelegramSetupLoading(false)
  }

  async function checkTelegramDiag() {
    setTelegramDiagLoading(true)
    setTelegramDiag(null)
    try {
      const res = await fetch('/api/marketing/telegram-test')
      const data = await res.json()
      setTelegramDiag(data)
    } catch (e) {
      setTelegramDiag({ error: String(e) })
    }
    setTelegramDiagLoading(false)
  }

  async function sendTelegramTestMsg() {
    if (!telegramTestChatId.trim()) return
    setTelegramTestLoading(true)
    setTelegramTestResult(null)
    try {
      const res = await fetch('/api/marketing/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: telegramTestChatId.trim() }),
      })
      const data = await res.json()
      const ok = data.result?.ok === true
      setTelegramTestResult({ ok, msg: ok ? t('u12.tgTestSent') : `❌ ${JSON.stringify(data.result?.description ?? data)}` })
    } catch (e) {
      setTelegramTestResult({ ok: false, msg: String(e) })
    }
    setTelegramTestLoading(false)
  }

  // ── WhatsApp Personal (Baileys) ────────────────────────────────────────────
  async function startWaSession() {
    setWaLoading(true)
    setWaError(null)
    setWaQrData(null)
    try {
      const r = await fetch('/api/marketing/wa-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setWaStatus(d.status ?? 'connecting')
      // Start polling for QR / connected status
      startWaPolling()
    } catch (e: unknown) {
      setWaError(e instanceof Error ? e.message : String(e))
    } finally {
      setWaLoading(false)
    }
  }

  function startWaPolling() {
    if (waPollingRef.current) clearInterval(waPollingRef.current)
    waPollingRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/marketing/wa-bridge?action=qr')
        const d = await r.json()
        setWaStatus(d.status ?? 'not_started')
        if (d.qr) setWaQrData(d.qr)
        if (d.phone) setWaPhone(d.phone)
        if (d.status === 'connected') {
          setWaQrData(null)
          clearInterval(waPollingRef.current!)
          waPollingRef.current = null
          // Save connected status to credentials
          await fetch('/api/social/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'whatsapp_personal', credentials: { whatsapp_personal_phone: d.phone ?? 'connected', connected: 'true' } }),
          })
          setPlatformConnected(prev => ({ ...prev, whatsapp_personal: true }))
        }
        if (['disconnected', 'not_started'].includes(d.status)) {
          clearInterval(waPollingRef.current!)
          waPollingRef.current = null
        }
      } catch { /* ignore */ }
    }, 3000)
  }

  async function disconnectWa() {
    setWaLoading(true)
    try {
      await fetch('/api/marketing/wa-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      setWaStatus('not_started')
      setWaQrData(null)
      setWaPhone(null)
      setPlatformConnected(prev => ({ ...prev, whatsapp_personal: false }))
    } catch { /* ignore */ } finally {
      setWaLoading(false)
    }
  }

  function getCredentialFields(platformId: string): { key: string; label: string; placeholder: string; secret: boolean }[] {
    const map: Record<string, { key: string; label: string; placeholder: string; secret: boolean }[]> = {
      line: [
        { key: 'line_channel_access_token', label: 'Channel Access Token', placeholder: 'U...', secret: true },
        { key: 'line_channel_secret', label: 'Channel Secret', placeholder: '...', secret: true },
      ],
      whatsapp: [
        { key: 'whatsapp_phone_number_id', label: 'Phone Number ID', placeholder: '1234567890', secret: false },
        { key: 'whatsapp_access_token', label: 'Access Token', placeholder: 'EAA...', secret: true },
        { key: 'whatsapp_verify_token', label: t('u12.cred.waVerify'), placeholder: 'my_verify_token', secret: false },
        { key: 'whatsapp_app_secret', label: t('u12.cred.waSecret'), placeholder: t('u12.cred.metaKey'), secret: true },
      ],
      whatsapp_personal: [],  // QR-based auth, no manual fields needed
      telegram: [
        { key: 'telegram_bot_token', label: t('u12.cred.tgToken'), placeholder: '123456789:AAF...', secret: true },
        { key: 'telegram_admin_chat_id', label: t('u12.cred.tgAdmin'), placeholder: t('u12.cred.tgAdminPh'), secret: false },
        { key: 'telegram_webhook_secret', label: t('u12.cred.tgSecret'), placeholder: t('u12.cred.anyString'), secret: true },
      ],
      zalo: [
        { key: 'zalo_oa_access_token', label: 'OA Access Token', placeholder: '...', secret: true },
      ],
      wechat: [
        { key: 'wechat_app_id', label: 'App ID', placeholder: 'wx...', secret: false },
        { key: 'wechat_app_secret', label: 'App Secret', placeholder: '...', secret: true },
        { key: 'wechat_token', label: t('u12.cred.wechatToken'), placeholder: t('u12.cred.anyString'), secret: false },
      ],
    }
    return map[platformId] ?? []
  }

  function saveSettings() {
    setSavingSettings(true)
    const filesToSave = dialogueFiles.length > 0 ? dialogueFiles : (savedData?.dialogueFiles ?? [])
    const data: Unit12Data = { systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs, dialogueFiles: filesToSave, bookingFlowEnabled, paymentInfo, bookingFlows, vipList, autoCloseMinutes, notifyWebhooks, discountMaxPct, discountGifts }
    onDone(data)
    setTimeout(() => setSavingSettings(false), 800)
  }

  async function sendTestMessage() {
    if (!testInput.trim() && !testImage) return
    const userMsg = testInput.trim()
    const imgSnap = testImage
    setTestInput('')
    setTestImage(null)
    const userDisplay = userMsg + (imgSnap ? `\n🖼️ ${t('u12.imageTag')}` : '')
    setTestHistory(prev => [...prev, { role: 'user', content: userDisplay }])
    setTestLoading(true)

    try {
      // Dialogue files (CS-specific, highest priority) → Unit 2 company FAQ files (fallback)
      const dialogueTexts = (dialogueFiles)
        .filter(f => f.textContent)
        .map(f => `【知識庫｜${f.name}】\n${f.textContent}`)
        .join('\n\n')
      const faqTexts = (unit2Data?.files ?? [])
        .filter(f => f.textContent)
        .map(f => `【公司資料｜${f.name}】\n${f.textContent}`)
        .join('\n\n')
      const directText = knowledgeBase.trim() ? `【直接輸入知識】\n${knowledgeBase}` : ''
      const mergedKnowledge = [dialogueTexts, directText, faqTexts].filter(Boolean).join('\n\n')

      const res = await fetch('/api/marketing/cs-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: testHistory.slice(-6),
          systemPrompt,
          knowledgeBase: mergedKnowledge,
          escalationThreshold,
          language: replyLanguage,
          campaignId,
          bookingFlowEnabled,
          paymentInfo,
          bookingFlows,
          notifyWebhooks,
          discountMaxPct,
          discountGifts,
          ...(imgSnap ? { imageBase64: imgSnap.base64, imageMimeType: imgSnap.mimeType } : {}),
        }),
      })
      const raw = await res.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: Record<string, any> = {}
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error(raw.slice(0, 200) || t('u12.serverError', { status: res.status }))
      }
      if (data.reply) {
        const newEntry: CsLogEntry = {
          message: userMsg,
          reply: data.reply,
          intent: data.intent,
          risk: data.risk,
          provider: data.provider,
          latencyMs: data.latencyMs,
          ts: new Date().toISOString(),
        }
        const msgMeta = { intent: data.intent, risk: data.risk, provider: data.provider }
        const replyImages: string[] = data.images ?? []
        if (draftMode) {
          setDraftText(data.reply)
          setDraftMeta(msgMeta)
          setDraftUserMsg(userMsg)
          setTestHistory(prev => [...prev, { role: 'user', content: userMsg }])
        } else {
          setTestHistory(prev => [...prev, {
            role: 'assistant',
            content: data.reply,
            images: replyImages,
            meta: msgMeta,
          }])
        }
        // 自動建立工單
        if (data.ticketCreated && data.ticket) {
          setTickets(prev => [data.ticket, ...prev])
          setTab('tickets')
        }
        // 彈出報名表單
        if (data.showBookingForm && data.bookingFormConfig) {
          const cfg = data.bookingFormConfig as BookingFormConfig
          setBookingFormConfig(cfg)
          setBookingParticipants(
            Array.from({ length: Math.max(1, cfg.headcount) }, () => ({ name: '', birthday: '', idNumber: '' }))
          )
          setBookingContactPhone('')
          setBookingFormOpen(true)
        }
        const updatedLogs = [newEntry, ...logs].slice(0, 100)
        setLogs(updatedLogs)
        onDone({ systemPrompt, knowledgeBase, escalationThreshold, replyLanguage, logs: updatedLogs, dialogueFiles, bookingFlowEnabled, paymentInfo, bookingFlows, vipList, autoCloseMinutes, notifyWebhooks, discountMaxPct, discountGifts })
        // 保存到統一收件匣
        saveTestMessageToInbox(userMsg, data.reply, data.intent, data.risk, data.latencyMs)
      } else {
        setTestHistory(prev => [...prev, { role: 'assistant', content: t('u12.errorMsg', { error: data.error ?? t('u12.unknownError') }) }])
      }
    } catch (e) {
      setTestHistory(prev => [...prev, { role: 'assistant', content: t('u12.connError', { error: String(e) }) }])
    }
    setTestLoading(false)
  }

  // 對話摘要
  async function summarizeConversation() {
    if (!testHistory.length) return
    setSummarizing(true)
    setSummary('')
    try {
      const res = await fetch('/api/marketing/cs-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: testHistory }),
      })
      const d = await res.json()
      if (d.summary) setSummary(d.summary)
    } finally {
      setSummarizing(false)
    }
  }

  // 採用草稿送出
  function adoptDraft() {
    if (!draftText) return
    setTestHistory(prev => [...prev, {
      role: 'assistant',
      content: draftText,
      meta: draftMeta ?? undefined,
    }])
    setDraftText('')
    setDraftMeta(null)
    setDraftUserMsg('')
  }

  // 捨棄草稿
  function discardDraft() {
    setDraftText('')
    setDraftMeta(null)
    setDraftUserMsg('')
  }

  // 自動滿意度問卷 / 結案
  function closeCase() {
    const surveyMsg = t('u12.surveyMsg')
    setTestHistory(prev => [...prev, { role: 'assistant', content: surveyMsg }])
    setCaseClosed(true)
    startAutoCloseTimer()
  }

  // 流失預警偵測
  const isChurnWarning = (meta?: { intent?: string; risk?: string }) => {
    if (!meta) return false
    const churnKeywords = ['取消', '退訂', '不用了', '不想', '考慮', '流失', '解約', '退出', '不再']
    const intentStr = (meta.intent ?? '').toLowerCase()
    return meta.risk === 'high' || churnKeywords.some(k => intentStr.includes(k))
  }

  const riskColor = (r: string) =>
    r === 'high' ? 'text-red-600 bg-red-50' :
    r === 'medium' ? 'text-amber-600 bg-amber-50' :
    'text-green-600 bg-green-50'

  // 行業測試語句
  const INDUSTRY_TEST_PHRASES: Record<string, string[]> = {
    homestay: ['有哪些房型？', '這週末還有空房嗎？', '可以加床嗎？幾人入住？', '退訂政策是什麼？', '附近有什麼景點推薦？', 'Do you have rooms available this weekend?'],
    ecommerce: ['我的訂單還沒到', '我想退換貨', '促銷活動什麼時候結束？', '這個商品還有庫存嗎？', '物流追蹤號碼是多少？', '운송 중인 주문을 추적하려면 어떻게 해야 합니까?'],
    restaurant: ['我想訂位，4人，週五晚上', '你們有素食餐點嗎？', '外送範圍和時間？', '包廂需要預約嗎？', '今日特餐是什麼？', 'Can I make a reservation for 2 people tonight?'],
    clinic: ['我想預約下週的療程', '這個療程需要多久恢復？', '費用大概多少？', '術後有什麼注意事項？', '醫師的資歷是什麼？', 'What are the side effects of this treatment?'],
    beauty: ['我想預約洗剪吹', '請問哪位設計師有空？', '燙髮大概多少錢？', '需要提前多久預約？', '你們有護髮療程嗎？', 'Can I book a hair treatment for tomorrow?'],
    education: ['我想了解英文課程', '有試聽課程嗎？', '學費方案有哪些？', '老師的教學方式是什麼？', '孩子幾歲可以開始學？', 'What courses do you offer for beginners?'],
  }

  // VIP 識別
  const vipNames = vipList.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean)
  const isVipMessage = (text: string) => vipNames.some(v => text.toLowerCase().includes(v))

  // 載入 tickets
  async function loadTickets() {
    setTicketsLoading(true)
    try {
      const res = await fetch(`/api/marketing/cs-tickets?industry=${ind}`)
      const d = await res.json()
      if (d.tickets) setTickets(d.tickets)
    } finally {
      setTicketsLoading(false)
    }
  }

  // 建立工單 from current test conversation
  async function createTicketFromConversation() {
    if (!testHistory.length) return
    setCreatingTicket(true)
    const lastUserMsg = [...testHistory].reverse().find(m => m.role === 'user')
    const lastAiMsg = [...testHistory].reverse().find(m => m.role === 'assistant')
    const subject = lastUserMsg?.content?.slice(0, 50) ?? t('u12.ticketSubject')
    const description = testHistory.map(m => `${m.role === 'user' ? t('u12.roleCustomer') : 'AI'}：${m.content}`).join('\n')
    const highRiskMsg = [...testHistory].reverse().find(m => m.role === 'assistant' && m.meta?.risk === 'high')
    const priority = highRiskMsg ? 'high' : 'medium'
    const intent = lastAiMsg?.meta?.intent
    try {
      const res = await fetch('/api/marketing/cs-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: ind, subject, description, priority, intent, messages: testHistory, campaign_id: campaignId }),
      })
      const d = await res.json()
      if (d.ticket) {
        setTickets(prev => [d.ticket, ...prev])
        setTab('tickets')
      }
    } finally {
      setCreatingTicket(false)
    }
  }

  // 載入收件匣
  async function loadInbox() {
    setInboxLoading(true)
    try {
      const url = inboxPlatformFilter !== 'all'
        ? `/api/marketing/cs-messages?industry=${ind}&platform=${inboxPlatformFilter}`
        : `/api/marketing/cs-messages?industry=${ind}`
      const res = await fetch(url)
      const d = await res.json()
      if (d.messages) setInboxMessages(d.messages)
    } finally {
      setInboxLoading(false)
    }
  }

  // 儲存測試對話到收件匣
  async function saveTestMessageToInbox(userMsg: string, reply: string, intent: string, risk: string, latencyMs: number) {
    try {
      await fetch('/api/marketing/cs-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: ind, platform: 'test', from_id: 'test_user', from_name: t('u12.testUser'), message: userMsg, reply, intent, risk, latency_ms: latencyMs, campaign_id: campaignId }),
      })
    } catch { /* silent */ }
  }

  // 自動結案倒數
  function startAutoCloseTimer() {
    if (!autoCloseMinutes || autoCloseMinutes <= 0) return
    const totalSec = autoCloseMinutes * 60
    setAutoCloseSecondsLeft(totalSec)
    if (autoCloseTimerRef.current) clearInterval(autoCloseTimerRef.current)
    autoCloseTimerRef.current = setInterval(() => {
      setAutoCloseSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(autoCloseTimerRef.current!)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  const ticketStatusColor = (s: string) =>
    s === 'open' ? 'text-blue-600 bg-blue-50' :
    s === 'in_progress' ? 'text-amber-600 bg-amber-50' :
    s === 'resolved' ? 'text-green-600 bg-green-50' :
    'text-gray-500 bg-gray-100'
  const ticketStatusLabel = (s: string) =>
    s === 'open' ? t('u12.tkOpen') : s === 'in_progress' ? t('u12.tkInProgress') : s === 'resolved' ? t('u12.tkResolved') : t('u12.tkClosed')
  const ticketPriorityColor = (p: string) =>
    p === 'urgent' ? 'text-red-600 bg-red-50' :
    p === 'high' ? 'text-orange-600 bg-orange-50' :
    p === 'medium' ? 'text-indigo-600 bg-indigo-50' :
    'text-gray-500 bg-gray-100'
  const ticketPriorityLabel = (p: string) =>
    p === 'urgent' ? t('u12.prUrgent') : p === 'high' ? t('u12.prHigh') : p === 'medium' ? t('u12.prMedium') : t('u12.prLow')
  const platformEmoji = (p: string) =>
    p === 'line' ? '💬' : p === 'whatsapp' ? '📱' : p === 'telegram' ? '✈️' : p === 'test' ? '🧪' : '💌'

  return (
    <>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Headphones className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            {t('u12.title')}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('u12.subtitle')}
            <a href="/cs/help" target="_blank" rel="noopener noreferrer" className="ml-2 text-primary font-medium hover:underline">
              完整設定教學 →
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="/cs/plan"
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'var(--primary)' }}>
            <Zap className="h-3.5 w-3.5" />
            升級方案
          </a>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <nav className="flex flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap sm:w-48 sm:shrink-0">
          {(['platforms', 'ai-settings', 'dialogue-files', 'data-sources', 'pricing', 'test', 'logs', 'tickets', 'inbox'] as Cs12Tab[]).map(tb => {
            const openCount = tickets.filter(tk => tk.status === 'open' || tk.status === 'in_progress').length
            const labels: Record<Cs12Tab, string> = {
              platforms: t('u12.tabPlatforms'), 'ai-settings': t('u12.tabAiSettings'), 'dialogue-files': t('u12.tabKnowledge'),
              'data-sources': t('u12.tabDataSources'), pricing: t('u12.tabPricing'), test: t('u12.tabTest'), logs: t('u12.tabLogs'),
              tickets: `${t('u12.tabTickets')}${openCount > 0 ? ` (${openCount})` : ''}`,
              inbox: t('u12.tabInbox'),
            }
            const icons: Record<Cs12Tab, LucideIcon> = {
              platforms: MessageSquare, 'ai-settings': Sparkles, 'dialogue-files': BookOpen,
              'data-sources': Database, pricing: Calculator, test: FlaskConical, logs: ClipboardList,
              tickets: Ticket, inbox: Inbox,
            }
            const Icon = icons[tb]
            const isNew = (tb === 'tickets' || tb === 'inbox') && tab !== tb
            const gatedFlag: Partial<Record<Cs12Tab, boolean>> = {
              'data-sources': csFeatures?.dataSources,
              pricing: csFeatures?.pricingCalculator,
              tickets: csFeatures?.tickets,
              inbox: csFeatures?.inbox,
            }
            const isLocked = csFeatures != null && gatedFlag[tb] === false
            const active = tab === tb
            return (
              <button key={tb}
                onClick={() => {
                  setTab(tb)
                  if (tb === 'tickets') loadTickets()
                  if (tb === 'inbox') loadInbox()
                  if (tb === 'data-sources') loadFaq(industry ?? 'homestay')
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors relative flex items-center gap-2 sm:w-full sm:justify-start ${
                  active ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                <span className="flex-1 text-left">{labels[tb]}</span>
                {isLocked && <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                {isNew && tb === 'inbox' && inboxMessages.length === 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>
            )
          })}
        </nav>
        <div className="flex-1 min-w-0 space-y-5">

      {/* ── Tab: Platforms ──────────────────────────────────────────────────── */}
      {tab === 'platforms' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <span>{t('u12.platformsIntro')}</span>
            <HelpTip title="平台連結怎麼設定？" href="/cs/help#channels">
              這裡跟「頻道綁定」頁是同一份資料，用來確認每個平台是否已連線、對 Telegram 做診斷或送測試訊息。若還沒綁定過任何平台，建議先看完整教學再開始填。
            </HelpTip>
          </p>
          <div className="grid grid-cols-1 gap-3">
            {CS_PLATFORMS.map(p => (
              <div key={p.id} className="border rounded-xl p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                    <span className="font-medium text-sm text-gray-800">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${platformConnected[p.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {platformConnected[p.id] ? t('u12.connected') : t('u12.notSet')}
                    </span>
                    {p.id !== 'whatsapp_personal' && (
                      <button onClick={() => setEditingPlatform(editingPlatform === p.id ? null : p.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                        {t('u12.configure')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Webhook URL */}
                {p.showWebhook && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[10px] bg-gray-100 px-2.5 py-1.5 rounded-lg text-gray-700 font-mono truncate">
                      {appUrl}/api/marketing/cs-webhook/{p.id}/{userId ?? t('u12.loginToShow')}
                    </code>
                    <button onClick={() => userId && navigator.clipboard.writeText(`${appUrl}/api/marketing/cs-webhook/${p.id}/${userId}`)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 whitespace-nowrap">
                      {t('u12.copy')}
                    </button>
                  </div>
                )}

                {/* Note */}
                <p className="text-[10px] text-gray-400">
                  {p.note}
                  {p.docUrl && (
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer"
                      className="ml-1.5 text-indigo-400 hover:text-indigo-600 underline">
                      {t('u12.officialDocs')} ↗
                    </a>
                  )}
                </p>

                {/* Telegram — diagnostic panel */}
                {p.id === 'telegram' && platformConnected['telegram'] && (
                  <div className="space-y-2 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
                    {/* Row 1: register + diagnose */}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={registerTelegramWebhook} disabled={telegramSetupLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 disabled:opacity-50">
                        {telegramSetupLoading ? t('u12.tgRegistering') : `🔗 ${t('u12.tgReregister')}`}
                      </button>
                      <button onClick={checkTelegramDiag} disabled={telegramDiagLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 disabled:opacity-50">
                        {telegramDiagLoading ? t('u12.tgQuerying') : `🔍 ${t('u12.tgCheckStatus')}`}
                      </button>
                    </div>

                    {/* Register result */}
                    {telegramSetupResult && (
                      <div className={`text-[10px] rounded-lg px-3 py-2 ${telegramSetupResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {telegramSetupResult.msg}
                        {telegramSetupResult.webhookUrl && <div className="mt-0.5 font-mono break-all opacity-70">{telegramSetupResult.webhookUrl}</div>}
                      </div>
                    )}

                    {/* Diag result */}
                    {telegramDiag && (
                      <div className="text-[10px] rounded-lg px-3 py-2 bg-gray-800 text-gray-100 space-y-1 font-mono">
                        {/* Endpoint self-check */}
                        {telegramDiag.endpointStatus != null && (
                          <div className={telegramDiag.endpointStatus === 200 ? 'text-green-400' : 'text-red-400'}>
                            🌐 {t('u12.tgEndpoint')}: HTTP {telegramDiag.endpointStatus}
                            {telegramDiag.endpointStatus === 307 ? ` ← ${t('u12.tgRedirected')}` : ''}
                            {telegramDiag.endpointStatus === 200 ? ` ← ${t('u12.tgAccessible')}` : ''}
                          </div>
                        )}
                        {/* Bot info */}
                        {(telegramDiag.me as any)?.ok && (
                          <div>🤖 Bot: @{(telegramDiag.me as any).result?.username} ({(telegramDiag.me as any).result?.first_name})</div>
                        )}
                        {/* Webhook info */}
                        {(telegramDiag.info as any)?.ok && (() => {
                          const r = (telegramDiag.info as any).result
                          return (
                            <>
                              <div>🔗 Webhook URL: <span className="break-all opacity-70">{r.url || t('u12.tgNotSet')}</span></div>
                              <div>📬 Pending updates: {r.pending_update_count ?? 0}</div>
                              {r.last_error_message && (
                                <>
                                  <div className={telegramDiag?.endpointStatus === 200 ? 'text-yellow-400' : 'text-red-400'}>
                                    {telegramDiag?.endpointStatus === 200 ? '⚠️' : '❌'} {t('u12.tgLastError')}: {r.last_error_message}
                                  </div>
                                  {r.last_error_date && (
                                    <div className="text-gray-400 opacity-70">   {t('u12.tgTime')}: {new Date(r.last_error_date * 1000).toLocaleString(locale)}</div>
                                  )}
                                  {telegramDiag?.endpointStatus === 200 && (
                                    <div className="text-green-400">   ✅ {t('u12.tgHistoricError')}</div>
                                  )}
                                </>
                              )}
                              {!r.last_error_message && r.url && (
                                <div className="text-green-400">✅ {t('u12.tgWebhookOk')}</div>
                              )}
                            </>
                          )
                        })()}
                        {telegramDiag.recentChats && telegramDiag.recentChats.length > 0 && (
                          <div className="mt-1">
                            <div className="text-gray-400 mb-0.5">{t('u12.tgRecentChats')}</div>
                            {telegramDiag.recentChats.map(c => (
                              <button key={c.chatId} onClick={() => setTelegramTestChatId(String(c.chatId))}
                                className="mr-1 mb-1 text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-white">
                                {c.name}{c.username ? ` @${c.username}` : ''} ({c.chatId})
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Admin Chat ID status */}
                        {(() => {
                          const adminId = platformCreds['telegram']?.telegram_admin_chat_id
                          return adminId
                            ? <div className="text-blue-300">👤 {t('u12.tgAdminId')}: <span className="text-white">{adminId}</span> ← {t('u12.tgForwardHere')}</div>
                            : <div className="text-yellow-400">⚠️ {t('u12.tgNoAdminId')}</div>
                        })()}
                        {!(telegramDiag.me as any)?.ok && <div className="text-red-400">❌ {t('u12.tgBadToken')}: {JSON.stringify((telegramDiag.me as any)?.description)}</div>}
                      </div>
                    )}

                    {/* Row 2: send test message */}
                    <div className="border-t border-blue-100 pt-2 space-y-1.5">
                      <p className="text-[10px] text-gray-500">{t('u12.tgTestHint')}</p>
                      <div className="flex gap-2">
                        <input
                          value={telegramTestChatId}
                          onChange={e => setTelegramTestChatId(e.target.value)}
                          placeholder={t('u12.tgChatIdPh')}
                          className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button onClick={sendTelegramTestMsg} disabled={telegramTestLoading || !telegramTestChatId.trim()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-green-50 text-green-700 border border-green-200 disabled:opacity-50 whitespace-nowrap">
                          {telegramTestLoading ? t('u12.tgSending') : `📨 ${t('u12.tgSend')}`}
                        </button>
                      </div>
                      {telegramTestResult && (
                        <div className={`text-[10px] rounded-lg px-3 py-1.5 ${telegramTestResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {telegramTestResult.msg}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* WhatsApp Personal — QR scan UI */}
                {p.id === 'whatsapp_personal' && (
                  <div className="space-y-3">
                    {/* Status bar */}
                    <div className={`rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                      waStatus === 'connected' ? 'bg-green-50 text-green-700 border border-green-200' :
                      waStatus === 'qr' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      waStatus === 'connecting' || waStatus === 'reconnecting' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                      'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>
                      <span>
                        {waStatus === 'connected' && waPhone && `✅ ${t('u12.waConnectedPhone', { phone: waPhone })}`}
                        {waStatus === 'connected' && !waPhone && `✅ ${t('u12.waConnected')}`}
                        {waStatus === 'qr' && `📱 ${t('u12.waScanQr')}`}
                        {waStatus === 'connecting' && `⏳ ${t('u12.waConnecting')}`}
                        {waStatus === 'reconnecting' && `🔄 ${t('u12.waReconnecting')}`}
                        {waStatus === 'not_started' && t('u12.waNotConnected')}
                        {waStatus === 'disconnected' && `❌ ${t('u12.waDisconnected')}`}
                      </span>
                      {waStatus === 'connected'
                        ? <button onClick={disconnectWa} disabled={waLoading}
                            className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200">
                            {waLoading ? '...' : t('u12.waDisconnect')}
                          </button>
                        : <button onClick={startWaSession} disabled={waLoading || waStatus === 'connecting' || waStatus === 'qr'}
                            className="text-[10px] px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                            {waLoading ? t('u12.waStarting') : waStatus === 'qr' ? t('u12.waWaiting') : `📱 ${t('u12.waScanConnect')}`}
                          </button>
                      }
                    </div>

                    {/* QR code */}
                    {waQrData && waStatus === 'qr' && (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <img src={waQrData} alt="WhatsApp QR Code"
                          className="w-48 h-48 rounded-xl border-4 border-green-200 shadow" />
                        <p className="text-[10px] text-gray-500 text-center">
                          {t('u12.waQrHint')}
                        </p>
                      </div>
                    )}

                    {waError && (
                      <div className="text-[10px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        ❌ {waError}
                        {waError.includes('WHATSAPP_BRIDGE_URL') && (
                          <div className="mt-1 text-red-500">{t('u12.waBridgeHint')}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Credential inputs (when editing) */}
                {editingPlatform === p.id && (
                  <div className="space-y-2 border-t pt-3">
                    {getCredentialFields(p.id).map(field => {
                      const isSet = field.secret
                        ? !!(platformPreview[p.id]?.[field.key])
                        : false
                      return (
                        <div key={field.key}>
                          <label className="text-[10px] text-gray-500 block mb-1">
                            {field.label}
                            {isSet && <span className="ml-1 text-green-500">{t('u12.fieldSet')}</span>}
                          </label>
                          <input
                            type={field.secret ? 'password' : 'text'}
                            placeholder={isSet ? t('u12.keepOriginal') : field.placeholder}
                            value={platformCreds[p.id]?.[field.key] ?? ''}
                            onChange={e => setPlatformCreds(prev => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], [field.key]: e.target.value }
                            }))}
                            className="w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      )
                    })}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => savePlatformCreds(p.id)} disabled={savingPlatform === p.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ background: 'var(--primary)' }}>
                        {savingPlatform === p.id ? t('u12.saving') : t('u12.save')}
                      </button>
                      <button onClick={() => setEditingPlatform(null)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600">
                        {t('u12.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: AI Settings ────────────────────────────────────────────────── */}
      {tab === 'ai-settings' && (
        <div className="space-y-4">

          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <span>設定 AI 客服的角色、語氣、報價流程、優惠與 VIP 規則。</span>
            <HelpTip title="AI 設定放什麼？" href="/cs/help#ai-settings">
              「系統提示詞」放 AI 的個性和講話方式，不要放 FAQ 或價格——具體資料請到「知識庫」分頁，價格請到「定價計算機」分頁，AI 才不會亂猜。
            </HelpTip>
          </p>

          {/* Industry template banner */}
          {industry && CS_INDUSTRY_TEMPLATES[industry] && (
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CS_INDUSTRY_TEMPLATES[industry].emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-violet-800">{t('u12.tplTitle', { name: industryLabel(industry) })}</div>
                    <div className="text-xs text-violet-500">{t('u12.tplDesc')}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const tpl = CS_INDUSTRY_TEMPLATES[industry]
                    setSystemPrompt(tpl.systemPrompt)
                    if (!knowledgeBase) setKnowledgeBase(tpl.knowledgeBase)
                    setBookingFlowEnabled(tpl.bookingFlowEnabled)
                    setBookingFlows(tpl.bookingFlows)
                  }}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
                >
                  {t('u12.applyTemplate')}
                </button>
              </div>
              {!systemPrompt && (
                <div className="text-xs text-violet-600 bg-violet-100 rounded-lg px-3 py-2">
                  💡 {t('u12.noPromptHint')}
                </div>
              )}
            </div>
          )}

          {/* Industry template selector (no industry in URL) */}
          {!industry && !systemPrompt && (
            <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700">{t('u12.quickApplyTpl')}</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(CS_INDUSTRY_TEMPLATES).map(([id, tpl]) => (
                  <button key={id}
                    onClick={() => {
                      setSystemPrompt(tpl.systemPrompt)
                      if (!knowledgeBase) setKnowledgeBase(tpl.knowledgeBase)
                      setBookingFlowEnabled(tpl.bookingFlowEnabled)
                      setBookingFlows(tpl.bookingFlows)
                    }}
                    className="flex items-center gap-1.5 px-2 py-2 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 border border-gray-200 text-xs text-gray-700 transition-colors text-left"
                  >
                    <span>{tpl.emoji}</span>
                    <span className="truncate">{industryLabel(id)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Routing info */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
            <div className="font-medium text-sm text-indigo-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />{t('u12.routingTitle')}
            </div>
            <div className="flex items-center gap-3 text-xs text-indigo-700">
              <div className="flex flex-col items-center gap-1">
                <div className="px-3 py-1.5 rounded-lg bg-blue-100 border border-blue-300 font-medium">Gemini 2.0 Flash</div>
                <div className="text-[10px] text-gray-500">{t('u12.routingFlash')}</div>
              </div>
              <div className="text-gray-400 text-lg">→</div>
              <div className="flex flex-col items-center gap-1">
                <div className="px-3 py-1.5 rounded-lg bg-orange-100 border border-orange-300 font-medium">Claude Sonnet</div>
                <div className="text-[10px] text-gray-500">{t('u12.routingClaude')}</div>
              </div>
            </div>
            <div className="text-xs text-indigo-600">
              {t.rich('u12.routingNote', { b: (c) => <span className="font-medium">{c}</span> })}
            </div>
          </div>

          {/* 進階 AI 設定（免費方案僅開放系統提示詞，以下全部鎖定） */}
          <div className={csFeatures && csFeatures.aiSettingsScope === 'basic' ? 'relative' : ''}>
            {csFeatures && csFeatures.aiSettingsScope === 'basic' && (
              <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center p-4">
                <div className="bg-white border rounded-xl shadow-lg px-6 py-4 text-center space-y-2 max-w-xs">
                  <Lock className="h-5 w-5 text-gray-400 mx-auto" />
                  <p className="text-sm font-medium text-gray-700">進階 AI 設定為付費方案功能</p>
                  <p className="text-xs text-gray-400">升級方案即可解鎖升級門檻、報價流程、優惠、VIP 等設定</p>
                  <a href="/cs/plan" className="inline-block text-xs text-primary font-medium hover:underline">升級方案 →</a>
                </div>
              </div>
            )}
          <div className={`space-y-4 ${csFeatures && csFeatures.aiSettingsScope === 'basic' ? 'opacity-30 pointer-events-none select-none' : ''}`}>
          {/* Escalation threshold */}
          <div className="border rounded-xl p-4 space-y-3">
            <span className="font-medium text-sm text-gray-700">{t('u12.escalationThreshold')}</span>
            <div className="flex gap-3">
              {([
                { value: 'high', label: t('u12.escHighLabel'), desc: t('u12.escHighDesc'), color: 'red' },
                { value: 'medium', label: t('u12.escMedLabel'), desc: t('u12.escMedDesc'), color: 'amber' },
              ] as const).map(opt => (
                <button key={opt.value} onClick={() => setEscalationThreshold(opt.value)}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    escalationThreshold === opt.value
                      ? `border-${opt.color}-400 bg-${opt.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="font-medium text-xs text-gray-800">{opt.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reply language */}
          <div className="border rounded-xl p-4 space-y-2">
            <span className="font-medium text-sm text-gray-700">{t('u12.replyLanguage')}</span>
            <select value={replyLanguage} onChange={e => setReplyLanguage(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="auto">{t('u12.autoDetect')}</option>
              <option value="繁體中文">繁體中文</option>
              <option value="简体中文">简体中文</option>
              <option value="English">English</option>
              <option value="Tiếng Việt">Tiếng Việt（越南語）</option>
              <option value="日本語">日本語</option>
              <option value="한국어">한국어</option>
              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
              <option value="ภาษาไทย">ภาษาไทย（泰語）</option>
            </select>
          </div>

          {/* System Prompt */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 space-y-2 bg-indigo-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-700">{t('u12.systemPrompt')}</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{t('u12.aiRoleTag')}</span>
              </div>
              <span className="text-xs text-gray-400">{t('u12.nChars', { n: systemPrompt.length })}</span>
            </div>
            <p className="text-xs text-gray-500">{t.rich('u12.systemPromptHint', { b: (c) => <strong>{c}</strong>, br: () => <br /> })}</p>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder={t('u12.systemPromptPlaceholder')}
              className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          {/* Booking flow toggle + multi-flow config */}
          <div className="border-2 border-emerald-200 rounded-xl p-4 space-y-3 bg-emerald-50/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-gray-700">{t('u12.bookingFlow')}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('u12.bookingFlowHint')}</div>
              </div>
              <button
                onClick={() => setBookingFlowEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bookingFlowEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${bookingFlowEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {bookingFlowEnabled && (
              <div className="space-y-3">
                {/* Flow list */}
                {bookingFlows.map((flow, fi) => (
                  <div key={flow.id} className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700">{flow.name || t('u12.flowN', { n: fi + 1 })}</span>
                        {flow.simpleMode && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{t('u12.quickBooking')}</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditingFlow({ ...flow })}
                          className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">{t('u12.edit')}</button>
                        <button onClick={() => setBookingFlows(prev => prev.filter((_, i) => i !== fi))}
                          className="text-[10px] px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">{t('u12.delete')}</button>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {t('u12.triggerKw')}<span className="text-emerald-700 font-medium">{flow.triggerKeywords || t('u12.notConfigured')}</span>
                    </div>
                    {flow.simpleMode
                      ? <div className="text-[10px] text-blue-600">{t('u12.simpleModeFlow')}</div>
                      : <div className="text-[10px] text-gray-500">{t('u12.collectSteps')}{flow.steps.map(s => stepLabel(s)).join(' → ')}</div>
                    }
                  </div>
                ))}

                <button
                  onClick={() => setEditingFlow({ id: `flow_${Date.now()}`, name: '', triggerKeywords: '', dataHint: '', steps: ['date_depart', 'timeslot', 'headcount', 'phone'], paymentInfo: '' })}
                  className="w-full py-2 rounded-xl text-xs font-medium border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> {t('u12.addBookingType')}
                </button>

                {/* Global payment info */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">{t('u12.defaultPayment')}</div>
                  <textarea
                    value={paymentInfo}
                    onChange={e => setPaymentInfo(e.target.value)}
                    rows={2}
                    placeholder={t('u12.paymentPlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Flow editor modal */}
          {editingFlow && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setEditingFlow(null) }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-800">{t('u12.flowEditorTitle')}</h3>
                  <button onClick={() => setEditingFlow(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('u12.flowName')}</label>
                  <input value={editingFlow.name} onChange={e => setEditingFlow(f => f ? { ...f, name: e.target.value } : f)}
                    placeholder={t('u12.flowNamePlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Trigger keywords */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('u12.triggerKwLabel')}</label>
                  <p className="text-[10px] text-gray-400">{t('u12.triggerKwHint')}</p>
                  <input value={editingFlow.triggerKeywords} onChange={e => setEditingFlow(f => f ? { ...f, triggerKeywords: e.target.value } : f)}
                    placeholder={t('u12.triggerKwPlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Data hint */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('u12.dataHintLabel')}</label>
                  <p className="text-[10px] text-gray-400">{t.rich('u12.dataHintHint', { br: () => <br /> })}</p>
                  <input value={editingFlow.dataHint ?? ''} onChange={e => setEditingFlow(f => f ? { ...f, dataHint: e.target.value } : f)}
                    placeholder={t('u12.dataHintPlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Simple mode toggle */}
                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editingFlow.simpleMode ?? false}
                      onChange={e => setEditingFlow(f => f ? { ...f, simpleMode: e.target.checked } : f)}
                      className="rounded" />
                    <span className="text-xs font-semibold text-blue-800">{t('u12.simpleMode')}</span>
                  </label>
                  <p className="text-[10px] text-blue-600 leading-relaxed">{t('u12.simpleModeHint')}</p>
                  {editingFlow.simpleMode && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editingFlow.requirePassengerId ?? true}
                        onChange={e => setEditingFlow(f => f ? { ...f, requirePassengerId: e.target.checked } : f)}
                        className="rounded" />
                      <span className="text-xs text-blue-700">{t('u12.requireId')}</span>
                    </label>
                  )}
                </div>

                {/* Steps — hidden in simple mode */}
                {!editingFlow.simpleMode && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">{t('u12.collectStepsLabel')}</label>
                  <div className="space-y-1.5">
                    {BOOKING_STEPS.map(step => {
                      const checked = editingFlow.steps.includes(step)
                      const idx = editingFlow.steps.indexOf(step)
                      return (
                        <div key={step} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${checked ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                          <input type="checkbox" checked={checked} onChange={e => {
                            setEditingFlow(f => {
                              if (!f) return f
                              const steps = e.target.checked
                                ? [...f.steps, step]
                                : f.steps.filter(s => s !== step)
                              return { ...f, steps }
                            })
                          }} className="rounded" />
                          <span className="text-xs flex-1">{stepLabel(step)}</span>
                          {checked && (
                            <div className="flex gap-1">
                              <button disabled={idx === 0} onClick={() => setEditingFlow(f => {
                                if (!f) return f
                                const s = [...f.steps]; [s[idx - 1], s[idx]] = [s[idx], s[idx - 1]]; return { ...f, steps: s }
                              })} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↑</button>
                              <button disabled={idx === editingFlow.steps.length - 1} onClick={() => setEditingFlow(f => {
                                if (!f) return f
                                const s = [...f.steps]; [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]]; return { ...f, steps: s }
                              })} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↓</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                )}

                {/* Payment info per flow */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('u12.flowPaymentLabel')}</label>
                  <textarea value={editingFlow.paymentInfo} onChange={e => setEditingFlow(f => f ? { ...f, paymentInfo: e.target.value } : f)}
                    rows={2}
                    placeholder={t('u12.flowPaymentPlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingFlow(null)}
                    className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">{t('u12.cancel')}</button>
                  <button onClick={() => {
                    if (!editingFlow) return
                    setBookingFlows(prev => {
                      const idx = prev.findIndex(f => f.id === editingFlow.id)
                      return idx >= 0 ? prev.map((f, i) => i === idx ? editingFlow : f) : [...prev, editingFlow]
                    })
                    setEditingFlow(null)
                  }} className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: 'var(--primary)' }}>
                    {t('u12.saveFlow')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── AI 促成優惠權限 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold text-gray-800">{t('u12.discountTitle')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{t('u12.salesTool')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('u12.discountDesc')}</p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                {t('u12.maxDiscount')}　<span className="font-normal text-gray-400">{t('u12.maxDiscountHint')}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={30} step={1}
                  value={discountMaxPct}
                  onChange={e => setDiscountMaxPct(Number(e.target.value))}
                  className="w-20 text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                <span className="text-sm text-gray-500">%</span>
                {discountMaxPct > 0 && <span className="text-xs text-purple-600">{t('u12.maxDiscountOk', { pct: discountMaxPct })}</span>}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                {t('u12.giftItems')}　<span className="font-normal text-gray-400">{t('u12.onePerLine')}</span>
              </label>
              <textarea
                value={discountGifts}
                onChange={e => setDiscountGifts(e.target.value)}
                rows={4}
                placeholder={t('u12.giftPlaceholder')}
                className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none font-mono"
              />
              <p className="text-[10px] text-gray-400">{t('u12.giftHint')}</p>
            </div>
          </div>

          {/* ── VIP 識別 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-800">{t('u12.vipTitle')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{t('u12.live')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('u12.vipDesc')}</p>
            <textarea
              value={vipList}
              onChange={e => setVipList(e.target.value)}
              rows={4}
              placeholder={'王小明\n0912\nVIP001\nJohn Wang'}
              className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none font-mono"
            />
          </div>

          {/* ── 自動結案 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">{t('u12.autoClose')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{t('u12.live')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('u12.autoCloseDesc')}</p>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={120}
                value={autoCloseMinutes}
                onChange={e => setAutoCloseMinutes(Number(e.target.value))}
                className="w-24 text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <span className="text-sm text-gray-500">{t('u12.minutesAutoClose')}</span>
              {autoCloseMinutes > 0 && <span className="text-xs text-green-600">{t('u12.enabled')}</span>}
            </div>
          </div>

          {/* 工單通知設定 */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{t('u12.ticketNotify')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{t('u12.ticketNotifyTag')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('u12.ticketNotifyDesc')}</p>
            {notifyWebhooks.map((wh, idx) => (
              <div key={wh.id} className="flex gap-2 items-start p-3 bg-gray-50 rounded-xl border">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={wh.type}
                      onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, type: e.target.value as NotifyWebhook['type'], value: '', target: '' } : w))}
                      className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      <option value="line_messaging">LINE Messaging API</option>
                      <option value="telegram">Telegram Bot</option>
                      <option value="webhook">Webhook</option>
                    </select>
                    <input
                      placeholder={t('u12.whLabelPh')}
                      value={wh.label}
                      onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, label: e.target.value } : w))}
                      className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                  {wh.type === 'line_messaging' ? (
                    <>
                      <input
                        placeholder={t('u12.whLineToken')}
                        value={wh.value}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, value: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                      <input
                        placeholder={t('u12.whLineTarget')}
                        value={wh.target ?? ''}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, target: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                    </>
                  ) : wh.type === 'telegram' ? (
                    <>
                      <input
                        placeholder={t('u12.whTgToken')}
                        value={wh.value}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, value: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                      <input
                        placeholder={t('u12.whTgChatId')}
                        value={wh.target ?? ''}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, target: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                      <p className="text-[10px] text-gray-400">💡 {t('u12.whTgHint')}</p>
                    </>
                  ) : (
                    <input
                      placeholder="Webhook URL（https://...）"
                      value={wh.value}
                      onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, value: e.target.value } : w))}
                      className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                    />
                  )}
                </div>
                <button onClick={() => setNotifyWebhooks(prev => prev.filter((_, i) => i !== idx))}
                  className="text-gray-400 hover:text-red-500 p-1 rounded">✕</button>
              </div>
            ))}
            <button
              onClick={() => setNotifyWebhooks(prev => [...prev, { id: crypto.randomUUID(), type: 'line_messaging', label: '', value: '', target: '' }])}
              className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 flex items-center gap-1"
            >+ {t('u12.addNotifyChannel')}</button>
          </div>
          </div>
          </div>

          <button onClick={saveSettings} disabled={savingSettings}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'var(--primary)' }}>
            {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u12.saving')}</> : <><CheckCircle2 className="h-4 w-4" />{t('u12.saveSettings')}</>}
          </button>

          {/* Env hint */}
          <div className="bg-gray-50 border rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <div className="font-medium text-gray-600">{t('u11.envHint')}</div>
            <div className="flex gap-2 flex-wrap">
              <code className="bg-blue-100 px-1.5 py-0.5 rounded">GOOGLE_AI_API_KEY</code>
              <code className="bg-orange-100 px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Dialogue Files ─────────────────────────────────────────────── */}
      {tab === 'dialogue-files' && (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              {t('u12.tabKnowledge')}
              <HelpTip title="知識庫要放什麼？" href="/cs/help#dialogue-files">
                放常見問題與答案、房型/商品介紹、規定條款等「具體資訊」，AI 會優先從這裡找答案。內容愈完整，AI 答錯機率愈低。
              </HelpTip>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{t('u12.kbHint')}</div>
          </div>

          {/* Direct text input */}
          <div className="border-2 border-green-200 rounded-xl p-4 space-y-2 bg-green-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">{t('u12.kbDirectInput')}</span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{t('u12.kbFaqTag')}</span>
              </div>
              <span className="text-xs text-gray-400">{t('u12.nChars', { n: knowledgeBase.length })}</span>
            </div>
            <p className="text-xs text-gray-500">{t.rich('u12.kbDesc', { b: (c) => <strong>{c}</strong>, br: () => <br /> })}</p>
            <textarea
              value={knowledgeBase}
              onChange={e => setKnowledgeBase(e.target.value)}
              rows={8}
              placeholder={t('u12.kbPlaceholder')}
              className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 font-mono"
            />
          </div>

          {/* File upload */}
          <div className="border rounded-xl p-4 space-y-3">
            <span className="text-xs font-medium text-gray-600">{t('u12.uploadDoc')}</span>
            <div
              onClick={() => !uploadingDialogue && dialogueInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${uploadingDialogue ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            >
              <input
                ref={dialogueInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleDialogueUpload(f); e.target.value = '' }}
              />
              {uploadingDialogue
                ? <><Loader2 className="h-5 w-5 text-gray-400 mx-auto mb-1 animate-spin" /><p className="text-xs text-gray-500">{t('u12.uploadingShort')}</p></>
                : <><Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" /><p className="text-xs text-gray-500">{t('u12.clickUpload50')}</p></>
              }
            </div>
            {(() => {
              // Always show files from either local state or saved DB data
              const displayFiles = dialogueFiles.length > 0 ? dialogueFiles : (savedData?.dialogueFiles ?? [])
              return displayFiles.length === 0 ? (
                <p className="text-xs text-gray-400 text-center">{t('u12.noFiles')}</p>
              ) : (
                <div className="space-y-1.5">
                  {displayFiles.map(f => (
                    <div key={f.url} className="flex items-center gap-3 p-2.5 rounded-lg border bg-gray-50">
                      <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-400">{f.sizeKb} KB · {f.textContent ? t('u12.extractedChars', { n: f.textContent.length.toLocaleString() }) : t('u12.noTextContent')}</p>
                      </div>
                      <button onClick={() => removeDialogueFile(f.url)} className="text-gray-400 hover:text-red-500 transition-colors" title={t('u12.deleteFile')}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Save */}
          <button onClick={saveSettings} disabled={savingSettings}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'var(--primary)' }}>
            {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u12.saving')}</> : <><CheckCircle2 className="h-4 w-4" />{t('u12.saveKb')}</>}
          </button>
        </div>
      )}

      {/* ── Tab: Data Sources ───────────────────────────────────────────────── */}
      {tab === 'data-sources' && (csFeatures && !csFeatures.dataSources ? renderLockedUpgrade('資料來源') : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                {t('u12.extSources')}
                <HelpTip title="資料來源怎麼串接？" href="/cs/help#data-sources">
                  把 Google Sheets 權限改成「知道連結的人可以查看」，貼上表單網址、設定查詢欄位與觸發關鍵字，AI 就能即時查表回答（例如訂單密碼、物流狀態）。
                </HelpTip>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{t('u12.extSourcesHint')}</div>
            </div>
            <button onClick={openAddDs}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1"
              style={{ background: 'var(--primary)' }}>
              <Plus className="h-3.5 w-3.5" />{t('u12.add')}
            </button>
          </div>

          {/* Industry recommended sheets guide */}
          {ind === 'homestay' && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">{t('u12.sourceSwitch')}</div>
                <p className="text-[11px] text-gray-400 mt-0.5">{t('u12.sourceSwitchHint')}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{t('u12.roomPrice')}</div>
                  <div className="text-[10px] text-gray-400">{t('u12.roomPriceHint')}</div>
                </div>
                <div className="flex rounded-lg border overflow-hidden text-xs shrink-0">
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, priceSource: 'booking_system' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.priceSource === 'booking_system' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('u12.bookingSystem')}</button>
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, priceSource: 'pricing_calculator' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.priceSource === 'pricing_calculator' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('u12.tabPricing')}</button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{t('u12.checkinPwd')}</div>
                  <div className="text-[10px] text-gray-400">{t('u12.checkinPwdHint')}</div>
                </div>
                <div className="flex rounded-lg border overflow-hidden text-xs shrink-0">
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, passwordSource: 'booking_system' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.passwordSource === 'booking_system' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('u12.bookingSystem')}</button>
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, passwordSource: 'datasource' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.passwordSource === 'datasource' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('u12.pwdSheet')}</button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{t('u12.checkinTime')}</div>
                  <div className="text-[10px] text-gray-400">{t('u12.checkinTimeHint')}</div>
                </div>
                <input type="time" value={sourcePrefs.checkinTime}
                  onChange={e => setSourcePrefs({ ...sourcePrefs, checkinTime: e.target.value })}
                  onBlur={() => saveSourcePrefs(sourcePrefs)} disabled={savingPrefs}
                  className="text-sm border rounded-lg px-2 py-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
          )}

          {industry && CS_INDUSTRY_TEMPLATES[industry] && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">{CS_INDUSTRY_TEMPLATES[industry].emoji}</span>
                <div className="font-medium text-sm text-blue-800">{t('u12.recommendedSheets', { name: industryLabel(industry) })}</div>
              </div>
              <div className="space-y-2">
                {CS_INDUSTRY_TEMPLATES[industry].recommendedSheets.map((sheet, i) => (
                  <div key={i} className="bg-white rounded-lg border border-blue-100 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{t('u12.sheetN', { n: i + 1 })}</span>
                      <span className="text-xs font-semibold text-gray-800">{sheet.name}</span>
                      <span className="text-[10px] text-gray-400">{sheet.description}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      <div>{t('u12.queryColumn')}<span className="text-gray-700 font-medium">{sheet.keyColumn}</span></div>
                      <div>{t('u12.returnColExample')}<span className="text-gray-600">{sheet.returnColumnsExample}</span></div>
                      <div>{t('u12.triggerWord')}<span className="text-blue-600">{sheet.triggerKeywords}</span>　{t('u12.triggerMode')}<span className="font-medium">{sheet.triggerMode === 'numeric' ? t('u12.tmNumeric') : sheet.triggerMode === 'both' ? t('u12.tmBoth') : t('u12.tmKeyword')}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-blue-600 space-y-0.5">
                <div>💡 {t.rich('u12.dsTip1', { b: (c) => <strong>{c}</strong> })}</div>
                <div>👉 {t('u12.dsTip2')}</div>
              </div>
            </div>
          )}

          {dsLoading && <div className="text-xs text-gray-400 text-center py-4"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />{t('u12.loadingShort')}</div>}

          {dataSources.length === 0 && !dsLoading && !editingDs && (
            <div className="border-2 border-dashed rounded-xl p-6 text-center space-y-2">
              <div className="text-sm text-gray-400">{t('u12.noDataSources')}</div>
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 text-left space-y-1">
                <div className="font-medium text-gray-600">📌 {t('u12.toolDivision')}</div>
                <div>• {t.rich('u12.toolSheets', { b: (c) => <span className="font-medium">{c}</span> })}</div>
                <div>• {t.rich('u12.toolPricing', { b: (c) => <span className="font-medium">{c}</span> })}</div>
                <div>• {t.rich('u12.toolKb', { b: (c) => <span className="font-medium">{c}</span> })}</div>
              </div>
            </div>
          )}

          {dataSources.length > 0 && !editingDs && (
            <div className="space-y-2">
              {dataSources.map(src => (
                <div key={src.id} className="border rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{src.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {t('u12.triggerWord')}{(src.config.triggerKeywords ?? []).join('、') || t('u12.tgNotSet')}
                    </div>
                  </div>
                  <button onClick={() => toggleDs(src)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${src.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {src.enabled ? t('u12.enable') : t('u12.disable')}
                  </button>
                  <button onClick={() => openEditDs(src)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">{t('u12.edit')}</button>
                  <button onClick={() => deleteDs(src.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">{t('u12.delete')}</button>
                </div>
              ))}
            </div>
          )}

          {editingDs !== null && (
            <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="font-medium text-sm text-gray-700">{editingDs.id ? t('u12.editSource') : t('u12.addSource')}</div>

              {[
                { key: 'name', label: t('u12.dsName'), placeholder: t('u12.dsNamePh'), secret: false },
                { key: 'apiKey', label: 'Google Sheets API Key', placeholder: 'AIzaSy...', secret: true },
                { key: 'spreadsheetId', label: 'Spreadsheet ID', placeholder: t('u12.dsSpreadsheetPh'), secret: false },
                { key: 'sheetName', label: t('u12.dsSheetName'), placeholder: t('u12.dsSheetNamePh'), secret: false },
                { key: 'keyColumn', label: t('u12.dsKeyColumn'), placeholder: t('u12.dsKeyColumnPh'), secret: false },
              ].map(({ key, label, placeholder, secret }) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
                  <input
                    type={secret ? 'password' : 'text'}
                    placeholder={placeholder}
                    value={(editingDsForm as Record<string, unknown>)[key] as string ?? ''}
                    onChange={e => setEditingDsForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              ))}

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('u12.dsReturnCols')}</label>
                <textarea
                  rows={4}
                  placeholder={t('u12.dsReturnColsPh')}
                  value={editingDsForm.returnColumns.join('\n')}
                  onChange={e => setEditingDsForm(prev => ({ ...prev, returnColumns: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono leading-relaxed"
                />
                <div className="text-[10px] text-gray-400 mt-0.5">{t('u12.dsReturnColsHint')}</div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('u12.dsTriggerMode')}</label>
                <select
                  value={editingDsForm.triggerMode ?? 'keyword'}
                  onChange={e => setEditingDsForm(prev => ({ ...prev, triggerMode: e.target.value as 'keyword' | 'numeric' | 'both' }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="keyword">{t('u12.dsTmKeyword')}</option>
                  <option value="numeric">{t('u12.dsTmNumeric')}</option>
                  <option value="both">{t('u12.dsTmBoth')}</option>
                </select>
                {editingDsForm.triggerMode === 'numeric' && (
                  <div className="text-[10px] text-indigo-600 mt-1 bg-indigo-50 px-2 py-1 rounded">
                    {t('u12.dsNumericHint')}
                  </div>
                )}
              </div>

              {(editingDsForm.triggerMode === 'keyword' || editingDsForm.triggerMode === 'both' || !editingDsForm.triggerMode) && (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">{t('u12.dsTriggerKw')}</label>
                  <input
                    type="text"
                    placeholder={t('u12.dsTriggerKwPh')}
                    value={editingDsForm.triggerKeywords.join(',')}
                    onChange={e => setEditingDsForm(prev => ({ ...prev, triggerKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-700 space-y-1">
                <div className="font-medium">{t('u12.howToGetId')}</div>
                <div>{t.rich('u12.howToGetIdBody', { b: (c) => <strong>{c}</strong> })}</div>
                <div className="font-medium mt-1">{t('u12.sheetsPermHint')}</div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={saveDs} disabled={savingDs}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-70"
                  style={{ background: 'var(--primary)' }}>
                  {savingDs ? t('u12.saving') : t('u12.save')}
                </button>
                <button onClick={() => setEditingDs(null)}
                  className="px-4 py-2 rounded-lg text-xs bg-gray-200 text-gray-600">
                  {t('u12.cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <div className="font-medium">{t('u12.usageNotes')}</div>
            <div>• {t('u12.usage1')}</div>
            <div>• {t('u12.usage2')}</div>
            <div>• {t('u12.usage3')}</div>
            <div>• {t('u12.usage4')}</div>
          </div>

          {/* ── 民宿購物設定 ── */}
          <div className="border-t pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">🍱 {t('u12.shopTitle')}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t('u12.shopHint')}</div>
              </div>
              {editingBreakfast === null && (
                <button onClick={openAddBreakfast}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1 flex-shrink-0"
                  style={{ background: 'var(--primary)' }}>
                  <Plus className="h-3.5 w-3.5" />{t('u12.add')}
                </button>
              )}
            </div>

            {breakfastSources.length === 0 && editingBreakfast === null && (
              <div className="border-2 border-dashed rounded-xl p-5 text-center text-xs text-gray-400">
                {t('u12.noShopConfig')}
              </div>
            )}

            {breakfastSources.length > 0 && editingBreakfast === null && (
              <div className="space-y-2">
                {breakfastSources.map(src => (
                  <div key={src.id} className="border rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{src.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {t('u12.shopMeta', { cutoff: src.config.cutoffTime ?? '--', delivery: src.config.deliveryTime ?? '--', count: (src.config.menu ?? []).length })}
                      </div>
                    </div>
                    <button onClick={() => toggleBreakfast(src)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${src.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {src.enabled ? t('u12.enable') : t('u12.disable')}
                    </button>
                    <button onClick={() => openEditBreakfast(src)}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">{t('u12.edit')}</button>
                    <button onClick={() => deleteBreakfast(src.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">{t('u12.delete')}</button>
                  </div>
                ))}
              </div>
            )}

            {editingBreakfast !== null && (
              <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
                <div className="font-medium text-sm text-gray-700">
                  {(editingBreakfast as CsDataSource).id ? t('u12.editShopConfig') : t('u12.addShopConfig')}
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">{t('u12.shopName')} <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    placeholder={t('u12.shopNamePh')}
                    value={editingBreakfastForm.name}
                    onChange={e => setEditingBreakfastForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">{t('u12.appsScriptUrl')} <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    placeholder="https://script.google.com/macros/s/XXXXX/exec"
                    value={editingBreakfastForm.webhookUrl}
                    onChange={e => setEditingBreakfastForm(p => ({ ...p, webhookUrl: e.target.value }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <div className="text-[10px] text-gray-400 mt-0.5">{t('u12.appsScriptHint')}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">{t('u12.cutoffTime')}</label>
                    <input
                      type="text"
                      placeholder="22:00"
                      value={editingBreakfastForm.cutoffTime}
                      onChange={e => setEditingBreakfastForm(p => ({ ...p, cutoffTime: e.target.value }))}
                      className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">{t('u12.deliveryTime')}</label>
                    <input
                      type="text"
                      placeholder="07:50"
                      value={editingBreakfastForm.deliveryTime}
                      onChange={e => setEditingBreakfastForm(p => ({ ...p, deliveryTime: e.target.value }))}
                      className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">{t('u12.roomList')}</label>
                  <textarea
                    rows={5}
                    placeholder={'201 龜山加大床房\n202 蘭博雙人房\n301 海景加大床房\n302 山景雙人房\n401 露臺雙人房'}
                    value={editingBreakfastForm.rooms}
                    onChange={e => setEditingBreakfastForm(p => ({ ...p, rooms: e.target.value }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">{t('u12.itemMenu')}</label>
                  <textarea
                    rows={6}
                    placeholder={'SET A 薯餅起司堡\nSET B (全素)綜合蔬食總匯\nSET C 厚切牛肉起司堡\nSET D (奶蛋素)松露薯泥堡\nSET E 中華拼盤'}
                    value={editingBreakfastForm.menu}
                    onChange={e => setEditingBreakfastForm(p => ({ ...p, menu: e.target.value }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono leading-relaxed"
                  />
                  <div className="text-[10px] text-gray-400 mt-0.5">{t('u12.itemMenuHint')}</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-700 space-y-1">
                  <div className="font-medium">{t('u12.orderFlowTitle')}</div>
                  <div>{t('u12.orderFlow1')}</div>
                  <div>{t('u12.orderFlow2')}</div>
                  <div>{t('u12.orderFlow3')}</div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveBreakfast}
                    disabled={savingBreakfast || !editingBreakfastForm.webhookUrl.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: 'var(--primary)' }}
                  >
                    {savingBreakfast
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('u12.saving')}</>
                      : <><CheckCircle2 className="h-3.5 w-3.5" />{t('u12.save')}</>}
                  </button>
                  <button onClick={() => setEditingBreakfast(null)}
                    className="px-4 py-2 rounded-lg text-xs bg-gray-200 text-gray-600">
                    {t('u12.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* ── Tab: Pricing Calculator ─────────────────────────────────────────── */}
      {tab === 'pricing' && (csFeatures && !csFeatures.pricingCalculator ? renderLockedUpgrade('報價計算機') : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                {t('u12.tabPricing')}
                <HelpTip title="報價計算機怎麼用？" href="/cs/help#pricing">
                  填入房型/票種的平日價、假日價、團體折扣後，AI 回覆價格時會精確套用這裡的數字計算，不會用猜的。設定完可到「測試」分頁實際問價驗證。
                </HelpTip>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{t('u12.pricingHint')}</div>
            </div>
            {!editingPc && (
              <div className="flex gap-1.5 flex-wrap">
                {(industry && CS_INDUSTRY_TEMPLATES[industry]
                  ? CS_INDUSTRY_TEMPLATES[industry].pricingButtons
                  : [{ key: 'tour', label: `+ ${t('u12.pcTour')}` }, { key: 'accommodation', label: `+ ${t('u12.pcAccommodation')}` }, { key: 'custom', label: `+ ${t('u12.pcCustom')}` }]
                ).map(({ key, label }, idx) => (
                  <button key={idx} onClick={() => openAddPc(key)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ background: 'var(--primary)' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {pricingConfigs.length === 0 && !editingPc && (
            <div className="border-2 border-dashed rounded-xl p-8 text-center text-sm text-gray-400">
              <div className="mb-2">{t('u12.noPricing')}</div>
              <div className="text-xs">{t('u12.noPricingHint')}</div>
            </div>
          )}

          {pricingConfigs.length > 0 && !editingPc && (
            <div className="space-y-2">
              {pricingConfigs.map((pc) => {
                const cfg = pc.config as { productType?: string; triggerKeywords?: string[] }
                const typeLabel = cfg.productType === 'tour' ? t('u12.pcTour') : cfg.productType === 'accommodation' ? t('u12.pcAccommodation') : t('u12.pcCustom')
                return (
                  <div key={pc.id} className="border rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">{typeLabel}</span>
                        <span className="truncate">{pc.name}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        觸發詞：{(cfg.triggerKeywords ?? []).join('、') || '（未設定）'}
                      </div>
                    </div>
                    <button onClick={() => togglePc(pc)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pc.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pc.enabled ? '啟用' : '停用'}
                    </button>
                    <button onClick={() => openEditPc(pc)}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">編輯</button>
                    <button onClick={() => deletePc(pc.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">{t('u12.delete')}</button>
                  </div>
                )
              })}
            </div>
          )}

          {editingPc !== null && (
            <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="font-medium text-sm text-gray-700">{editingPc.id ? t('u12.editPricing') : t('u12.addPricing')}</div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('u12.dsName')}</label>
                <input
                  type="text"
                  placeholder={t('u12.pcNamePh')}
                  value={editingPc.name}
                  onChange={e => setEditingPc(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-500">{t('u12.pricingJson')}</label>
                  <div className="flex gap-1">
                    {(['tour', 'accommodation', 'custom'] as const).map(k => (
                      <button key={k} onClick={() => setEditingPc(prev => prev ? { ...prev, jsonText: JSON.stringify(PRICING_TEMPLATES[k], null, 2) } : prev)}
                        className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                        {k === 'tour' ? t('u12.loadTourTpl') : k === 'accommodation' ? t('u12.loadAccTpl') : t('u12.loadCustomTpl')}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={editingPc.jsonText}
                  onChange={e => { setEditingPc(prev => prev ? { ...prev, jsonText: e.target.value } : prev); setPcJsonError('') }}
                  rows={18}
                  spellCheck={false}
                  className={`w-full text-xs border rounded-lg px-3 py-2 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 ${pcJsonError ? 'border-red-400' : ''}`}
                />
                {pcJsonError && <div className="text-[10px] text-red-500 mt-1">{pcJsonError}</div>}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-700 space-y-1">
                <div className="font-medium">{t('u12.jsonFields')}</div>
                <div>• <code>triggerKeywords</code>{t('u12.jfTrigger')}</div>
                <div>• <code>weekdayPrice</code> / <code>weekendPrice</code>{t('u12.jfPrice')}</div>
                <div>• <code>packages</code>{t('u12.jfPackages')}</div>
                <div>• <code>groupDiscounts</code>{t('u12.jfGroup')}</div>
                <div>• <code>cancellationPolicy</code>{t('u12.jfCancel')}</div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={savePc} disabled={savingPc || !editingPc.name.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-70"
                  style={{ background: 'var(--primary)' }}>
                  {savingPc ? t('u12.saving') : t('u12.save')}
                </button>
                <button onClick={() => { setEditingPc(null); setPcJsonError('') }}
                  className="px-4 py-2 rounded-lg text-xs bg-gray-200 text-gray-600">
                  {t('u12.cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <div className="font-medium">{t('u12.usageNotes')}</div>
            <div>• {t('u12.pcUsage1')}</div>
            <div>• {t('u12.pcUsage2')}</div>
            <div>• {t('u12.pcUsage3')}</div>
          </div>
        </div>
      ))}

      {/* ── Tab: Test ───────────────────────────────────────────────────────── */}
      {tab === 'test' && (
        <div className="space-y-4">
          <div className="border rounded-xl overflow-hidden">
            {/* Chat header */}
            <div className="bg-gray-50 border-b px-4 py-2.5 flex items-center gap-2 flex-wrap">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-gray-700">{t('u12.testChat')}</span>
              <span className="text-[10px] text-gray-400">{t('u12.testRouting')}</span>
              <HelpTip title="測試對話怎麼用？" href="/cs/help#test">
                在下方輸入框假裝自己是客人打字提問，確認 AI 有沒有正確套用知識庫、報價與升級規則。滿意的回答可以一鍵加入知識庫。
              </HelpTip>

              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                {/* 智慧草稿 toggle */}
                <button
                  onClick={() => setDraftMode(v => !v)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all ${
                    draftMode ? 'bg-violet-50 border-violet-300 text-violet-700 font-medium' : 'border-gray-200 text-gray-400 hover:text-gray-600'
                  }`}>
                  <Wand2 className="h-3 w-3" />
                  {t('u12.draftMode')}{draftMode ? t('u12.on') : t('u12.off')}
                </button>
                {/* 對話摘要 */}
                {testHistory.length > 1 && (
                  <button onClick={summarizeConversation} disabled={summarizing}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-50">
                    {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                    {t('u12.summary')}
                  </button>
                )}
                {/* 建立工單 */}
                {testHistory.length > 0 && (
                  <button onClick={createTicketFromConversation} disabled={creatingTicket}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-orange-600 hover:border-orange-300 disabled:opacity-50">
                    {creatingTicket ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                    {t('u12.createTicket')}
                  </button>
                )}
                {/* 結案 */}
                {testHistory.length > 0 && !caseClosed && (
                  <button onClick={closeCase}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300">
                    <ThumbsUp className="h-3 w-3" />
                    {t('u12.closeCase')}
                  </button>
                )}
                {/* 清除 */}
                {testHistory.length > 0 && (
                  <button onClick={() => { setTestHistory([]); setSummary(''); setCaseClosed(false); setDraftText(''); setDraftMeta(null) }}
                    className="text-[10px] text-gray-400 hover:text-gray-600">
                    {t('u12.clear')}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-white">
              {testHistory.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-10">
                  {t('u12.testEmptyHint')}
                </div>
              )}
              {testHistory.map((msg, i) => {
                const churn = msg.role === 'assistant' && isChurnWarning(msg.meta)
                const isVip = msg.role === 'user' && vipNames.length > 0 && isVipMessage(msg.content)
                return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* VIP 識別 */}
                      {isVip && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium px-1">
                          <Star className="h-3 w-3" />
                          {t('u12.vipPriority')}
                        </div>
                      )}
                      {/* 流失預警 */}
                      {churn && (
                        <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium px-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('u12.churnWarning')}
                        </div>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'text-white rounded-tr-sm'
                          : churn
                            ? 'bg-red-50 border border-red-200 text-gray-800 rounded-tl-sm'
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
                        style={msg.role === 'user' ? { background: 'var(--primary)' } : {}}>
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      </div>
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1">
                          {msg.images.map((imgUrl, idx) => {
                            const isImage = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)(\?.*)?$/i.test(imgUrl)
                            return isImage ? (
                              <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imgUrl}
                                  alt=""
                                  className="max-w-full rounded-xl border border-gray-200 shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                                  style={{ maxHeight: 200 }}
                                />
                              </a>
                            ) : (
                              <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 underline hover:text-blue-800 break-all">
                                🔗 {imgUrl}
                              </a>
                            )
                          })}
                        </div>
                      )}
                      {msg.role === 'assistant' && msg.meta && (
                        <div className="flex items-center gap-1.5 px-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(msg.meta.risk ?? 'low')}`}>
                            {msg.meta.risk === 'high' ? t('u12.riskHigh') : msg.meta.risk === 'medium' ? t('u12.riskMedium') : t('u12.riskLow')}
                          </span>
                          <span className="text-[10px] text-gray-400">{msg.meta.intent}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className={`text-[10px] font-medium ${msg.meta.provider === 'Claude' ? 'text-orange-500' : 'text-blue-500'}`}>
                            {msg.meta.provider}
                          </span>
                          <button
                            onClick={() => {
                              const prevUser = [...testHistory].slice(0, i).reverse().find(m => m.role === 'user')
                              setFaqDialog({ open: true, q: prevUser?.content ?? '', a: msg.content, keywords: '', saving: false })
                            }}
                            className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1">
                            📚 {t('u12.addToKb')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                    <span className="text-xs text-gray-400">{draftMode ? t('u12.aiDrafting') : t('u12.aiThinking')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 智慧草稿 panel */}
            {draftMode && draftText && (
              <div className="border-t bg-violet-50 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs font-medium text-violet-700">{t('u12.smartDraft')}</span>
                  {draftMeta && (
                    <>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(draftMeta.risk ?? 'low')}`}>
                        {draftMeta.risk === 'high' ? t('u12.riskHigh') : draftMeta.risk === 'medium' ? t('u12.riskMedium') : t('u12.riskLow')}
                      </span>
                      <span className="text-[10px] text-gray-500">{draftMeta.intent}</span>
                    </>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">{t('u12.draftFor', { msg: draftUserMsg })}</span>
                </div>
                <textarea
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  rows={4}
                  className="w-full text-sm border border-violet-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={adoptDraft}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ background: 'var(--primary)' }}>
                    {t('u12.adoptSend')}
                  </button>
                  <button onClick={discardDraft}
                    className="px-4 py-1.5 rounded-lg text-xs bg-gray-200 text-gray-600">
                    {t('u12.discard')}
                  </button>
                </div>
              </div>
            )}

            {/* Image preview */}
            {testImage && (
              <div className="border-t px-3 pt-2 bg-gray-50 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={testImage.preview} alt="preview" className="h-14 w-14 object-cover rounded-lg border" />
                <span className="text-xs text-gray-500 flex-1">{t('u12.imageSelected')}</span>
                <button onClick={() => setTestImage(null)} className="text-xs text-red-400 hover:text-red-600">{t('u12.remove')}</button>
              </div>
            )}

            {/* Input */}
            <div className="border-t px-3 py-2.5 flex gap-2 bg-gray-50 items-center">
              {/* Image upload button */}
              <label className="cursor-pointer p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0" title={t('u12.uploadImage')}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => {
                    const dataUrl = ev.target?.result as string
                    const base64 = dataUrl.split(',')[1]
                    setTestImage({ base64, mimeType: file.type, preview: dataUrl })
                  }
                  reader.readAsDataURL(file)
                  e.target.value = ''
                }} />
              </label>
              <input
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTestMessage() } }}
                placeholder={draftMode ? '輸入客戶訊息… AI 將生成可編輯草稿' : '輸入客戶訊息或上傳圖片… (Enter 送出)'}
                className="flex-1 text-sm border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={testLoading}
              />
              <button onClick={sendTestMessage} disabled={testLoading || (!testInput.trim() && !testImage)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 shrink-0"
                style={{ background: 'var(--primary)' }}>
                {t('u12.send')}
              </button>
            </div>
          </div>

          {/* 自動結案倒數 */}
          {caseClosed && autoCloseSecondsLeft !== null && (
            <div className="border border-green-200 rounded-xl bg-green-50 px-4 py-2.5 flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700 font-medium">{t('u12.autoCloseCountdown')}</span>
              <span className="text-xs text-green-600 ml-auto">
                {t('u12.autoCloseIn', { time: `${Math.floor(autoCloseSecondsLeft / 60)}:${String(autoCloseSecondsLeft % 60).padStart(2, '0')}` })}
              </span>
            </div>
          )}
          {caseClosed && autoCloseSecondsLeft === null && autoCloseMinutes > 0 && (
            <div className="border border-gray-200 rounded-xl bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
              {t('u12.caseAutoClosed')}
            </div>
          )}

          {/* 對話摘要結果 */}
          {summary && (
            <div className="border border-indigo-200 rounded-xl bg-indigo-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700">{t('u12.convSummary')}</span>
                <button onClick={() => setSummary('')} className="ml-auto text-[10px] text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{summary}</pre>
            </div>
          )}

          {/* Quick test phrases */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500 font-medium">{t('u12.quickPhrases')}</div>
            <div className="flex flex-wrap gap-2">
              {(INDUSTRY_TEST_PHRASES[ind] ?? INDUSTRY_TEST_PHRASES.homestay).map(phrase => (
                <button key={phrase} onClick={() => { setTestInput(phrase); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ 知識庫管理（data-sources tab 內） ──────────────────────────────── */}
      {tab === 'data-sources' && csFeatures?.dataSources && (
        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">📚 {t('u12.autoLearnFaq')}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t('u12.autoLearnFaqHint')}</div>
            </div>
            <button
              onClick={() => setFaqDialog({ open: true, q: '', a: '', keywords: '', saving: false })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" />{t('u12.manualAdd')}
            </button>
          </div>
          {faqItems.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8 border rounded-xl border-dashed">
              {t('u12.noFaqRecords')}
            </div>
          ) : (
            <div className="space-y-2">
              {faqItems.map(item => (
                <div key={item.id} className="border rounded-xl p-3 bg-emerald-50/40 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-gray-800">Q: {item.q}</div>
                    <button
                      onClick={async () => {
                        await fetch(`/api/marketing/cs-faq?industry=${industry}&itemId=${item.id}`, { method: 'DELETE' })
                        setFaqItems(prev => prev.filter(f => f.id !== item.id))
                      }}
                      className="text-[10px] text-red-400 hover:text-red-600 shrink-0">{t('u12.delete')}</button>
                  </div>
                  <div className="text-xs text-gray-600 border-l-2 border-emerald-300 pl-2">A: {item.a.slice(0, 120)}{item.a.length > 120 ? '…' : ''}</div>
                  <div className="flex flex-wrap gap-1">
                    {item.keywords?.map(kw => (
                      <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{kw}</span>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString(locale)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Logs ───────────────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <span>回答量、風險分布、回應速度與熱門問題統計，幫你了解客服狀況、找出還要補強知識庫的地方。</span>
            <HelpTip title="紀錄與報表怎麼看？" href="/cs/help#logs">
              「熱點問題」代表最多客人問但知識庫可能還沒涵蓋好的內容，可以優先補進「知識庫」分頁。
            </HelpTip>
          </p>
          {/* ── 客服績效報表 ── */}
          {logs.length > 0 && (() => {
            const total = logs.length
            const highRisk = logs.filter(l => l.risk === 'high').length
            const medRisk = logs.filter(l => l.risk === 'medium').length
            const lowRisk = logs.filter(l => l.risk === 'low').length
            const avgLatency = Math.round(logs.reduce((s, l) => s + (l.latencyMs ?? 0), 0) / total)
            const claudeCount = logs.filter(l => l.provider === 'Claude').length
            const geminiCount = logs.filter(l => l.provider === 'Gemini').length

            // 熱點問題統計
            const intentMap: Record<string, number> = {}
            logs.forEach(l => {
              if (l.intent) intentMap[l.intent] = (intentMap[l.intent] ?? 0) + 1
            })
            const topIntents = Object.entries(intentMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

            return (
              <div className="space-y-3">
                {/* 績效卡片 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-800">{total}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('u12.totalConv')}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-800">{avgLatency}<span className="text-xs text-gray-400 ml-0.5">ms</span></div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('u12.avgSpeed')}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-red-500">{highRisk}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('u12.highRiskConv')}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-orange-500">{claudeCount}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('u12.claudeEscalated')}</div>
                  </div>
                </div>

                {/* 風險分佈 */}
                <div className="bg-white border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PieChart className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">{t('u12.riskDist')}</span>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                    {highRisk > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(highRisk/total)*100}%` }} />}
                    {medRisk > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(medRisk/total)*100}%` }} />}
                    {lowRisk > 0 && <div className="bg-green-400 transition-all" style={{ width: `${(lowRisk/total)*100}%` }} />}
                  </div>
                  <div className="flex gap-4 text-[10px] text-gray-500">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />{t('u12.riskHigh')} {highRisk}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />{t('u12.riskMedium')} {medRisk}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />{t('u12.riskLow')} {lowRisk}</span>
                    <span className="ml-auto"><span className="text-orange-500 font-medium">Claude</span> {claudeCount} · <span className="text-blue-500 font-medium">Gemini</span> {geminiCount}</span>
                  </div>
                </div>

                {/* 熱點問題統計 */}
                {topIntents.length > 0 && (
                  <div className="bg-white border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">{t('u12.hotIntents')}</span>
                    </div>
                    <div className="space-y-1.5">
                      {topIntents.map(([intent, count]) => (
                        <div key={intent} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-600 flex-1 truncate">{intent}</span>
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 rounded-full bg-indigo-200" style={{ width: `${Math.max(12, (count/total)*80)}px` }} />
                            <span className="text-[10px] text-gray-400 w-5 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 情緒趨勢圖 */}
                {(() => {
                  // Group logs by date (last 7 days)
                  const dayMap: Record<string, { high: number; medium: number; low: number; total: number }> = {}
                  const now = new Date()
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date(now); d.setDate(d.getDate() - i)
                    const key = d.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })
                    dayMap[key] = { high: 0, medium: 0, low: 0, total: 0 }
                  }
                  logs.forEach(l => {
                    const key = new Date(l.ts).toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })
                    if (dayMap[key]) {
                      dayMap[key].total++
                      if (l.risk === 'high') dayMap[key].high++
                      else if (l.risk === 'medium') dayMap[key].medium++
                      else dayMap[key].low++
                    }
                  })
                  const days = Object.entries(dayMap)
                  const maxTotal = Math.max(...days.map(([, v]) => v.total), 1)
                  return (
                    <div className="bg-white border rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-xs font-semibold text-gray-700">{t('u12.sentimentTrend')}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 ml-auto">{t('u12.live')}</span>
                      </div>
                      <div className="flex items-end gap-1.5 h-20">
                        {days.map(([date, v]) => (
                          <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full flex flex-col justify-end gap-0" style={{ height: '60px' }}>
                              {v.total > 0 ? (
                                <div className="w-full rounded-sm overflow-hidden flex flex-col justify-end gap-px"
                                  style={{ height: `${Math.round((v.total / maxTotal) * 60)}px` }}>
                                  {v.high > 0 && <div className="bg-red-400 w-full" style={{ height: `${Math.round((v.high/v.total)*100)}%`, minHeight: '2px' }} />}
                                  {v.medium > 0 && <div className="bg-amber-400 w-full" style={{ height: `${Math.round((v.medium/v.total)*100)}%`, minHeight: '2px' }} />}
                                  {v.low > 0 && <div className="bg-green-400 w-full" style={{ height: `${Math.round((v.low/v.total)*100)}%`, minHeight: '2px' }} />}
                                </div>
                              ) : (
                                <div className="w-full bg-gray-100 rounded-sm" style={{ height: '4px' }} />
                              )}
                            </div>
                            <span className="text-[9px] text-gray-400">{date}</span>
                            {v.total > 0 && <span className="text-[9px] text-gray-500 font-medium">{v.total}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{t('u12.convLog')}</span>
            <span className="text-xs text-gray-400">{t('u12.nRecords', { n: logs.length })}</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">{t('u12.noConvLog')}</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="border rounded-xl p-3 space-y-1.5 bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(log.risk)}`}>
                      {log.risk === 'high' ? t('u12.riskHigh') : log.risk === 'medium' ? t('u12.riskMedium') : t('u12.riskLow')}
                    </span>
                    <span className="text-[10px] text-gray-500">{log.intent}</span>
                    <span className={`text-[10px] font-medium ${log.provider === 'Claude' ? 'text-orange-500' : 'text-blue-500'}`}>
                      {log.provider}
                    </span>
                    <span className="text-[10px] text-gray-400">{log.latencyMs}ms</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{new Date(log.ts).toLocaleString(locale)}</span>
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium text-gray-500">{t('u12.customerLabel')}</span>{log.message}
                  </div>
                  <div className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-2">
                    <span className="font-medium text-indigo-500">{t('u12.aiLabel')}</span>{log.reply.slice(0, 120)}{log.reply.length > 120 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tickets ──────────────────────────────────────────────────────── */}
      {tab === 'tickets' && (csFeatures && !csFeatures.tickets ? renderLockedUpgrade('工單系統') : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{t('u12.ticketSystem')}</span>
            <HelpTip title="工單系統怎麼用？" href="/cs/help#tickets">
              客人要求真人協助、或 AI 判斷需要升級處理時會自動建立工單，在這裡追蹤處理進度即可，不用另外開表格記錄。
            </HelpTip>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
                <button key={s} onClick={() => setTicketFilter(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    ticketFilter === s ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  style={ticketFilter === s ? { background: 'var(--primary)' } : {}}>
                  {s === 'all' ? t('u12.filterAll') : ticketStatusLabel(s)}
                  {s !== 'all' && ` (${tickets.filter(t => t.status === s).length})`}
                </button>
              ))}
              <button onClick={loadTickets} disabled={ticketsLoading}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                {ticketsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t('u12.ticketTip')}
          </div>

          {ticketsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : tickets.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">{t('u12.noTickets')}</div>
          ) : (
            <div className="space-y-2">
              {tickets
                .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                .map(ticket => (
                  <div key={ticket.id} className="border rounded-xl p-3 bg-white space-y-2 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ticketStatusColor(ticket.status)}`}>
                        {ticketStatusLabel(ticket.status)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ticketPriorityColor(ticket.priority)}`}>
                        {t('u12.priorityLabel', { p: ticketPriorityLabel(ticket.priority) })}
                      </span>
                      <span className="text-[10px] text-gray-500">{platformEmoji(ticket.platform)} {ticket.platform}</span>
                      {ticket.intent && <span className="text-[10px] text-gray-400">{ticket.intent}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(ticket.created_at).toLocaleString(locale)}</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-800">{ticket.subject}</div>
                    <div className="text-[11px] text-gray-500 line-clamp-2">{ticket.description.slice(0, 120)}{ticket.description.length > 120 ? '…' : ''}</div>
                    <div className="flex gap-1.5 pt-1 flex-wrap items-center">
                      {(['open', 'in_progress', 'resolved', 'closed'] as const).filter(s => s !== ticket.status).map(s => (
                        <button key={s} onClick={async () => {
                          const res = await fetch(`/api/marketing/cs-tickets/${ticket.id}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: s }),
                          })
                          const d = await res.json()
                          if (d.ticket) setTickets(prev => prev.map(t => t.id === ticket.id ? d.ticket : t))
                        }}
                          className="text-[10px] px-2 py-0.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          → {ticketStatusLabel(s)}
                        </button>
                      ))}
                      <button
                        onClick={() => setFaqDialog({ open: true, q: ticket.subject || ticket.description.slice(0, 80), a: '', keywords: '', saving: false })}
                        className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1">
                        📚 {t('u12.addToKb')}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      {/* ── Tab: Inbox ────────────────────────────────────────────────────────── */}
      {tab === 'inbox' && (csFeatures && !csFeatures.inbox ? renderLockedUpgrade('統一收件匣') : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{t('u12.unifiedInbox')}</span>
            <HelpTip title="統一收件匣怎麼用？" href="/cs/help#inbox">
              所有平台的對話都集中在這裡，可以直接回覆客人，也能切換「AI 自動回覆」或「真人接管」。也可以安裝成手機 App，方便隨時查看。
            </HelpTip>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {['all', 'line', 'whatsapp', 'telegram', 'test'].map(p => (
                <button key={p} onClick={() => { setInboxPlatformFilter(p); }}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    inboxPlatformFilter === p ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  style={inboxPlatformFilter === p ? { background: 'var(--primary)' } : {}}>
                  {p === 'all' ? t('u12.filterAll') : `${platformEmoji(p)} ${p.toUpperCase()}`}
                </button>
              ))}
              <button onClick={loadInbox} disabled={inboxLoading}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                {inboxLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
            <div className="font-medium">{t('u12.sourceNote')}</div>
            <div>• {t('u12.sourceTest')}</div>
            <div>• {t('u12.sourcePlatforms')}</div>
          </div>

          {inboxLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : inboxMessages.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">
              <div className="mb-2">{t('u12.noInbox')}</div>
              <div className="text-[11px]">{t('u12.noInboxHint')}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {inboxMessages
                .filter(m => inboxPlatformFilter === 'all' || m.platform === inboxPlatformFilter)
                .map(msg => (
                  <div key={msg.id} className="border rounded-xl p-3 bg-white space-y-1.5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-700">
                        {platformEmoji(msg.platform)} {msg.from_name ?? msg.from_id}
                      </span>
                      {msg.risk && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(msg.risk)}`}>
                          {msg.risk === 'high' ? t('u12.riskHigh') : msg.risk === 'medium' ? t('u12.riskMedium') : t('u12.riskLow')}
                        </span>
                      )}
                      {msg.intent && <span className="text-[10px] text-gray-400">{msg.intent}</span>}
                      {msg.latency_ms && <span className="text-[10px] text-gray-300">{msg.latency_ms}ms</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(msg.created_at).toLocaleString(locale)}</span>
                    </div>
                    <div className="text-xs text-gray-700">
                      <span className="font-medium text-gray-500">{t('u12.customerLabel')}</span>{msg.message}
                    </div>
                    {msg.reply && (
                      <div className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-2">
                        <span className="font-medium text-indigo-500">{t('u12.aiLabel')}</span>{msg.reply.slice(0, 120)}{msg.reply.length > 120 ? '…' : ''}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      {/* ── 報名表單 Modal ── */}
      {bookingFormOpen && bookingFormConfig && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setBookingFormOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-gray-800">{t('u12.bookingFormTitle')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{bookingFormConfig.packageName}</p>
              </div>
              <button onClick={() => setBookingFormOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* 參加人員 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">{t('u12.participants')}</label>
                <div className="flex gap-1.5">
                  <button onClick={() => setBookingParticipants(p => [...p, { name: '', birthday: '', idNumber: '' }])}
                    className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                    + {t('u12.add')}
                  </button>
                  {bookingParticipants.length > 1 && (
                    <button onClick={() => setBookingParticipants(p => p.slice(0, -1))}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                      − {t('u12.remove')}
                    </button>
                  )}
                </div>
              </div>
              {bookingParticipants.map((p, i) => {
                const age = calcParticipantAge(p.birthday)
                const cat = age >= 0 ? getAgeCategory(age) : null
                const isInfant = cat === '幼兒'
                const catColor = cat === '成人' ? 'bg-blue-100 text-blue-700' : cat === '小孩' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                const catText = cat === '成人' ? t('u12.ageAdult') : cat === '小孩' ? t('u12.ageChild') : t('u12.ageInfant')
                return (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 w-4">{i + 1}.</span>
                      {cat && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catColor}`}>{catText}{age >= 0 ? t('u12.ageYears', { age }) : ''}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500">{t('u12.pName')} <span className="text-red-500">*</span></label>
                        <input value={p.name} onChange={e => setBookingParticipants(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          placeholder="王小明"
                          className="w-full mt-0.5 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">{t('u12.pBirthday')} <span className="text-red-500">*</span></label>
                        <input type="date" value={p.birthday} onChange={e => setBookingParticipants(prev => prev.map((x, j) => j === i ? { ...x, birthday: e.target.value } : x))}
                          className="w-full mt-0.5 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                      </div>
                    </div>
                    {bookingFormConfig.requirePassengerId && !isInfant && (
                      <div>
                        <label className="text-[10px] text-gray-500">{t('u12.pIdNumber')} <span className="text-red-500">*</span></label>
                        <input value={p.idNumber} onChange={e => setBookingParticipants(prev => prev.map((x, j) => j === i ? { ...x, idNumber: e.target.value.toUpperCase() } : x))}
                          placeholder="A123456789"
                          className="w-full mt-0.5 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-mono" />
                      </div>
                    )}
                    {isInfant && <p className="text-[10px] text-orange-600">{t('u12.infantExempt')}</p>}
                  </div>
                )
              })}
            </div>

            {/* 聯絡電話 */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">{t('u12.contactPhone')} <span className="text-red-500">*</span></label>
              <p className="text-[10px] text-gray-400">{t('u12.contactPhoneHint')}</p>
              <input value={bookingContactPhone} onChange={e => setBookingContactPhone(e.target.value)}
                placeholder="0912-345-678"
                type="tel"
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBookingFormOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">{t('u12.cancel')}</button>
              <button
                disabled={bookingSubmitting || bookingParticipants.some(p => !p.name.trim() || !p.birthday) || !bookingContactPhone.trim()}
                onClick={async () => {
                  setBookingSubmitting(true)
                  try {
                    await fetch('/api/marketing/booking-submit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        packageName: bookingFormConfig.packageName,
                        participants: bookingParticipants,
                        contactPhone: bookingContactPhone,
                        notifyWebhooks,
                        campaignId,
                      }),
                    })
                    setBookingFormOpen(false)
                    setTestHistory(prev => [...prev, {
                      role: 'assistant',
                      content: t('u12.bookingThanks'),
                    }])
                  } finally {
                    setBookingSubmitting(false)
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {bookingSubmitting ? t('u12.submitting2') : t('u12.confirmSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ 加入知識庫 Dialog ───────────────────────────────────────────────── */}
      {faqDialog.open && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setFaqDialog(p => ({ ...p, open: false })) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="font-bold text-gray-900">📚 {t('u12.addToKb')}</div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('u12.faqQ')}</label>
              <textarea rows={2} value={faqDialog.q}
                onChange={e => setFaqDialog(p => ({ ...p, q: e.target.value }))}
                placeholder={t('u12.faqQPh')}
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('u12.faqA')}<span className="text-red-500 ml-0.5">*</span></label>
              <textarea rows={4} value={faqDialog.a}
                onChange={e => setFaqDialog(p => ({ ...p, a: e.target.value }))}
                placeholder={t('u12.faqAPh')}
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('u12.faqKw')}</label>
              <input value={faqDialog.keywords}
                onChange={e => setFaqDialog(p => ({ ...p, keywords: e.target.value }))}
                placeholder={t('u12.faqKwPh')}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFaqDialog(p => ({ ...p, open: false }))}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('u12.cancel')}</button>
              <button
                disabled={!faqDialog.a.trim() || faqDialog.saving}
                onClick={async () => {
                  setFaqDialog(p => ({ ...p, saving: true }))
                  const keywords = faqDialog.keywords.trim()
                    ? faqDialog.keywords.split(',').map(k => k.trim()).filter(Boolean)
                    : []
                  const res = await fetch('/api/marketing/cs-faq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      q: faqDialog.q, a: faqDialog.a, keywords,
                      industry, autoSuggest: keywords.length === 0,
                      context: faqDialog.q,
                    }),
                  })
                  const d = await res.json()
                  if (d.item) {
                    setFaqItems(prev => [...prev, d.item])
                    setFaqDialog({ open: false, q: '', a: '', keywords: '', saving: false })
                  } else {
                    setFaqDialog(p => ({ ...p, saving: false }))
                  }
                }}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {faqDialog.saving ? <><Loader2 className="h-4 w-4 animate-spin" />{t('u12.aiAnalyzing')}</> : t('u12.saveToKb')}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
    </>
  )
}

// ─── CS workspace wrapper：取代原本 marketing-auto?module=cs 的 csMode 分支 ────
// 只保留 CS 需要的 campaign 讀寫邏輯（每個產業各自獨立一筆 campaign）。

export function CsWorkspace({ industry }: { industry?: string }) {
  const t = useTranslations('MA')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [unit12Data, setUnit12Data] = useState<Unit12Data | undefined>(undefined)
  const [companyData, setCompanyData] = useState<Unit2Data>({})
  const [loaded, setLoaded] = useState(false)

  // 共用公司資料（Unit 2），全站共用，非各 campaign 獨立
  useEffect(() => {
    fetch('/api/marketing/company-data')
      .then(r => r.json())
      .then(d => { if (d.data) setCompanyData(d.data) })
      .catch(() => {})
  }, [])

  // 每個產業各自獨立一筆 campaign，用 localStorage 記住上次使用的 campaign id
  useEffect(() => {
    const run = async () => {
      const storageKey = industry ? `aigate_cs_campaign_${industry}` : 'aigate_cs_campaign'
      const savedId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null

      if (savedId) {
        try {
          const r = await fetch(`/api/marketing/campaign/${savedId}`)
          if (r.ok) {
            const c = (await r.json()).campaign
            if (c) {
              setCampaignId(c.id)
              setUnit12Data(c.unit_data?.[12] as Unit12Data | undefined)
            }
          }
        } catch { /* ignore, 開新的即可 */ }
      }
      setLoaded(true)
    }
    run()
  }, [industry])

  const ensureCampaign = useCallback(async (): Promise<string | null> => {
    if (campaignId) return campaignId
    const indLabel = industry ? (t.has(`u12.industry.${industry}`) ? t(`u12.industry.${industry}`) : (CS_INDUSTRY_TEMPLATES[industry]?.label ?? industry)) : ''
    const title = t('mp.csConfigTitle', { name: indLabel })
    const res = await fetch('/api/marketing/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, ...(industry ? { industry } : {}) }),
    })
    const data = await res.json()
    if (data.id) {
      setCampaignId(data.id)
      const storageKey = industry ? `aigate_cs_campaign_${industry}` : 'aigate_cs_campaign'
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, data.id)
      return data.id as string
    }
    return null
  }, [campaignId, industry, t])

  const handleDone = useCallback(async (data: Unit12Data) => {
    const cid = await ensureCampaign()
    if (!cid) return
    setUnit12Data(data)
    await patchCampaign(cid, { unit_data: { 12: data } })
  }, [ensureCampaign])

  if (!loaded) return <div className="h-[calc(100vh-53px)] bg-white" />

  return (
    <div className="h-[calc(100vh-53px)] overflow-y-auto bg-white">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur border-b">
        <a href="/cs" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          {t('mp.backToCs')}
        </a>
      </div>
      <Unit12CustomerService
        campaignId={campaignId}
        savedData={unit12Data}
        unit2Data={companyData}
        industry={industry}
        onDone={handleDone}
      />
    </div>
  )
}
