'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  BarChart3, Upload, Headphones, Plus, Loader2, CheckCircle2, RefreshCw, Star,
  FileText, X, Sparkles, Wand2, Zap, TrendingUp, Check, AlertTriangle,
  ClipboardList, PieChart, Clock as ClockIcon, ThumbsUp, Lock,
  MessageSquare, BookOpen, Database, Calculator, FlaskConical, Ticket, Inbox, Send, ShieldCheck, Phone,
  PanelLeftClose, PanelLeftOpen, UserRound, Image as ImageIcon, Tag, Gift, LayoutDashboard, Info,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HelpTip } from '@/components/cs/HelpTip'
import { CsSupportPanel } from './CsSupportPanel'
import { CsFormsPanel } from './CsFormsPanel'
import { CsCorrectionsPanel } from './CsCorrectionsPanel'
import type { CsPlanFeatures } from '@/lib/cs/entitlements'

function formatCustomerName(name: string | null | undefined, fromId: string, t: (key: string, values?: Record<string, string | number | Date>) => string): string {
  if (name && name.trim()) return name.trim()
  if (fromId.startsWith('U') && fromId.length === 33) {
    return t('lineCustomerLabel', { id: fromId.slice(1, 6) })
  }
  return fromId || t('unknownCustomer')
}

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
  tourName?: string
  packageName?: string
  flowId?: string
  date?: string
  timeslot?: string
  headcount?: number
  requirePassengerId?: boolean
  callbackUrl?: string
}

function calcAge(birthday: string): number {
  if (!birthday) return 0
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

// ── 定價計算機：欄位式編輯共用元件 ──────────────────────────────────────────
// 定義在元件外層（module scope），避免每次 CsWorkspace re-render 都產生新的
// component 型別造成 input 重新掛載、打字時失焦。
interface PcConfig {
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
  [key: string]: unknown
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 items-center border rounded-lg px-2 py-1.5 bg-white focus-within:ring-1 focus-within:ring-indigo-400">
      {value.map((tag, idx) => (
        <span key={idx} className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((_, i) => i !== idx))} className="hover:text-red-500">✕</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        className="flex-1 min-w-[80px] text-xs outline-none py-0.5"
      />
    </div>
  )
}

function StringListEditor({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((it, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            type="text" value={it} placeholder={placeholder}
            onChange={e => onChange(items.map((v, i) => i === idx ? e.target.value : v))}
            className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button type="button" onClick={() => onChange(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="text-[11px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">+ {addLabel}</button>
    </div>
  )
}

interface RowFieldDef { key: string; label: string; type: 'text' | 'number'; width?: string }

function RowsEditor({ rows, fields, onChange, addLabel }: {
  rows: Array<Record<string, unknown>>
  fields: RowFieldDef[]
  onChange: (rows: Array<Record<string, unknown>>) => void
  addLabel: string
}) {
  const safeRows = Array.isArray(rows) ? rows : []
  const update = (idx: number, key: string, val: unknown) => onChange(safeRows.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  const remove = (idx: number) => onChange(safeRows.filter((_, i) => i !== idx))
  const add = () => {
    const blank: Record<string, unknown> = {}
    fields.forEach(f => { blank[f.key] = f.type === 'number' ? 0 : '' })
    onChange([...safeRows, blank])
  }
  return (
    <div className="space-y-1.5">
      {safeRows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-1.5 flex-wrap bg-white border rounded-lg p-1.5">
          {fields.map(f => (
            <div key={f.key} className="flex flex-col gap-0.5">
              <label className="text-[9px] text-gray-400">{f.label}</label>
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                value={(row[f.key] as string | number | undefined) ?? (f.type === 'number' ? 0 : '')}
                onChange={e => update(idx, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                className={`text-xs border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ${f.width ?? (f.type === 'number' ? 'w-20' : 'w-28')}`}
              />
            </div>
          ))}
          <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 text-xs px-1 self-end mb-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-[11px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">+ {addLabel}</button>
    </div>
  )
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
  from_id?: string
  from_name?: string
  intent?: string
  created_at: string
  updated_at: string
}

interface InboxConvo {
  platform: string
  from_id: string
  name: string | null
  stage?: string
  messageCount?: number
  lastMessageAt?: string
  takeover?: boolean
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

interface CsCampaignOffer {
  id: string
  name: string
  enabled: boolean
  offerType: 'nights_tiered' | 'percent' | 'fixed_amount' | 'custom'
  // 適用對象與資格說明（例：本國籍自由行旅客、出示身分證件／生日券）
  qualification: string
  // 連續住宿每晚折抵（例：第一晚 800，第二晚 1200）
  tieredNightDiscounts?: number[]
  // 折扣百分比（例：10 代表 9 折）
  discountPercent?: number
  // 單筆固定折扣金額（例：500）
  discountAmount?: number
  // 是否可與其他折扣／早鳥優惠疊加使用（預設 false 為不可疊加/二擇一）
  canStack?: boolean
  // 活動規則詳細說明與限制
  rulesNote: string
}

// 贈品/賠禮清單——同一份清單同時給兩種情境用：客人議價猶豫時（折扣或贈品擇一），
// 或客人已消費/入住後客訴、不滿意時（只能給贈品當賠禮，不能再打折）。用 situation
// 描述「什麼情況適合給這項」，AI 依當下情境自己挑最合適的一項，不用另外分兩份清單。
interface CsGiftItem {
  id: string
  name: string
  situation: string
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
  discountGifts?: CsGiftItem[]
  campaignOffers?: CsCampaignOffer[]
  campaignOfferSource?: 'cs' | 'booking' | 'both'
  contactPhone1?: string
  contactPhone2?: string
  aiSenderName?: string
  aiSenderIconUrl?: string
  humanSenderName?: string
  humanSenderIconUrl?: string
}

function getCsPlatforms(t: (key: string, values?: Record<string, string | number | Date>) => string) {
  return [
    {
      id: 'line',
      name: 'LINE OA',
      color: '#00B900',
      envVars: ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET'],
      note: t('platformNoteLine'),
      docUrl: 'https://developers.line.biz/en/docs/messaging-api/getting-started/',
      showWebhook: true,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      color: '#25D366',
      envVars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'],
      note: t('platformNoteWhatsapp'),
      docUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
      showWebhook: true,
    },
    {
      id: 'messenger',
      name: 'FB Messenger',
      color: '#0084FF',
      envVars: ['FB_PAGE_ACCESS_TOKEN', 'FB_VERIFY_TOKEN', 'FB_APP_SECRET'],
      note: t('platformNoteMessenger'),
      docUrl: 'https://developers.facebook.com/docs/messenger-platform/getting-started',
      showWebhook: true,
    },
    {
      id: 'instagram',
      name: 'Instagram Direct',
      color: '#E1306C',
      envVars: ['IG_ACCESS_TOKEN', 'IG_VERIFY_TOKEN', 'IG_APP_SECRET'],
      note: t('platformNoteInstagram'),
      docUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram',
      showWebhook: true,
    },
    {
      id: 'whatsapp_personal',
      name: t('platformNameWhatsappPersonal'),
      color: '#128C7E',
      envVars: ['WHATSAPP_PERSONAL_BRIDGE_URL', 'WHATSAPP_PERSONAL_API_KEY'],
      note: t('platformNoteWhatsappPersonal'),
      docUrl: 'https://github.com/WhiskeySockets/Baileys',
      showWebhook: false,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      color: '#2AABEE',
      envVars: ['TELEGRAM_BOT_TOKEN'],
      note: t('platformNoteTelegram'),
      docUrl: 'https://core.telegram.org/bots/tutorial',
      showWebhook: false,
    },
    {
      id: 'zalo',
      name: 'Zalo OA',
      color: '#0068FF',
      envVars: ['ZALO_OA_ACCESS_TOKEN'],
      note: t('platformNoteZalo'),
      docUrl: 'https://developers.zalo.me/docs/official-account',
      showWebhook: true,
    },
    {
      id: 'wechat',
      name: 'WeChat',
      color: '#07C160',
      envVars: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'],
      note: t('platformNoteWechat'),
      docUrl: 'https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html',
      showWebhook: true,
    },
  ]
}

type Cs12Tab = 'platforms' | 'campaign-offers' | 'pricing' | 'dialogue-files' | 'ai-settings' | 'data-sources' | 'forms' | 'logs' | 'tickets' | 'inbox' | 'corrections' | 'test'

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
  initialTab,
  onDone,
}: {
  campaignId: string | null
  savedData?: Unit12Data
  unit2Data?: Unit2Data
  industry?: string
  initialTab?: Cs12Tab
  onDone: (data: Unit12Data) => void
}) {
  const t = useTranslations('CsWorkspace')
  const locale = useLocale()
  const stepLabel = (s: BookingStep) => t(`step.${s}`)
  const industryLabel = (id: string) => t.has(`industry.${id}`) ? t(`industry.${id}`) : (CS_INDUSTRY_TEMPLATES[id]?.label ?? id)
  const csPlatforms = useMemo(() => getCsPlatforms(t), [t])
  const sheetT = (field: string, idx: number, fallback: string) => {
    if (!industry) return fallback
    const key = `recSheet_${industry}_${idx}_${field}`
    return t.has(key) ? t(key) : fallback
  }
  const [tab, setTab] = useState<Cs12Tab>(initialTab ?? 'platforms')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialTab === 'inbox')

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
      <p className="text-sm font-medium text-gray-700">{t('lockedFeatureLabel', { featureName })}</p>
      <p className="text-xs text-gray-400">{t('upgradeToUnlock')}</p>
      <a href="/cs/plan" className="inline-block text-xs text-primary font-medium hover:underline">{t('upgradePlanCta')} →</a>
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
  const [discountGifts, setDiscountGifts] = useState<CsGiftItem[]>(Array.isArray(savedData?.discountGifts) ? savedData.discountGifts : [])
  const [campaignOffers, setCampaignOffers] = useState<CsCampaignOffer[]>(savedData?.campaignOffers ?? [])
  const [campaignOfferSource, setCampaignOfferSource] = useState<'cs' | 'booking' | 'both'>(savedData?.campaignOfferSource ?? 'both')
  const [editingOffer, setEditingOffer] = useState<CsCampaignOffer | null>(null)
  const [contactPhone1, setContactPhone1] = useState(savedData?.contactPhone1 ?? '')
  const [contactPhone2, setContactPhone2] = useState(savedData?.contactPhone2 ?? '')
  const [aiSenderName, setAiSenderName] = useState(savedData?.aiSenderName ?? '')
  const [aiSenderIconUrl, setAiSenderIconUrl] = useState(savedData?.aiSenderIconUrl ?? '')
  const [humanSenderName, setHumanSenderName] = useState(savedData?.humanSenderName ?? '')
  const [humanSenderIconUrl, setHumanSenderIconUrl] = useState(savedData?.humanSenderIconUrl ?? '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingHumanAvatar, setUploadingHumanAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const humanAvatarInputRef = useRef<HTMLInputElement>(null)

  // Booking module activities (早鳥/晚鳥規則 + 促銷優惠碼)
  const [bookingRules, setBookingRules] = useState<Array<{ id: string; name: string; rule_type: string; enabled: boolean; adjustment_type: string; adjustment_value: number; can_stack?: boolean; conditions: Record<string, unknown> }>>([])
  const [bookingPromos, setBookingPromos] = useState<Array<{ id: string; code: string; name: string; type: string; value: number; min_nights: number; enabled: boolean; can_stack?: boolean }>>([])
  const [loadingBookingActivities, setLoadingBookingActivities] = useState(false)

  useEffect(() => {
    if (tab === 'campaign-offers') {
      setLoadingBookingActivities(true)
      Promise.all([
        fetch('/api/booking/pricing/rules').then(r => r.ok ? r.json() : { rules: [] }).catch(() => ({ rules: [] })),
        fetch('/api/booking/promos').then(r => r.ok ? r.json() : { promos: [] }).catch(() => ({ promos: [] })),
      ]).then(([rulesData, promosData]) => {
        setBookingRules(rulesData.rules ?? [])
        setBookingPromos(promosData.promos ?? [])
      }).finally(() => {
        setLoadingBookingActivities(false)
      })
    }
  }, [tab])

  // Dialogue files
  const [dialogueFiles, setDialogueFiles] = useState<CsDialogueFile[]>(savedData?.dialogueFiles ?? [])
  // Logs
  const [logs, setLogs] = useState<CsLogEntry[]>(savedData?.logs ?? [])

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
    if (Array.isArray(savedData.discountGifts)) setDiscountGifts(savedData.discountGifts)
    if (Array.isArray(savedData.campaignOffers)) setCampaignOffers(savedData.campaignOffers)
    if (savedData.campaignOfferSource) setCampaignOfferSource(savedData.campaignOfferSource)
    if (savedData.contactPhone1 !== undefined) setContactPhone1(savedData.contactPhone1)
    if (savedData.contactPhone2 !== undefined) setContactPhone2(savedData.contactPhone2)
    if (savedData.aiSenderName !== undefined) setAiSenderName(savedData.aiSenderName)
    if (savedData.aiSenderIconUrl !== undefined) setAiSenderIconUrl(savedData.aiSenderIconUrl)
    if (savedData.humanSenderName !== undefined) setHumanSenderName(savedData.humanSenderName)
    if (savedData.humanSenderIconUrl !== undefined) setHumanSenderIconUrl(savedData.humanSenderIconUrl)
    // Only restore files from DB if local state is empty (don't overwrite user's current session files)
    if (savedData.dialogueFiles?.length) setDialogueFiles(savedData.dialogueFiles)
  }, [savedData])

  const [savingSettings, setSavingSettings] = useState(false)

  const saveCurrentUnit12 = useCallback((overrides?: Partial<Unit12Data>) => {
    setSavingSettings(true)
    const filesToSave = dialogueFiles.length > 0 ? dialogueFiles : (savedData?.dialogueFiles ?? [])
    const data: Unit12Data = {
      systemPrompt,
      knowledgeBase,
      escalationThreshold,
      replyLanguage,
      logs,
      dialogueFiles: filesToSave,
      bookingFlowEnabled,
      paymentInfo,
      bookingFlows,
      vipList,
      autoCloseMinutes,
      notifyWebhooks,
      discountMaxPct,
      discountGifts,
      campaignOffers,
      campaignOfferSource,
      contactPhone1,
      contactPhone2,
      aiSenderName,
      aiSenderIconUrl,
      humanSenderName,
      humanSenderIconUrl,
      ...overrides,
    }
    onDone(data)
    setTimeout(() => setSavingSettings(false), 800)
    return data
  }, [
    dialogueFiles, savedData?.dialogueFiles, systemPrompt, knowledgeBase,
    escalationThreshold, replyLanguage, logs, bookingFlowEnabled, paymentInfo,
    bookingFlows, vipList, autoCloseMinutes, notifyWebhooks, discountMaxPct,
    discountGifts, campaignOffers, campaignOfferSource, contactPhone1, contactPhone2,
    aiSenderName, aiSenderIconUrl, humanSenderName, humanSenderIconUrl, onDone
  ])

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true)
    const form = new FormData()
    form.append('file', file)
    form.append('category', 'image')
    try {
      const res = await fetch('/api/marketing/upload-file', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.url) {
        setAiSenderIconUrl(data.url)
        saveCurrentUnit12({ aiSenderIconUrl: data.url })
      }
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleHumanAvatarUpload = async (file: File) => {
    setUploadingHumanAvatar(true)
    const form = new FormData()
    form.append('file', file)
    form.append('category', 'image')
    try {
      const res = await fetch('/api/marketing/upload-file', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.url) {
        setHumanSenderIconUrl(data.url)
        saveCurrentUnit12({ humanSenderIconUrl: data.url })
      }
    } finally {
      setUploadingHumanAvatar(false)
    }
  }

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
        saveCurrentUnit12({ dialogueFiles: newFiles })
      }
    } finally {
      setUploadingDialogue(false)
    }
  }

  const removeDialogueFile = (url: string) => {
    const newFiles = dialogueFiles.filter(f => f.url !== url)
    setDialogueFiles(newFiles)
    saveCurrentUnit12({ dialogueFiles: newFiles })
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
  const [inboxSearch, setInboxSearch] = useState('')
  const [inboxConvos, setInboxConvos] = useState<InboxConvo[]>([])
  const [activeConvo, setActiveConvo] = useState<InboxConvo | null>(null)
  const [threadBubbles, setThreadBubbles] = useState<Array<{ side: 'in' | 'out'; sender: 'customer' | 'ai' | 'agent'; text: string; at: string }>>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [inboxMessages, setInboxMessages] = useState<CsInboxMessage[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [inboxPlatformFilter, setInboxPlatformFilter] = useState<string>('all')
  const [inboxThreadKey, setInboxThreadKey] = useState<string | null>(null)
  const [inboxReplyText, setInboxReplyText] = useState('')
  const [inboxSending, setInboxSending] = useState(false)
  const [inboxSendError, setInboxSendError] = useState('')


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
  const [editingPc, setEditingPc] = useState<{ id: string; name: string; config: PcConfig } | null>(null)
  const [savingPc, setSavingPc] = useState(false)
  const [pcAdvancedOpen, setPcAdvancedOpen] = useState(false)
  const [pcAdvancedText, setPcAdvancedText] = useState('')
  const [pcJsonError, setPcJsonError] = useState('')
  const [dsFetchFailed, setDsFetchFailed] = useState(false)

  function updatePcConfig(patch: Partial<PcConfig>) {
    setEditingPc(prev => prev ? { ...prev, config: { ...prev.config, ...patch } } : prev)
  }

  // FAQ 知識庫
  interface FaqItem { id: string; q: string; a: string; keywords: string[]; created_at: string }
  const [faqItems, setFaqItems] = useState<FaqItem[]>([])
  const [faqDialog, setFaqDialog] = useState<{ open: boolean; id?: string; q: string; a: string; keywords: string; saving: boolean }>({
    open: false, q: '', a: '', keywords: '', saving: false,
  })
  const loadFaq = (ind: string) => {
    fetch(`/api/marketing/cs-faq?industry=${ind}`).then(r => r.json()).then(d => {
      if (d.items) setFaqItems(d.items)
    }).catch(() => {})
  }

  const [sourcePrefs, setSourcePrefs] = useState<{ priceSource: string; passwordSource: string; checkinTime: string }>({ priceSource: 'booking_system', passwordSource: 'booking_system', checkinTime: '' })
  const [savingPrefs, setSavingPrefs] = useState(false)

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
    setDsFetchFailed(false)
    fetch(`/api/marketing/cs-datasource?industry=${ind}`).then(r => r.json()).then(d => {
      if (d.sources) {
        setDataSources(d.sources.filter((s: { type: string }) => s.type !== 'json_pricing' && s.type !== 'breakfast_webhook' && s.type !== 'source_prefs'))
        setPricingConfigs(d.sources.filter((s: { type: string }) => s.type === 'json_pricing'))
      } else {
        setDsFetchFailed(true)
      }
    }).catch(() => setDsFetchFailed(true))
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
    const template = (templateKey && PRICING_TEMPLATES[templateKey] ? PRICING_TEMPLATES[templateKey] : PRICING_TEMPLATES.tour) as unknown as PcConfig
    setEditingPc({ id: '', name: '', config: JSON.parse(JSON.stringify(template)) })
    setPcAdvancedOpen(false)
    setPcJsonError('')
  }

  function openEditPc(pc: { id: string; name: string; config: Record<string, unknown> }) {
    setEditingPc({ id: pc.id, name: pc.name, config: pc.config as unknown as PcConfig })
    setPcAdvancedOpen(false)
    setPcJsonError('')
  }

  function applyPcAdvancedJson() {
    if (!editingPc) return
    try {
      const parsed = JSON.parse(pcAdvancedText)
      setEditingPc(prev => prev ? { ...prev, config: parsed } : prev)
      setPcJsonError('')
      setPcAdvancedOpen(false)
    } catch (e) {
      setPcJsonError(t('jsonError', { error: String(e) }))
    }
  }

  async function savePc() {
    if (!editingPc) return
    setSavingPc(true)
    try {
      if (editingPc.id) {
        const r = await fetch(`/api/marketing/cs-datasource/${editingPc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingPc.name, config: editingPc.config, enabled: true }),
        })
        const d = await r.json()
        if (d.source) setPricingConfigs(prev => prev.map(p => p.id === editingPc.id ? d.source : p))
      } else {
        const r = await fetch('/api/marketing/cs-datasource', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingPc.name, config: editingPc.config, type: 'json_pricing', industry: ind }),
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
        setTelegramSetupResult({ ok: false, msg: data.error ?? t('tgRegFailed') })
      } else {
        const tgOk = data.setResult?.ok === true
        const webhookSet = data.infoResult?.result?.url ?? ''
        setTelegramSetupResult({
          ok: tgOk,
          msg: tgOk ? t('tgRegOk') : t('tgReturned', { data: JSON.stringify(data.setResult) }),
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
      setTelegramTestResult({ ok, msg: ok ? t('tgTestSent') : `❌ ${JSON.stringify(data.result?.description ?? data)}` })
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
        { key: 'whatsapp_verify_token', label: t('cred.waVerify'), placeholder: 'my_verify_token', secret: false },
        { key: 'whatsapp_app_secret', label: t('cred.waSecret'), placeholder: t('cred.metaKey'), secret: true },
      ],
      messenger: [
        { key: 'fb_page_access_token', label: 'Page Access Token', placeholder: 'EAA...', secret: true },
        { key: 'fb_verify_token', label: t('cred.fbVerify'), placeholder: 'my_verify_token', secret: false },
        { key: 'fb_app_secret', label: t('cred.fbSecret'), placeholder: '...', secret: true },
      ],
      instagram: [
        { key: 'ig_access_token', label: t('cred.igAccessToken'), placeholder: 'EAA...', secret: true },
        { key: 'ig_verify_token', label: t('cred.fbVerify'), placeholder: 'my_verify_token', secret: false },
        { key: 'ig_app_secret', label: t('cred.fbSecret'), placeholder: '...', secret: true },
      ],
      whatsapp_personal: [],  // QR-based auth, no manual fields needed
      telegram: [
        { key: 'telegram_bot_token', label: t('cred.tgToken'), placeholder: '123456789:AAF...', secret: true },
        { key: 'telegram_admin_chat_id', label: t('cred.tgAdmin'), placeholder: t('cred.tgAdminPh'), secret: false },
        { key: 'telegram_webhook_secret', label: t('cred.tgSecret'), placeholder: t('cred.anyString'), secret: true },
      ],
      zalo: [
        { key: 'zalo_oa_access_token', label: 'OA Access Token', placeholder: '...', secret: true },
      ],
      wechat: [
        { key: 'wechat_app_id', label: 'App ID', placeholder: 'wx...', secret: false },
        { key: 'wechat_app_secret', label: 'App Secret', placeholder: '...', secret: true },
        { key: 'wechat_token', label: t('cred.wechatToken'), placeholder: t('cred.anyString'), secret: false },
      ],
    }
    return map[platformId] ?? []
  }

  function saveSettings() {
    saveCurrentUnit12()
  }

  async function sendTestMessage() {
    if (!testInput.trim() && !testImage) return
    const userMsg = testInput.trim()
    const imgSnap = testImage
    setTestInput('')
    setTestImage(null)
    const userDisplay = userMsg + (imgSnap ? `\n🖼️ ${t('imageTag')}` : '')
    setTestHistory(prev => [...prev, { role: 'user', content: userDisplay }])
    setTestLoading(true)

    try {
      // Dialogue files (CS-specific, highest priority) → Unit 2 company FAQ files (fallback)
      const dialogueTexts = (dialogueFiles)
        .filter(f => f.textContent)
        .map(f => `${t('kbFileLabel', { name: f.name })}\n${f.textContent}`)
        .join('\n\n')
      const faqTexts = (unit2Data?.files ?? [])
        .filter(f => f.textContent)
        .map(f => `${t('companyFileLabel', { name: f.name })}\n${f.textContent}`)
        .join('\n\n')
      const directText = knowledgeBase.trim() ? `${t('directKnowledgeLabel')}\n${knowledgeBase}` : ''
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
          campaignOffers,
          campaignOfferSource,
          ...(imgSnap ? { imageBase64: imgSnap.base64, imageMimeType: imgSnap.mimeType } : {}),
        }),
      })
      const raw = await res.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: Record<string, any> = {}
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error(raw.slice(0, 200) || t('serverError', { status: res.status }))
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
            Array.from({ length: Math.max(1, Number(cfg.headcount) || 1) }, () => ({ name: '', birthday: '', idNumber: '' }))
          )
          setBookingContactPhone('')
          setBookingFormOpen(true)
        }
        const updatedLogs = [newEntry, ...logs].slice(0, 100)
        setLogs(updatedLogs)
        saveCurrentUnit12({ logs: updatedLogs })
        // 保存到統一收件匣
        saveTestMessageToInbox(userMsg, data.reply, data.intent, data.risk, data.latencyMs)
      } else {
        setTestHistory(prev => [...prev, { role: 'assistant', content: t('errorMsg', { error: data.error ?? t('unknownError') }) }])
      }
    } catch (e) {
      setTestHistory(prev => [...prev, { role: 'assistant', content: t('connError', { error: String(e) }) }])
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
    const surveyMsg = t('surveyMsg')
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
    const subject = lastUserMsg?.content?.slice(0, 50) ?? t('ticketSubject')
    const description = testHistory.map(m => `${m.role === 'user' ? t('roleCustomer') : 'AI'}：${m.content}`).join('\n')
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

  // 載入收件匣（從 cs-thread 取得所有客戶對話，支援全部 168+ 位客戶）
  async function loadInbox(targetKey?: string) {
    setInboxLoading(true)
    try {
      const url = inboxPlatformFilter !== 'all'
        ? `/api/marketing/cs-thread?industry=${ind}&platform=${inboxPlatformFilter}&limit=500`
        : `/api/marketing/cs-thread?industry=${ind}&limit=500`
      const res = await fetch(url)
      const d = await res.json()
      const convos: InboxConvo[] = d.conversations ?? []
      setInboxConvos(convos)

      let next: InboxConvo | null = null
      if (targetKey) {
        next = convos.find(c => `${c.platform}:${c.from_id}` === targetKey) ?? null
      }
      if (!next && activeConvo) {
        next = convos.find(c => c.platform === activeConvo.platform && c.from_id === activeConvo.from_id) ?? null
      }
      if (!next && convos.length > 0) {
        next = convos[0]
      }
      setActiveConvo(next)
      if (next) {
        setInboxThreadKey(`${next.platform}:${next.from_id}`)
        void loadThreadBubbles(next.platform, next.from_id)
      } else {
        setThreadBubbles([])
      }
      void loadTickets()
    } finally {
      setInboxLoading(false)
    }
  }

  async function loadThreadBubbles(platform: string, to: string) {
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/marketing/cs-thread?to=${to}&platform=${platform}`)
      const d = await res.json()
      if (d.bubbles) setThreadBubbles(d.bubbles)
      if (typeof d.takeover === 'boolean') {
        setActiveConvo(prev => prev && prev.from_id === to ? { ...prev, takeover: d.takeover } : prev)
      }
    } finally {
      setThreadLoading(false)
    }
  }

  function jumpToCustomerInbox(platform: string, fromId?: string, fromName?: string) {
    setTab('inbox')
    setSidebarCollapsed(true)
    if (fromId) {
      const targetKey = `${platform}:${fromId}`
      setInboxThreadKey(targetKey)
      const target: InboxConvo = { platform, from_id: fromId, name: fromName ?? null }
      setActiveConvo(target)
      void loadInbox(targetKey)
      void loadThreadBubbles(platform, fromId)
    } else {
      void loadInbox()
    }
  }

  async function toggleInboxTakeover() {
    if (!activeConvo) return
    const next = !activeConvo.takeover
    setActiveConvo(prev => prev ? { ...prev, takeover: next } : null)
    setInboxConvos(prev => prev.map(c =>
      c.platform === activeConvo.platform && c.from_id === activeConvo.from_id
        ? { ...c, takeover: next }
        : c
    ))
    try {
      await fetch('/api/marketing/cs-takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: activeConvo.platform,
          to: activeConvo.from_id,
          industry: ind,
          takeover: next,
        }),
      })
      void loadTickets()
    } catch {
      setActiveConvo(prev => prev ? { ...prev, takeover: !next } : null)
      setInboxConvos(prev => prev.map(c =>
        c.platform === activeConvo.platform && c.from_id === activeConvo.from_id
          ? { ...c, takeover: !next }
          : c
      ))
    }
  }

  async function sendInboxReply() {
    if (!activeConvo || !inboxReplyText.trim() || inboxSending) return
    const text = inboxReplyText.trim()
    setInboxSending(true)
    setInboxSendError('')
    const optimisticBubble = {
      side: 'out' as const,
      sender: 'agent' as const,
      text,
      at: new Date().toISOString(),
    }
    setThreadBubbles(prev => [...prev, optimisticBubble])
    setInboxReplyText('')
    try {
      const res = await fetch('/api/marketing/cs-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: activeConvo.platform,
          to: activeConvo.from_id,
          text,
          industry: ind,
          fromName: activeConvo.name,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setActiveConvo(prev => prev ? { ...prev, takeover: true } : null)
        setInboxConvos(prev => prev.map(c =>
          c.platform === activeConvo.platform && c.from_id === activeConvo.from_id
            ? { ...c, takeover: true, lastMessageAt: new Date().toISOString() }
            : c
        ))
        void loadThreadBubbles(activeConvo.platform, activeConvo.from_id)
        void loadTickets()
      } else {
        setInboxSendError(d.error ?? t('unknownError'))
        setThreadBubbles(prev => prev.filter(b => b !== optimisticBubble))
        setInboxReplyText(text)
      }
    } catch (e) {
      setInboxSendError(String(e))
      setThreadBubbles(prev => prev.filter(b => b !== optimisticBubble))
      setInboxReplyText(text)
    } finally {
      setInboxSending(false)
    }
  }

  // 若由 /cs/plan 等頁的側欄連結帶著 ?tab=tickets/inbox/data-sources 進來，
  // 對應分頁的資料原本只在「點擊 tab」時載入，這裡在初次掛載時補一次。
  useEffect(() => {
    if (initialTab === 'tickets') loadTickets()
    else if (initialTab === 'inbox') loadInbox()
    else if (initialTab === 'data-sources') loadFaq(industry ?? 'homestay')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 儲存測試對話到收件匣
  async function saveTestMessageToInbox(userMsg: string, reply: string, intent: string, risk: string, latencyMs: number) {
    try {
      await fetch('/api/marketing/cs-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: ind, platform: 'test', from_id: 'test_user', from_name: t('testUser'), message: userMsg, reply, intent, risk, latency_ms: latencyMs, campaign_id: campaignId }),
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
    s === 'open' ? t('tkOpen') : s === 'in_progress' ? t('tkInProgress') : s === 'resolved' ? t('tkResolved') : t('tkClosed')
  const ticketPriorityColor = (p: string) =>
    p === 'urgent' ? 'text-red-600 bg-red-50' :
    p === 'high' ? 'text-orange-600 bg-orange-50' :
    p === 'medium' ? 'text-indigo-600 bg-indigo-50' :
    'text-gray-500 bg-gray-100'
  const ticketPriorityLabel = (p: string) =>
    p === 'urgent' ? t('prUrgent') : p === 'high' ? t('prHigh') : p === 'medium' ? t('prMedium') : t('prLow')
  const platformEmoji = (p: string) =>
    p === 'line' ? '💬' : p === 'whatsapp' ? '📱' : p === 'telegram' ? '✈️' : p === 'test' ? '🧪' : '💌'

  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <nav className={`flex flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap ${sidebarCollapsed ? 'sm:w-14' : 'sm:w-48'} sm:shrink-0 transition-all duration-200`}>
          {/* 折疊/展開按鈕 */}
          <div className="hidden sm:flex items-center justify-between pb-1 border-b border-gray-100 mb-1 w-full">
            {!sidebarCollapsed && <span className="text-[11px] font-semibold text-gray-400 px-1">{t('menuItemsLabel')}</span>}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 ml-auto transition-colors"
              title={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
          {(['platforms', 'campaign-offers', 'pricing', 'dialogue-files', 'ai-settings', 'data-sources', 'forms', 'logs', 'tickets', 'inbox', 'corrections'] as Cs12Tab[]).map(tb => {
            const openCount = tickets.filter(tk => tk.status === 'open' || tk.status === 'in_progress').length
            const labels: Record<Cs12Tab, string> = {
              platforms: t('tabPlatforms'),
              'campaign-offers': t('tabCampaignOffers'),
              pricing: t('tabPricingBooking'),
              'dialogue-files': t('tabKnowledge'),
              'ai-settings': t('tabAiSettings'),
              'data-sources': t('tabDataSources'),
              forms: t('tabForms'),
              logs: t('tabLogs'),
              tickets: `${t('tabTickets')}${openCount > 0 ? ` (${openCount})` : ''}`,
              inbox: t('tabInbox'),
              corrections: t('tabCorrections'),
              test: t('tabTest'),
            }
            const icons: Record<Cs12Tab, LucideIcon> = {
              platforms: MessageSquare,
              'campaign-offers': Tag,
              pricing: Calculator,
              'dialogue-files': BookOpen,
              'ai-settings': Sparkles,
              'data-sources': Database,
              forms: FileText,
              logs: ClipboardList,
              tickets: Ticket,
              inbox: Inbox,
              corrections: ShieldCheck,
              test: FlaskConical,
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
                  if (tb === 'inbox') {
                    setSidebarCollapsed(true)
                    loadInbox()
                  }
                  if (tb === 'tickets') loadTickets()
                  if (tb === 'data-sources') loadFaq(industry ?? 'homestay')
                }}
                title={sidebarCollapsed ? labels[tb] : undefined}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors relative flex items-center gap-2 sm:w-full ${
                  sidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'
                } ${
                  active ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                {!sidebarCollapsed && <span className="flex-1 text-left truncate">{labels[tb]}</span>}
                {!sidebarCollapsed && isLocked && <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                {isNew && tb === 'inbox' && inboxConvos.length === 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>
            )
          })}

          {/* 分隔線與底部常用連結（方案 A） */}
          <div className="hidden sm:block my-2 border-t border-gray-100 w-full" />

          <a
            href="/cs/plan"
            title={sidebarCollapsed ? `⚡ ${t('upgradePlanCta')}` : undefined}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 sm:w-full ${
              sidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'
            } bg-primary/10 text-primary hover:bg-primary/20`}
          >
            <Zap className="h-4 w-4 shrink-0 fill-current" />
            {!sidebarCollapsed && <span className="flex-1 text-left truncate">{t('upgradePlanCta')}</span>}
          </a>

          <a
            href="/cs/help"
            target="_blank"
            rel="noopener noreferrer"
            title={sidebarCollapsed ? t('fullSetupGuideCta') : undefined}
            className={`px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-2 sm:w-full ${
              sidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0 text-gray-400" />
            {!sidebarCollapsed && <span className="flex-1 text-left truncate">{t('fullSetupGuideCta')} ↗</span>}
          </a>

          <a
            href="/cs/dashboard"
            title={sidebarCollapsed ? t('dashboardCta') : undefined}
            className={`px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-2 sm:w-full ${
              sidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'
            }`}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0 text-gray-400" />
            {!sidebarCollapsed && <span className="flex-1 text-left truncate">{t('dashboardCta')}</span>}
          </a>

          <a
            href="/cs/about"
            title={sidebarCollapsed ? t('aboutCta') : undefined}
            className={`px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-2 sm:w-full ${
              sidebarCollapsed ? 'sm:justify-center' : 'sm:justify-start'
            }`}
          >
            <Info className="h-4 w-4 shrink-0 text-gray-400" />
            {!sidebarCollapsed && <span className="flex-1 text-left truncate">{t('aboutCta')}</span>}
          </a>
        </nav>
        <div className="flex-1 min-w-0 space-y-5">

      {/* ── Tab: Platforms ──────────────────────────────────────────────────── */}
      {tab === 'platforms' && (
        <div className="space-y-4">
          {/* 對話測試沙盒捷徑 */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span>{t('testSandboxShortcutLabel')}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">{t('realtimeValidationBadge')}</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                  {t('testSandboxDesc')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTab('test')}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>{t('enterTestSandbox')}</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <span>{t('platformsIntro')}</span>
            <HelpTip title={t('helpPlatformsTitle')} href="/cs/help#channels">
              {t('helpPlatformsBody')}
            </HelpTip>
          </p>
          <div className="grid grid-cols-1 gap-3">
            {csPlatforms.map(p => (
              <div key={p.id} className="border rounded-xl p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                    <span className="font-medium text-sm text-gray-800">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${platformConnected[p.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {platformConnected[p.id] ? t('connected') : t('notSet')}
                    </span>
                    {p.id !== 'whatsapp_personal' && (
                      <button onClick={() => setEditingPlatform(editingPlatform === p.id ? null : p.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                        {t('configure')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Webhook URL */}
                {p.showWebhook && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[10px] bg-gray-100 px-2.5 py-1.5 rounded-lg text-gray-700 font-mono truncate">
                      {appUrl}/api/marketing/cs-webhook/{p.id}/{userId ?? t('loginToShow')}
                    </code>
                    <button onClick={() => userId && navigator.clipboard.writeText(`${appUrl}/api/marketing/cs-webhook/${p.id}/${userId}`)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 whitespace-nowrap">
                      {t('copy')}
                    </button>
                  </div>
                )}

                {/* Note */}
                <p className="text-[10px] text-gray-400">
                  {p.note}
                  {p.docUrl && (
                    <a href={p.docUrl} target="_blank" rel="noopener noreferrer"
                      className="ml-1.5 text-indigo-400 hover:text-indigo-600 underline">
                      {t('officialDocs')} ↗
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
                        {telegramSetupLoading ? t('tgRegistering') : `🔗 ${t('tgReregister')}`}
                      </button>
                      <button onClick={checkTelegramDiag} disabled={telegramDiagLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 disabled:opacity-50">
                        {telegramDiagLoading ? t('tgQuerying') : `🔍 ${t('tgCheckStatus')}`}
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
                            🌐 {t('tgEndpoint')}: HTTP {telegramDiag.endpointStatus}
                            {telegramDiag.endpointStatus === 307 ? ` ← ${t('tgRedirected')}` : ''}
                            {telegramDiag.endpointStatus === 200 ? ` ← ${t('tgAccessible')}` : ''}
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
                              <div>🔗 Webhook URL: <span className="break-all opacity-70">{r.url || t('tgNotSet')}</span></div>
                              <div>📬 Pending updates: {r.pending_update_count ?? 0}</div>
                              {r.last_error_message && (
                                <>
                                  <div className={telegramDiag?.endpointStatus === 200 ? 'text-yellow-400' : 'text-red-400'}>
                                    {telegramDiag?.endpointStatus === 200 ? '⚠️' : '❌'} {t('tgLastError')}: {r.last_error_message}
                                  </div>
                                  {r.last_error_date && (
                                    <div className="text-gray-400 opacity-70">   {t('tgTime')}: {new Date(r.last_error_date * 1000).toLocaleString(locale)}</div>
                                  )}
                                  {telegramDiag?.endpointStatus === 200 && (
                                    <div className="text-green-400">   ✅ {t('tgHistoricError')}</div>
                                  )}
                                </>
                              )}
                              {!r.last_error_message && r.url && (
                                <div className="text-green-400">✅ {t('tgWebhookOk')}</div>
                              )}
                            </>
                          )
                        })()}
                        {telegramDiag.recentChats && telegramDiag.recentChats.length > 0 && (
                          <div className="mt-1">
                            <div className="text-gray-400 mb-0.5">{t('tgRecentChats')}</div>
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
                            ? <div className="text-blue-300">👤 {t('tgAdminId')}: <span className="text-white">{adminId}</span> ← {t('tgForwardHere')}</div>
                            : <div className="text-yellow-400">⚠️ {t('tgNoAdminId')}</div>
                        })()}
                        {!(telegramDiag.me as any)?.ok && <div className="text-red-400">❌ {t('tgBadToken')}: {JSON.stringify((telegramDiag.me as any)?.description)}</div>}
                      </div>
                    )}

                    {/* Row 2: send test message */}
                    <div className="border-t border-blue-100 pt-2 space-y-1.5">
                      <p className="text-[10px] text-gray-500">{t('tgTestHint')}</p>
                      <div className="flex gap-2">
                        <input
                          value={telegramTestChatId}
                          onChange={e => setTelegramTestChatId(e.target.value)}
                          placeholder={t('tgChatIdPh')}
                          className="flex-1 text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button onClick={sendTelegramTestMsg} disabled={telegramTestLoading || !telegramTestChatId.trim()}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white hover:bg-green-50 text-green-700 border border-green-200 disabled:opacity-50 whitespace-nowrap">
                          {telegramTestLoading ? t('tgSending') : `📨 ${t('tgSend')}`}
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
                {p.id === 'whatsapp_personal' && csFeatures && !csFeatures.whatsappPersonal && (
                  <div className="rounded-xl border border-dashed px-3 py-2.5 text-xs text-gray-500 bg-gray-50 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="flex-1">{t('waPersonalProOnly')}</span>
                    <a href="/cs/plan" className="text-primary font-medium hover:underline shrink-0">{t('upgradeArrow')}</a>
                  </div>
                )}
                {p.id === 'whatsapp_personal' && !(csFeatures && !csFeatures.whatsappPersonal) && (
                  <div className="space-y-3">
                    {/* Status bar */}
                    <div className={`rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                      waStatus === 'connected' ? 'bg-green-50 text-green-700 border border-green-200' :
                      waStatus === 'qr' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      waStatus === 'connecting' || waStatus === 'reconnecting' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                      'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>
                      <span>
                        {waStatus === 'connected' && waPhone && `✅ ${t('waConnectedPhone', { phone: waPhone })}`}
                        {waStatus === 'connected' && !waPhone && `✅ ${t('waConnected')}`}
                        {waStatus === 'qr' && `📱 ${t('waScanQr')}`}
                        {waStatus === 'connecting' && `⏳ ${t('waConnecting')}`}
                        {waStatus === 'reconnecting' && `🔄 ${t('waReconnecting')}`}
                        {waStatus === 'not_started' && t('waNotConnected')}
                        {waStatus === 'disconnected' && `❌ ${t('waDisconnected')}`}
                      </span>
                      {waStatus === 'connected'
                        ? <button onClick={disconnectWa} disabled={waLoading}
                            className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200">
                            {waLoading ? '...' : t('waDisconnect')}
                          </button>
                        : <button onClick={startWaSession} disabled={waLoading || waStatus === 'connecting' || waStatus === 'qr'}
                            className="text-[10px] px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                            {waLoading ? t('waStarting') : waStatus === 'qr' ? t('waWaiting') : `📱 ${t('waScanConnect')}`}
                          </button>
                      }
                    </div>

                    {/* QR code */}
                    {waQrData && waStatus === 'qr' && (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <img src={waQrData} alt="WhatsApp QR Code"
                          className="w-48 h-48 rounded-xl border-4 border-green-200 shadow" />
                        <p className="text-[10px] text-gray-500 text-center">
                          {t('waQrHint')}
                        </p>
                      </div>
                    )}

                    {waError && (
                      <div className="text-[10px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        ❌ {waError}
                        {waError.includes('WHATSAPP_BRIDGE_URL') && (
                          <div className="mt-1 text-red-500">{t('waBridgeHint')}</div>
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
                            {isSet && <span className="ml-1 text-green-500">{t('fieldSet')}</span>}
                          </label>
                          <input
                            type={field.secret ? 'password' : 'text'}
                            placeholder={isSet ? t('keepOriginal') : field.placeholder}
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
                        {savingPlatform === p.id ? t('saving') : t('save')}
                      </button>
                      <button onClick={() => setEditingPlatform(null)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600">
                        {t('cancel')}
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
            <span>{t('aiSettingsIntro')}</span>
            <HelpTip title={t('helpAiSettingsTitle')} href="/cs/help#ai-settings">
              {t('helpAiSettingsBody')}
            </HelpTip>
          </p>

          {/* Industry template banner */}
          {industry && CS_INDUSTRY_TEMPLATES[industry] && (
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CS_INDUSTRY_TEMPLATES[industry].emoji}</span>
                  <div>
                    <div className="font-semibold text-sm text-violet-800">{t('tplTitle', { name: industryLabel(industry) })}</div>
                    <div className="text-xs text-violet-500">{t('tplDesc')}</div>
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
                  {t('applyTemplate')}
                </button>
              </div>
              {!systemPrompt && (
                <div className="text-xs text-violet-600 bg-violet-100 rounded-lg px-3 py-2">
                  💡 {t('noPromptHint')}
                </div>
              )}
            </div>
          )}

          {/* Industry template selector (no industry in URL) */}
          {!industry && !systemPrompt && (
            <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-2">
              <div className="text-sm font-medium text-gray-700">{t('quickApplyTpl')}</div>
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
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2.5">
            <div className="font-medium text-sm text-indigo-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />{t('routingTitle')}
            </div>
            <div className="space-y-1.5 text-xs text-indigo-700">
              <div className="flex items-center gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-100 border border-indigo-300 font-mono text-[10px]">L1</span>
                <span>{t('routingL1')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-blue-100 border border-blue-300 font-mono text-[10px]">L2</span>
                <span>{t('routingL2')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-violet-100 border border-violet-300 font-mono text-[10px]">L3</span>
                <span>{t('routingL3')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-teal-100 border border-teal-300 font-mono text-[10px]">🔍</span>
                <span>{t('routingSearch')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-orange-100 border border-orange-300 font-mono text-[10px]">L4</span>
                <span>{t('routingClaude')}</span>
              </div>
            </div>
            <div className="text-xs text-indigo-600 pt-1 border-t border-indigo-200/60">
              {t('routingRefundNote')}
            </div>
          </div>

          <CsSupportPanel />

          {/* 進階 AI 設定（免費方案僅開放系統提示詞，以下全部鎖定） */}
          <div className={csFeatures && csFeatures.aiSettingsScope === 'basic' ? 'relative' : ''}>
            {csFeatures && csFeatures.aiSettingsScope === 'basic' && (
              <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] rounded-xl flex items-center justify-center p-4">
                <div className="bg-white border rounded-xl shadow-lg px-6 py-4 text-center space-y-2 max-w-xs">
                  <Lock className="h-5 w-5 text-gray-400 mx-auto" />
                  <p className="text-sm font-medium text-gray-700">{t('advancedAiSettingsProOnly')}</p>
                  <p className="text-xs text-gray-400">{t('advancedAiSettingsUnlockHint')}</p>
                  <a href="/cs/plan" className="inline-block text-xs text-primary font-medium hover:underline">{t('upgradePlanCta')} →</a>
                </div>
              </div>
            )}
          <div className={`space-y-4 ${csFeatures && csFeatures.aiSettingsScope === 'basic' ? 'opacity-30 pointer-events-none select-none' : ''}`}>
          {/* Escalation threshold */}
          <div className="border rounded-xl p-4 space-y-3">
            <span className="font-medium text-sm text-gray-700">{t('escalationThreshold')}</span>
            <div className="flex gap-3">
              {([
                { value: 'high', label: t('escHighLabel'), desc: t('escHighDesc'), color: 'red' },
                { value: 'medium', label: t('escMedLabel'), desc: t('escMedDesc'), color: 'amber' },
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
            <span className="font-medium text-sm text-gray-700">{t('replyLanguage')}</span>
            <select value={replyLanguage} onChange={e => setReplyLanguage(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="auto">{t('autoDetect')}</option>
              <option value="繁體中文">繁體中文</option>
              <option value="简体中文">简体中文</option>
              <option value="English">English</option>
              <option value="Tiếng Việt">{`Tiếng Việt（${t('replyLangViNote')}）`}</option>
              <option value="日本語">日本語</option>
              <option value="한국어">한국어</option>
              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
              <option value="ภาษาไทย">{`ภาษาไทย（${t('replyLangThNote')}）`}</option>
            </select>
          </div>

          {/* 客服身分與顯示外觀（LINE 專屬：智能小喬 AI vs 真人客服） */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 space-y-4 bg-indigo-50/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-indigo-600" />
                <span className="font-semibold text-sm text-gray-800">{t('csIdentityTitle')}</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{t('csIdentityLineOnlyBadge')}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t.rich('csIdentityDesc', { b: (chunks) => <strong>{chunks}</strong> })}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* 卡片 1：🤖 智能小喬（AI 客服身分） */}
              <div className="bg-white border-2 border-indigo-100 rounded-xl p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-1 border-b border-indigo-50">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <span>🤖 {t('aiCardTitle')}</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{t('autoReplyDisplayBadge')}</span>
                </div>

                {/* AI 暱稱 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <span>{t('aiNicknameLabel')}</span>
                    <span className="text-[10px] text-gray-400 font-normal">（{t('maxChars20Hint')}）</span>
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={aiSenderName}
                    onChange={e => setAiSenderName(e.target.value)}
                    placeholder={t('aiNicknamePlaceholder')}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <p className="text-[10px] text-gray-400">{t('aiNicknameHint')}</p>
                </div>

                {/* AI 頭像 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <span>{t('avatarLabelAi')}</span>
                    <span className="text-[10px] text-gray-400 font-normal">（{t('httpsUrlHint')}）</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full border border-indigo-200 bg-indigo-50 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                      {aiSenderIconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={aiSenderIconUrl}
                          alt="AI Avatar"
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <UserRound className="h-5 w-5 text-indigo-300" />
                      )}
                    </div>
                    <input
                      type="url"
                      value={aiSenderIconUrl}
                      onChange={e => setAiSenderIconUrl(e.target.value)}
                      placeholder={t('avatarUrlPlaceholder')}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <input
                      type="file"
                      ref={avatarInputRef}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) void handleAvatarUpload(f)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="shrink-0 px-2 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs text-gray-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                      title={t('uploadAvatarTitleAi')}
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 text-gray-500" />
                          <span>{t('uploadBtnLabel')}</span>
                        </>
                      )}
                    </button>
                    {aiSenderIconUrl && (
                      <button
                        type="button"
                        onClick={() => setAiSenderIconUrl('')}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title={t('clearAvatarTitle')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 卡片 2：👩‍💼 真人客服（手動回覆身分） */}
              <div className="bg-white border-2 border-emerald-100 rounded-xl p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-1 border-b border-emerald-50">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>👩‍💼 {t('humanCardTitle')}</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{t('humanCardManualReplyBadge')}</span>
                </div>

                {/* 真人暱稱 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <span>{t('humanNicknameLabel')}</span>
                    <span className="text-[10px] text-gray-400 font-normal">（{t('maxChars20Hint')}）</span>
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={humanSenderName}
                    onChange={e => setHumanSenderName(e.target.value)}
                    placeholder={t('humanNicknamePlaceholder')}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <p className="text-[10px] text-gray-400">{t('humanNicknameHint')}</p>
                </div>

                {/* 真人頭像 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <span>{t('avatarLabelHuman')}</span>
                    <span className="text-[10px] text-gray-400 font-normal">（{t('httpsUrlHint')}）</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full border border-emerald-200 bg-emerald-50 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                      {humanSenderIconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={humanSenderIconUrl}
                          alt="Human Avatar"
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <UserRound className="h-5 w-5 text-emerald-300" />
                      )}
                    </div>
                    <input
                      type="url"
                      value={humanSenderIconUrl}
                      onChange={e => setHumanSenderIconUrl(e.target.value)}
                      placeholder={t('avatarUrlPlaceholder')}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                    <input
                      type="file"
                      ref={humanAvatarInputRef}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) void handleHumanAvatarUpload(f)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => humanAvatarInputRef.current?.click()}
                      disabled={uploadingHumanAvatar}
                      className="shrink-0 px-2 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs text-gray-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                      title={t('uploadAvatarTitleHuman')}
                    >
                      {uploadingHumanAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 text-gray-500" />
                          <span>{t('uploadBtnLabel')}</span>
                        </>
                      )}
                    </button>
                    {humanSenderIconUrl && (
                      <button
                        type="button"
                        onClick={() => setHumanSenderIconUrl('')}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title={t('clearAvatarTitle')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div className="border-2 border-indigo-200 rounded-xl p-4 space-y-2 bg-indigo-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-700">{t('systemPrompt')}</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{t('aiRoleTag')}</span>
              </div>
              <span className="text-xs text-gray-400">{t('nChars', { n: systemPrompt.length })}</span>
            </div>
            <p className="text-xs text-gray-500">{t.rich('systemPromptHint', { b: (c) => <strong>{c}</strong>, br: () => <br /> })}</p>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder={t('systemPromptPlaceholder')}
              className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          {/* ── VIP 識別 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-800">{t('vipTitle')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{t('live')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('vipDesc')}</p>
            <textarea
              value={vipList}
              onChange={e => setVipList(e.target.value)}
              rows={4}
              placeholder={t('vipListPlaceholder')}
              className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none font-mono"
            />
          </div>

          {/* ── 自動結案 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">{t('autoClose')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{t('live')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('autoCloseDesc')}</p>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={120}
                value={autoCloseMinutes}
                onChange={e => setAutoCloseMinutes(Number(e.target.value))}
                className="w-24 text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <span className="text-sm text-gray-500">{t('minutesAutoClose')}</span>
              {autoCloseMinutes > 0 && <span className="text-xs text-green-600">{t('enabled')}</span>}
            </div>
          </div>

          {/* ── 客服真人聯絡電話 ── */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-gray-800">{t('csContactPhone')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">{t('live')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('csContactPhoneDesc')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="tel"
                value={contactPhone1}
                onChange={e => setContactPhone1(e.target.value)}
                placeholder={t('csContactPhonePh1')}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                type="tel"
                value={contactPhone2}
                onChange={e => setContactPhone2(e.target.value)}
                placeholder={t('csContactPhonePh2')}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* 工單通知設定 */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{t('ticketNotify')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{t('ticketNotifyTag')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('ticketNotifyDesc')}</p>
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
                      placeholder={t('whLabelPh')}
                      value={wh.label}
                      onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, label: e.target.value } : w))}
                      className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                  {wh.type === 'line_messaging' ? (
                    <>
                      <input
                        placeholder={t('whLineToken')}
                        value={wh.value}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, value: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                      <input
                        placeholder={t('whLineTarget')}
                        value={wh.target ?? ''}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, target: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                    </>
                  ) : wh.type === 'telegram' ? (
                    <>
                      <input
                        placeholder={t('whTgToken')}
                        value={wh.value}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, value: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                      <input
                        placeholder={t('whTgChatId')}
                        value={wh.target ?? ''}
                        onChange={e => setNotifyWebhooks(prev => prev.map((w, i) => i === idx ? { ...w, target: e.target.value } : w))}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                      />
                      <p className="text-[10px] text-gray-400">💡 {t('whTgHint')}</p>
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
            >+ {t('addNotifyChannel')}</button>
          </div>
          </div>
          </div>

          <button onClick={saveSettings} disabled={savingSettings}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'var(--primary)' }}>
            {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin" />{t('saving')}</> : <><CheckCircle2 className="h-4 w-4" />{t('saveSettings')}</>}
          </button>

          {/* Env hint */}
          <div className="bg-gray-50 border rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <div className="font-medium text-gray-600">{t('envHint')}</div>
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
              {t('tabKnowledge')}
              <HelpTip title={t('helpKbTitle')} href="/cs/help#dialogue-files">
                {t('helpKbBody')}
              </HelpTip>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{t('kbHint')}</div>
          </div>

          {/* Direct text input */}
          <div className="border-2 border-green-200 rounded-xl p-4 space-y-2 bg-green-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">{t('kbDirectInput')}</span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{t('kbFaqTag')}</span>
              </div>
              <span className="text-xs text-gray-400">{t('nChars', { n: knowledgeBase.length })}</span>
            </div>
            <p className="text-xs text-gray-500">{t.rich('kbDesc', { b: (c) => <strong>{c}</strong>, br: () => <br /> })}</p>
            <textarea
              value={knowledgeBase}
              onChange={e => setKnowledgeBase(e.target.value)}
              rows={8}
              placeholder={t('kbPlaceholder')}
              className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 font-mono"
            />
          </div>

          {/* File upload */}
          <div className="border rounded-xl p-4 space-y-3">
            <span className="text-xs font-medium text-gray-600">{t('uploadDoc')}</span>
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
                ? <><Loader2 className="h-5 w-5 text-gray-400 mx-auto mb-1 animate-spin" /><p className="text-xs text-gray-500">{t('uploadingShort')}</p></>
                : <><Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" /><p className="text-xs text-gray-500">{t('clickUpload50')}</p></>
              }
            </div>
            {(() => {
              // Always show files from either local state or saved DB data
              const displayFiles = dialogueFiles.length > 0 ? dialogueFiles : (savedData?.dialogueFiles ?? [])
              return displayFiles.length === 0 ? (
                <p className="text-xs text-gray-400 text-center">{t('noFiles')}</p>
              ) : (
                <div className="space-y-1.5">
                  {displayFiles.map(f => (
                    <div key={f.url} className="flex items-center gap-3 p-2.5 rounded-lg border bg-gray-50">
                      <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-400">{f.sizeKb} KB · {f.textContent ? t('extractedChars', { n: f.textContent.length.toLocaleString() }) : t('noTextContent')}</p>
                      </div>
                      <button onClick={() => removeDialogueFile(f.url)} className="text-gray-400 hover:text-red-500 transition-colors" title={t('deleteFile')}>
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
            {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin" />{t('saving')}</> : <><CheckCircle2 className="h-4 w-4" />{t('saveKb')}</>}
          </button>
        </div>
      )}

      {/* ── Tab: Data Sources ───────────────────────────────────────────────── */}
      {tab === 'data-sources' && (csFeatures && !csFeatures.dataSources ? renderLockedUpgrade(t('tabDataSources')) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                {t('extSources')}
                <HelpTip title={t('helpDataSourcesTitle')} href="/cs/help#data-sources">
                  {t('helpDataSourcesBody')}
                </HelpTip>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{t('extSourcesHint')}</div>
            </div>
            <button onClick={openAddDs}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1"
              style={{ background: 'var(--primary)' }}>
              <Plus className="h-3.5 w-3.5" />{t('add')}
            </button>
          </div>

          {/* Industry recommended sheets guide */}
          {ind === 'homestay' && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-gray-800">{t('sourceSwitch')}</div>
                <p className="text-[11px] text-gray-400 mt-0.5">{t('sourceSwitchHint')}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{t('roomPrice')}</div>
                  <div className="text-[10px] text-gray-400">{t('roomPriceHint')}</div>
                </div>
                <div className="flex rounded-lg border overflow-hidden text-xs shrink-0">
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, priceSource: 'booking_system' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.priceSource === 'booking_system' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('bookingSystem')}</button>
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, priceSource: 'pricing_calculator' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.priceSource === 'pricing_calculator' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('tabPricing')}</button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{t('checkinPwd')}</div>
                  <div className="text-[10px] text-gray-400">{t('checkinPwdHint')}</div>
                </div>
                <div className="flex rounded-lg border overflow-hidden text-xs shrink-0">
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, passwordSource: 'booking_system' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.passwordSource === 'booking_system' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('bookingSystem')}</button>
                  <button onClick={() => saveSourcePrefs({ ...sourcePrefs, passwordSource: 'datasource' })} disabled={savingPrefs}
                    className={`px-3 py-1.5 font-medium ${sourcePrefs.passwordSource === 'datasource' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{t('pwdSheet')}</button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{t('checkinTime')}</div>
                  <div className="text-[10px] text-gray-400">{t('checkinTimeHint')}</div>
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
                <div className="font-medium text-sm text-blue-800">{t('recommendedSheets', { name: industryLabel(industry) })}</div>
              </div>
              <div className="space-y-2">
                {CS_INDUSTRY_TEMPLATES[industry].recommendedSheets.map((sheet, i) => (
                  <div key={i} className="bg-white rounded-lg border border-blue-100 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{t('sheetN', { n: i + 1 })}</span>
                      <span className="text-xs font-semibold text-gray-800">{sheetT('name', i, sheet.name)}</span>
                      <span className="text-[10px] text-gray-400">{sheetT('description', i, sheet.description)}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      <div>{t('queryColumn')}<span className="text-gray-700 font-medium">{sheetT('keyColumn', i, sheet.keyColumn)}</span></div>
                      <div>{t('returnColExample')}<span className="text-gray-600">{sheetT('returnColumnsExample', i, sheet.returnColumnsExample)}</span></div>
                      <div>{t('triggerWord')}<span className="text-blue-600">{sheetT('triggerKeywords', i, sheet.triggerKeywords)}</span>　{t('triggerMode')}<span className="font-medium">{sheet.triggerMode === 'numeric' ? t('tmNumeric') : sheet.triggerMode === 'both' ? t('tmBoth') : t('tmKeyword')}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-blue-600 space-y-0.5">
                <div>💡 {t.rich('dsTip1', { b: (c) => <strong>{c}</strong> })}</div>
                <div>👉 {t('dsTip2')}</div>
              </div>
            </div>
          )}

          {dsLoading && <div className="text-xs text-gray-400 text-center py-4"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />{t('loadingShort')}</div>}

          {dsFetchFailed && !editingDs && (
            <div className="border-2 border-dashed border-red-200 rounded-xl p-6 text-center space-y-1 bg-red-50">
              <div className="text-sm text-red-500 font-medium">{t('loadFailedNotDeleted')}</div>
              <div className="text-xs text-red-400">{t('reloadAndRetryHint')}</div>
            </div>
          )}

          {dataSources.length === 0 && !dsLoading && !dsFetchFailed && !editingDs && (
            <div className="border-2 border-dashed rounded-xl p-6 text-center space-y-2">
              <div className="text-sm text-gray-400">{t('noDataSources')}</div>
              <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 text-left space-y-1">
                <div className="font-medium text-gray-600">📌 {t('toolDivision')}</div>
                <div>• {t.rich('toolSheets', { b: (c) => <span className="font-medium">{c}</span> })}</div>
                <div>• {t.rich('toolPricing', { b: (c) => <span className="font-medium">{c}</span> })}</div>
                <div>• {t.rich('toolKb', { b: (c) => <span className="font-medium">{c}</span> })}</div>
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
                      {t('triggerWord')}{(src.config.triggerKeywords ?? []).join('、') || t('tgNotSet')}
                    </div>
                  </div>
                  <button onClick={() => toggleDs(src)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${src.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {src.enabled ? t('enable') : t('disable')}
                  </button>
                  <button onClick={() => openEditDs(src)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">{t('edit')}</button>
                  <button onClick={() => deleteDs(src.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">{t('delete')}</button>
                </div>
              ))}
            </div>
          )}

          {editingDs !== null && (
            <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <div className="font-medium text-sm text-gray-700">{editingDs.id ? t('editSource') : t('addSource')}</div>

              {[
                { key: 'name', label: t('dsName'), placeholder: t('dsNamePh'), secret: false },
                { key: 'apiKey', label: 'Google Sheets API Key', placeholder: 'AIzaSy...', secret: true },
                { key: 'spreadsheetId', label: 'Spreadsheet ID', placeholder: t('dsSpreadsheetPh'), secret: false },
                { key: 'sheetName', label: t('dsSheetName'), placeholder: t('dsSheetNamePh'), secret: false },
                { key: 'keyColumn', label: t('dsKeyColumn'), placeholder: t('dsKeyColumnPh'), secret: false },
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
                <label className="text-[10px] text-gray-500 block mb-1">{t('dsReturnCols')}</label>
                <textarea
                  rows={4}
                  placeholder={t('dsReturnColsPh')}
                  value={editingDsForm.returnColumns.join('\n')}
                  onChange={e => setEditingDsForm(prev => ({ ...prev, returnColumns: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono leading-relaxed"
                />
                <div className="text-[10px] text-gray-400 mt-0.5">{t('dsReturnColsHint')}</div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">{t('dsTriggerMode')}</label>
                <select
                  value={editingDsForm.triggerMode ?? 'keyword'}
                  onChange={e => setEditingDsForm(prev => ({ ...prev, triggerMode: e.target.value as 'keyword' | 'numeric' | 'both' }))}
                  className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="keyword">{t('dsTmKeyword')}</option>
                  <option value="numeric">{t('dsTmNumeric')}</option>
                  <option value="both">{t('dsTmBoth')}</option>
                </select>
                {editingDsForm.triggerMode === 'numeric' && (
                  <div className="text-[10px] text-indigo-600 mt-1 bg-indigo-50 px-2 py-1 rounded">
                    {t('dsNumericHint')}
                  </div>
                )}
              </div>

              {(editingDsForm.triggerMode === 'keyword' || editingDsForm.triggerMode === 'both' || !editingDsForm.triggerMode) && (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">{t('dsTriggerKw')}</label>
                  <input
                    type="text"
                    placeholder={t('dsTriggerKwPh')}
                    value={editingDsForm.triggerKeywords.join(',')}
                    onChange={e => setEditingDsForm(prev => ({ ...prev, triggerKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[10px] text-blue-700 space-y-1">
                <div className="font-medium">{t('howToGetId')}</div>
                <div>{t.rich('howToGetIdBody', { b: (c) => <strong>{c}</strong> })}</div>
                <div className="font-medium mt-1">{t('sheetsPermHint')}</div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={saveDs} disabled={savingDs}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-70"
                  style={{ background: 'var(--primary)' }}>
                  {savingDs ? t('saving') : t('save')}
                </button>
                <button onClick={() => setEditingDs(null)}
                  className="px-4 py-2 rounded-lg text-xs bg-gray-200 text-gray-600">
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <div className="font-medium">{t('usageNotes')}</div>
            <div>• {t('usage1')}</div>
            <div>• {t('usage2')}</div>
            <div>• {t('usage3')}</div>
            <div>• {t('usage4')}</div>
          </div>

        </div>
      ))}

      {/* ── Tab: Campaign Offers (活動項目) ─────────────────────────────────── */}
      {tab === 'campaign-offers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Tag className="h-4 w-4 text-amber-600" />
                <span>{t('campaignOffersTitle')}</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">{t('campaignOffersAiBadge')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('campaignOffersDesc')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savingSettings && (
                <span className="text-xs text-amber-600 flex items-center gap-1 font-medium animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('saving')}
                </span>
              )}
              {!editingOffer && (campaignOfferSource !== 'booking') && (
                <button
                  type="button"
                  onClick={() => setEditingOffer({
                    id: crypto.randomUUID(),
                    name: '國旅補助2026',
                    enabled: true,
                    canStack: false,
                    offerType: 'nights_tiered',
                    qualification: '本國籍自由行旅客、出示身分證件正本',
                    tieredNightDiscounts: [800, 1200],
                    rulesNote: '平日住宿獎助：期限至 115 年 11 月 30 日止（限週日至週四，不含國定假日）。每人身分證限使用一次，現場核銷折抵。與其他特價/早鳥專案二擇一使用，預算用罄截止。',
                  })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                  style={{ background: 'var(--primary)' }}
                >
                  <Plus className="h-3.5 w-3.5" /> {t('addCsOffer')}
                </button>
              )}
            </div>
          </div>

          {/* ── 核心功能：活動來源切換開關 ── */}
          <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-indigo-50/60 border border-amber-200/90 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span>🎯 {t('offerSourceSwitchTitle')}</span>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">{t('effectiveImmediately')}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('offerSourceSwitchDesc')}
                </p>
              </div>

              {/* 3 態切換開關 */}
              <div className="inline-flex rounded-xl border border-gray-200 bg-white/95 p-1 shadow-xs shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCampaignOfferSource('cs')
                    saveCurrentUnit12({ campaignOfferSource: 'cs' })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    campaignOfferSource === 'cs'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>🏷️ {t('offerSourceCsOnly')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCampaignOfferSource('booking')
                    saveCurrentUnit12({ campaignOfferSource: 'booking' })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    campaignOfferSource === 'booking'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>🏨 {t('offerSourceBookingOnly')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCampaignOfferSource('both')
                    saveCurrentUnit12({ campaignOfferSource: 'both' })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    (campaignOfferSource ?? 'both') === 'both'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>🔄 {t('offerSourceBoth')}</span>
                </button>
              </div>
            </div>

            {/* 當前模式說明 */}
            <div className="text-xs text-gray-600 bg-white/80 border border-amber-100 rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700">{t('currentStatusLabel')}</span>
                {campaignOfferSource === 'cs' && (
                  <span className="text-amber-800 font-medium">
                    ✅ {t('offerSourceStatusCs')}
                  </span>
                )}
                {campaignOfferSource === 'booking' && (
                  <span className="text-indigo-800 font-medium">
                    ✅ {t('offerSourceStatusBooking')}
                  </span>
                )}
                {(campaignOfferSource ?? 'both') === 'both' && (
                  <span className="text-emerald-800 font-medium">
                    🌟 {t('offerSourceStatusBoth')}
                  </span>
                )}
              </div>
              <a
                href="/booking/promos"
                target="_blank"
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium shrink-0 ml-auto"
              >
                {t('goToBookingPromos')} ↗
              </a>
            </div>
          </div>

          {/* Booking 訂房系統活動預覽區（當模式為 booking 或 both 時顯示） */}
          {(campaignOfferSource === 'booking' || (campaignOfferSource ?? 'both') === 'both') && (
            <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                  <span>🏨 {t('bookingActivitiesTitle')}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold">
                    {loadingBookingActivities ? t('loadingShort') : t('bookingActivitiesCountBadge', { rules: bookingRules.filter(r => r.enabled).length, promos: bookingPromos.filter(p => p.enabled).length })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="/booking/pricing?tab=rules"
                    target="_blank"
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    {t('editBookingDiscountRules')} ↗
                  </a>
                  <a
                    href="/booking/promos"
                    target="_blank"
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    {t('editBookingPromoCodes')} ↗
                  </a>
                </div>
              </div>

              {loadingBookingActivities ? (
                <div className="text-xs text-gray-400 py-3 text-center flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" /> {t('loadingBookingActivitiesText')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bookingRules.filter(r => r.enabled).map(r => (
                    <div key={r.id} className="bg-white border border-indigo-100 rounded-lg p-2.5 text-xs shadow-2xs">
                      <div className="flex items-center justify-between font-semibold text-gray-800 flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <span>{r.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${r.can_stack ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'}`}>
                            {r.can_stack ? t('stackableBadge') : t('singleUseBadge')}
                          </span>
                        </div>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                          {r.adjustment_type === 'percent' ? t('percentOffLabel', { pct: r.adjustment_value, offPct: 10 - r.adjustment_value / 10 }) : t('fixedOffLabel', { value: r.adjustment_value })}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {r.rule_type === 'early_bird' ? t('earlyBirdRuleLabel', { days: Number((r.conditions as Record<string, unknown>)?.days_before ?? 0) }) :
                         r.rule_type === 'advance_booking' ? t('advanceBookingRuleLabel', { days: Number((r.conditions as Record<string, unknown>)?.days_before ?? 0) }) :
                         t('dynamicPricingRuleFallback')}
                      </div>
                    </div>
                  ))}
                  {bookingPromos.filter(p => p.enabled).map(p => (
                    <div key={p.id} className="bg-white border border-indigo-100 rounded-lg p-2.5 text-xs shadow-2xs">
                      <div className="flex items-center justify-between font-semibold text-gray-800 flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-indigo-700 font-bold">{p.code}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${p.can_stack ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'}`}>
                            {p.can_stack ? t('stackableBadge') : t('singleUseBadge')}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                          {p.type === 'percent' ? t('promoPercentOffLabel', { offPct: 10 - p.value / 10 }) : t('promoFixedOffLabel', { value: p.value })}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {p.name ? `${p.name} · ` : ''}{p.min_nights > 1 ? t('minNightsLabel', { nights: p.min_nights }) : t('noMinNightsLabel')}
                      </div>
                    </div>
                  ))}
                  {bookingRules.filter(r => r.enabled).length === 0 && bookingPromos.filter(p => p.enabled).length === 0 && (
                    <div className="col-span-2 text-center text-xs text-gray-400 py-3 bg-white/60 rounded-lg border border-dashed border-indigo-200">
                      {t('noBookingActivitiesYet')}<a href="/booking/pricing?tab=rules" target="_blank" className="text-indigo-600 underline ml-1">{t('clickToCreateLink')}</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 議價折扣上限 + 贈品/賠禮清單 */}
          <div className="border border-rose-200/90 bg-rose-50/40 rounded-2xl p-4 space-y-3">
            <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>🤝 {t('negotiationToolkitTitle')}</span>
            </div>
            <p className="text-xs text-gray-500">{t('negotiationToolkitDesc')}</p>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('discountMaxPctLabel')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100}
                  value={discountMaxPct}
                  onChange={e => setDiscountMaxPct(Number(e.target.value))}
                  className="w-24 text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-rose-300"
                />
                <span className="text-sm text-gray-500">%</span>
                {discountMaxPct === 0 && <span className="text-xs text-gray-400">{t('discountMaxPctZeroHint')}</span>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('giftListLabel')}</label>
              <RowsEditor
                rows={discountGifts as unknown as Array<Record<string, unknown>>}
                fields={[
                  { key: 'name', label: t('giftNameLabel'), type: 'text', width: 'w-32' },
                  { key: 'situation', label: t('giftSituationLabel'), type: 'text', width: 'w-56' },
                ]}
                onChange={rows => setDiscountGifts(rows.map((r, i) => ({
                  id: (r.id as string) || `g${i}`,
                  name: (r.name as string) ?? '',
                  situation: (r.situation as string) ?? '',
                })))}
                addLabel={t('addGiftItem')}
              />
            </div>

            <p className="text-[11px] text-gray-400 bg-white/70 border border-rose-100 rounded-lg p-2">{t('negotiationToolkitRule')}</p>
          </div>

          {/* CS 自訂活動標題 */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <span>🏷️ {t('csCustomOffersTitle')}</span>
              {campaignOfferSource === 'booking' && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t('csOffersPausedBadge')}</span>
              )}
            </div>
          </div>

          {/* 活動清單 */}
          {campaignOffers.length === 0 && !editingOffer && (
            <div className="border-2 border-dashed border-amber-200 rounded-xl p-8 text-center text-xs text-gray-400 bg-white/60">
              {t('noCsOffersYet')}
            </div>
          )}

          {campaignOffers.length > 0 && !editingOffer && (
            <div className={`space-y-2 ${campaignOfferSource === 'booking' ? 'opacity-50' : ''}`}>
              {campaignOffers.map((offer) => (
                <div key={offer.id} className={`bg-white border rounded-xl p-3.5 flex items-start gap-3 transition-all ${offer.enabled ? 'border-amber-200 shadow-sm' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{offer.name || t('unnamedOfferFallback')}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                        {offer.offerType === 'nights_tiered' ? t('offerTypeNightsTiered') :
                         offer.offerType === 'percent' ? t('offerTypePercentLabel', { offPct: 10 - (offer.discountPercent ?? 0) / 10, pct: offer.discountPercent ?? 0 }) :
                         offer.offerType === 'fixed_amount' ? t('offerTypeFixedLabel', { value: offer.discountAmount ?? 0 }) : t('offerTypeCustomFallback')}
                      </span>
                      {offer.canStack ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">
                          {t('offerStackableBadge')}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium border border-gray-200">
                          {t('offerSingleUseBadge')}
                        </span>
                      )}
                    </div>
                    {offer.offerType === 'nights_tiered' && offer.tieredNightDiscounts?.length ? (
                      <div className="text-xs text-emerald-700 font-semibold mt-1">
                        💰 {t('tieredDiscountPrefix')}{offer.tieredNightDiscounts.map((d, i) => t('nightDiscountItem', { n: i + 1, d })).join('、')}
                      </div>
                    ) : null}
                    {offer.qualification && (
                      <div className="text-[11px] text-gray-600 mt-1">
                        👤 {t('qualificationPrefix')}{offer.qualification}
                      </div>
                    )}
                    {offer.rulesNote && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        📝 {t('rulesNotePrefix')}{offer.rulesNote}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = campaignOffers.map(o => o.id === offer.id ? { ...o, enabled: !o.enabled } : o)
                        setCampaignOffers(updated)
                        saveCurrentUnit12({ campaignOffers: updated })
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${offer.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {offer.enabled ? t('offerEnabledBadge') : t('offerDisabledBadge')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingOffer({ ...offer })}
                      className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = campaignOffers.filter(o => o.id !== offer.id)
                        setCampaignOffers(updated)
                        saveCurrentUnit12({ campaignOffers: updated })
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 編輯 / 新增活動表單 */}
          {editingOffer && (
            <div className="bg-white border-2 border-amber-300 rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="font-semibold text-sm text-gray-800">
                  {campaignOffers.some(o => o.id === editingOffer.id) ? t('editOfferPlanTitle') : t('addOfferPlanTitle')}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingOffer.enabled}
                    onChange={e => setEditingOffer({ ...editingOffer, enabled: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>{t('enableThisOffer')}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('offerNameLabel')}</label>
                  <input
                    type="text"
                    value={editingOffer.name}
                    onChange={e => setEditingOffer({ ...editingOffer, name: e.target.value })}
                    placeholder={t('offerNamePlaceholder')}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('discountModeLabel')}</label>
                  <select
                    value={editingOffer.offerType}
                    onChange={e => setEditingOffer({ ...editingOffer, offerType: e.target.value as CsCampaignOffer['offerType'] })}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="nights_tiered">{t('discountModeNightsTiered')}</option>
                    <option value="fixed_amount">{t('discountModeFixedAmount')}</option>
                    <option value="percent">{t('discountModePercent')}</option>
                    <option value="custom">{t('discountModeCustom')}</option>
                  </select>
                </div>
              </div>

              {/* 梯次金額輸入 */}
              {editingOffer.offerType === 'nights_tiered' && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 space-y-2">
                  <label className="text-xs font-semibold text-amber-900 block">{t('perNightDiscountLabel')}</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {(editingOffer.tieredNightDiscounts ?? [800, 1200]).map((amt, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-white border border-amber-300 rounded-lg px-2 py-1">
                        <span className="text-xs text-gray-600">{t('nightNLabel', { n: idx + 1 })}：$</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={amt}
                          onChange={e => {
                            const next = [...(editingOffer.tieredNightDiscounts ?? [800, 1200])]
                            next[idx] = Number(e.target.value)
                            setEditingOffer({ ...editingOffer, tieredNightDiscounts: next })
                          }}
                          className="w-16 text-xs font-bold text-emerald-700 outline-none"
                        />
                        {(editingOffer.tieredNightDiscounts?.length ?? 0) > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (editingOffer.tieredNightDiscounts ?? []).filter((_, i) => i !== idx)
                              setEditingOffer({ ...editingOffer, tieredNightDiscounts: next })
                            }}
                            className="text-gray-400 hover:text-red-500 ml-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(editingOffer.tieredNightDiscounts ?? [800, 1200]), 1000]
                        setEditingOffer({ ...editingOffer, tieredNightDiscounts: next })
                      }}
                      className="text-xs text-amber-700 border border-amber-300 bg-white rounded-lg px-2 py-1 hover:bg-amber-100"
                    >
                      + {t('addNextNight')}
                    </button>
                  </div>
                </div>
              )}

              {/* 固定金額輸入 */}
              {editingOffer.offerType === 'fixed_amount' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('discountAmountLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={editingOffer.discountAmount ?? 500}
                    onChange={e => setEditingOffer({ ...editingOffer, discountAmount: Number(e.target.value) })}
                    className="w-32 text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              )}

              {/* 百分比輸入 */}
              {editingOffer.offerType === 'percent' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{t('discountPercentInputLabel')}</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={editingOffer.discountPercent ?? 10}
                    onChange={e => setEditingOffer({ ...editingOffer, discountPercent: Number(e.target.value) })}
                    className="w-32 text-xs border rounded-lg px-2.5 py-1.5 bg-white font-bold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">{t('qualificationConditionLabel')}</label>
                <textarea
                  rows={2}
                  value={editingOffer.qualification}
                  onChange={e => setEditingOffer({ ...editingOffer, qualification: e.target.value })}
                  placeholder={t('qualificationPlaceholder')}
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">{t('qualificationAiHint')}</p>
              </div>

              {/* 優惠疊加設定 */}
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-lg p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingOffer.canStack ?? false}
                    onChange={e => setEditingOffer({ ...editingOffer, canStack: e.target.checked })}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-gray-800">
                      {t('allowStackWithOthers')}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                      {editingOffer.canStack
                        ? `🟢 ${t('stackEnabledHint')}`
                        : `⚪ ${t('stackDisabledHint')}`}
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">{t('offerSupplementaryNotesLabel')}</label>
                  <span className="text-[10px] text-gray-400">{t('resizeHandleHint')}</span>
                </div>
                <textarea
                  value={editingOffer.rulesNote}
                  onChange={e => setEditingOffer({ ...editingOffer, rulesNote: e.target.value })}
                  rows={7}
                  placeholder={t('rulesNotePlaceholder')}
                  className="w-full text-xs border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y min-h-[160px] leading-relaxed"
                />
              </div>

              <div className="flex gap-2 pt-1 border-t">
                <button
                  type="button"
                  onClick={() => {
                    if (!editingOffer.name.trim()) return
                    const exists = campaignOffers.some(o => o.id === editingOffer.id)
                    const updated = exists
                      ? campaignOffers.map(o => o.id === editingOffer.id ? editingOffer : o)
                      : [...campaignOffers, editingOffer]
                    setCampaignOffers(updated)
                    setEditingOffer(null)
                    saveCurrentUnit12({ campaignOffers: updated })
                  }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                  style={{ background: 'var(--primary)' }}
                >
                  {t('saveOffer')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOffer(null)}
                  className="px-4 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          {/* 活動底部儲存列 */}
          <div className="flex items-center justify-between pt-3 border-t text-xs text-gray-400">
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> {t('offersAutoSaveHint')}
            </div>
            <button
              type="button"
              onClick={() => saveCurrentUnit12()}
              disabled={savingSettings}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm transition-all"
              style={{ background: 'var(--primary)' }}
            >
              {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {t('saveOfferSettings')}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Pricing Calculator & Booking Flows (預訂與定價) ───────────────── */}
      {tab === 'pricing' && (csFeatures && !csFeatures.pricingCalculator ? renderLockedUpgrade(t('tabPricingBooking')) : (
        <div className="space-y-6">
          {/* 區塊一：房型與服務定價計算機 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <Calculator className="h-4 w-4 text-indigo-600" />
                  <span>{t('pricingCalcTitle')}</span>
                  <HelpTip title={t('helpPricingTitle')} href="/cs/help#pricing">
                    {t('helpPricingBody')}
                  </HelpTip>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{t('pricingHint')}</div>
                <div className="mt-1.5 text-[11px] text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                  <span>📌 {t.rich('pricingDivisionNote', { b: (c) => <strong>{c}</strong> })}</span>
                </div>
              </div>
              {!editingPc && (
                <div className="flex gap-1.5 flex-wrap">
                  {(industry && CS_INDUSTRY_TEMPLATES[industry]
                    ? CS_INDUSTRY_TEMPLATES[industry].pricingButtons
                    : [{ key: 'tour', label: `+ ${t('pcTour')}` }, { key: 'accommodation', label: `+ ${t('pcAccommodation')}` }, { key: 'custom', label: `+ ${t('pcCustom')}` }]
                  ).map(({ key, label }, idx) => (
                    <button key={idx} onClick={() => openAddPc(key)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                      style={{ background: 'var(--primary)' }}>
                      {industry && t.has(`pricingBtn_${industry}_${idx}`) ? t(`pricingBtn_${industry}_${idx}`) : label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {dsFetchFailed && !editingPc && (
              <div className="border-2 border-dashed border-red-200 rounded-xl p-8 text-center bg-red-50">
                <div className="mb-1 text-sm text-red-500 font-medium">{t('pricingLoadFailedNotDeleted')}</div>
                <div className="text-xs text-red-400">{t('reloadAndRetryHint')}</div>
              </div>
            )}

            {pricingConfigs.length === 0 && !dsFetchFailed && !editingPc && (
              <div className="border-2 border-dashed rounded-xl p-8 text-center text-sm text-gray-400">
                <div className="mb-2">{t('noPricing')}</div>
                <div className="text-xs">{t('noPricingHint')}</div>
              </div>
            )}

            {pricingConfigs.length > 0 && !editingPc && (
              <div className="space-y-2">
                {pricingConfigs.map((pc) => {
                  const cfg = pc.config as { productType?: string; triggerKeywords?: string[] }
                  const typeLabel = cfg.productType === 'tour' ? t('pcTour') : cfg.productType === 'accommodation' ? t('pcAccommodation') : t('pcCustom')
                  return (
                    <div key={pc.id} className="border rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">{typeLabel}</span>
                          <span className="truncate">{pc.name}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {t('triggerWord')}{(cfg.triggerKeywords ?? []).join('、') || t('notConfigured')}
                        </div>
                      </div>
                      <button onClick={() => togglePc(pc)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pc.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {pc.enabled ? t('enable') : t('disable')}
                      </button>
                      <button onClick={() => openEditPc(pc)}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">{t('edit')}</button>
                      <button onClick={() => deletePc(pc.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">{t('delete')}</button>
                    </div>
                  )
                })}
              </div>
            )}

            {editingPc !== null && (
              <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm text-gray-700">{editingPc.id ? t('editPricing') : t('addPricing')}</div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                    {editingPc.config.productType === 'tour' ? t('pcTour') : editingPc.config.productType === 'accommodation' ? t('pcAccommodation') : t('pcCustom')}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">{t('dsName')}</label>
                  <input
                    type="text"
                    placeholder={t('pcNamePh')}
                    value={editingPc.name}
                    onChange={e => setEditingPc(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">{t('pcTriggerWordLabel')}</label>
                    <TagInput
                      value={editingPc.config.triggerKeywords ?? []}
                      onChange={v => updatePcConfig({ triggerKeywords: v })}
                      placeholder={t('pressEnterHint')}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">{t('currencyLabel')}</label>
                    <select
                      value={editingPc.config.currency ?? 'TWD'}
                      onChange={e => updatePcConfig({ currency: e.target.value })}
                      className="w-full text-xs border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      {['TWD', 'USD', 'JPY', 'CNY', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {editingPc.config.productType === 'tour' && (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{t('scheduleLabel')}</label>
                      <RowsEditor
                        rows={(editingPc.config.schedules ?? []) as Array<Record<string, unknown>>}
                        fields={[{ key: 'name', label: t('nameFieldLabel'), type: 'text', width: 'w-40' }]}
                        onChange={rows => updatePcConfig({
                          schedules: rows.map((r, i) => ({ id: (r.id as string) || String(i + 1), name: (r.name as string) ?? '' })),
                        })}
                        addLabel={t('addScheduleLabel')}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{t('ticketTypesAndPricesLabel')}</label>
                      <RowsEditor
                        rows={(editingPc.config.segments ?? []) as Array<Record<string, unknown>>}
                        fields={[
                          { key: 'label', label: t('nameFieldLabel'), type: 'text', width: 'w-32' },
                          { key: 'weekdayPrice', label: t('weekdayPriceLabel'), type: 'number' },
                          { key: 'weekendPrice', label: t('weekendPriceLabel'), type: 'number' },
                        ]}
                        onChange={rows => updatePcConfig({
                          segments: rows.map(r => ({
                            label: (r.label as string) ?? '',
                            key: ((r.label as string) ?? '').trim() || 'seg',
                            weekdayPrice: Number(r.weekdayPrice) || 0,
                            weekendPrice: Number(r.weekendPrice) || 0,
                          })),
                        })}
                        addLabel={t('addTicketType')}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{t('packagePlanLabel')}</label>
                      <RowsEditor
                        rows={(editingPc.config.packages ?? []) as Array<Record<string, unknown>>}
                        fields={[
                          { key: 'name', label: t('nameFieldLabel'), type: 'text', width: 'w-32' },
                          { key: 'price', label: t('priceLabel'), type: 'number' },
                          { key: 'description', label: t('descriptionLabel'), type: 'text', width: 'w-32' },
                        ]}
                        onChange={rows => updatePcConfig({ packages: rows as PcConfig['packages'] })}
                        addLabel={t('addPackage')}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{t('groupDiscountLabel')}</label>
                      <RowsEditor
                        rows={(editingPc.config.groupDiscounts ?? []) as Array<Record<string, unknown>>}
                        fields={[
                          { key: 'minPeople', label: t('minPeopleLabel'), type: 'number' },
                          { key: 'discountPercent', label: t('discountPercentLabel'), type: 'number' },
                          { key: 'note', label: t('noteLabel'), type: 'text', width: 'w-32' },
                        ]}
                        onChange={rows => updatePcConfig({ groupDiscounts: rows as PcConfig['groupDiscounts'] })}
                        addLabel={t('addGroupDiscount')}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{t('cancellationPolicyLabel')}</label>
                      <textarea
                        rows={2}
                        value={editingPc.config.cancellationPolicy ?? ''}
                        onChange={e => updatePcConfig({ cancellationPolicy: e.target.value })}
                        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  </>
                )}

                {editingPc.config.productType === 'accommodation' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-gray-500 font-medium">{t('roomPricingLabel')}</label>
                      </div>

                      <div className="text-[11px] text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded-lg p-2.5 mb-2.5 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                          <span>💡</span> {t('roomPricingRulesTitle')}
                        </div>
                        <div className="text-gray-600 leading-relaxed text-[11px] space-y-0.5">
                          <p>• {t.rich('roomPricingRule1', { b: (c) => <strong>{c}</strong> })}</p>
                          <p>• {t.rich('roomPricingRule2', { b: (c) => <strong>{c}</strong> })}</p>
                          <p>• {t.rich('roomPricingRule3', { b: (c) => <strong>{c}</strong> })}</p>
                        </div>
                      </div>

                      <RowsEditor
                        rows={(editingPc.config.rooms ?? []) as Array<Record<string, unknown>>}
                        fields={[
                          { key: 'name', label: t('roomNameLabel'), type: 'text', width: 'w-28' },
                          { key: 'capacity', label: t('maxOccupancyLabel'), type: 'number', width: 'w-16' },
                          { key: 'weekdayPrice', label: t('weekdayPriceLabel'), type: 'number', width: 'w-20' },
                          { key: 'weekendPrice', label: t('weekendPriceLabel'), type: 'number', width: 'w-20' },
                          { key: 'holidayPrice', label: t('holidayPriceLabel'), type: 'number', width: 'w-20' },
                          { key: 'extraPersonFee', label: t('extraPersonFeeLabel'), type: 'number', width: 'w-20' },
                        ]}
                        onChange={rows => updatePcConfig({
                          rooms: rows.map(r => ({
                            name: (r.name as string) ?? '',
                            capacity: Number(r.capacity) || 2,
                            weekdayPrice: Number(r.weekdayPrice) || 0,
                            weekendPrice: Number(r.weekendPrice) || 0,
                            holidayPrice: r.holidayPrice ? Number(r.holidayPrice) : undefined,
                            extraPersonFee: r.extraPersonFee ? Number(r.extraPersonFee) : undefined,
                          })),
                        })}
                        addLabel={t('addRoomType')}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">{t('checkinNotesLabel')}</label>
                      <StringListEditor
                        items={editingPc.config.notes ?? []}
                        onChange={items => updatePcConfig({ notes: items })}
                        placeholder={t('checkinNotesPlaceholder')}
                        addLabel={t('addNote')}
                      />
                    </div>
                  </>
                )}

                {editingPc.config.productType === 'custom' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-500">{t('customPricingRuleLabel')}</label>
                    </div>
                    <textarea
                      rows={5}
                      placeholder={t('customPricingPlaceholder')}
                      value={editingPc.config.customContent ?? ''}
                      onChange={e => updatePcConfig({ customContent: e.target.value })}
                      className="w-full text-xs border rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      💡 {t('customPricingHint')}
                    </p>
                  </div>
                )}

                {/* 進階 JSON 編輯 */}
                <div className="border-t pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!pcAdvancedOpen) setPcAdvancedText(JSON.stringify(editingPc.config, null, 2))
                      setPcAdvancedOpen(prev => !prev)
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                  >
                    <span>{pcAdvancedOpen ? t('collapseAdvancedJson') : t('advancedJsonEdit')}</span>
                  </button>
                  {pcAdvancedOpen && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        rows={8}
                        value={pcAdvancedText}
                        onChange={e => setPcAdvancedText(e.target.value)}
                        className="w-full font-mono text-[11px] border rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                      {pcJsonError && <div className="text-[11px] text-red-500">{pcJsonError}</div>}
                      <button
                        type="button"
                        onClick={applyPcAdvancedJson}
                        className="text-xs px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium"
                      >
                        {t('applyJson')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={savePc} disabled={savingPc || !editingPc.name.trim()}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-70"
                    style={{ background: 'var(--primary)' }}>
                    {savingPc ? t('saving') : t('save')}
                  </button>
                  <button onClick={() => { setEditingPc(null); setPcJsonError(''); setPcAdvancedOpen(false) }}
                    className="px-4 py-2 rounded-lg text-xs bg-gray-200 text-gray-600">
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
              <div className="font-medium">{t('usageNotes')}</div>
              <div>• {t('pcUsage1')}</div>
              <div>• {t('pcUsage2')}</div>
              <div>• {t('pcUsage3')}</div>
            </div>
          </div>

          {/* ── 區塊二：客戶預訂引導與收款流程 ── */}
          <div className="border-2 border-emerald-200 rounded-xl p-4 space-y-3 bg-emerald-50/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                  <span>📝 {t('bookingGuideTitle')}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">{t('smartGuideBadge')}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{t('bookingFlowHint')}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !bookingFlowEnabled
                  setBookingFlowEnabled(next)
                  saveCurrentUnit12({ bookingFlowEnabled: next })
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bookingFlowEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${bookingFlowEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {bookingFlowEnabled && (
              <div className="space-y-3 pt-1">
                {/* Flow list */}
                {bookingFlows.map((flow, fi) => (
                  <div key={flow.id} className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700">{flow.name || t('flowN', { n: fi + 1 })}</span>
                        {flow.simpleMode && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{t('quickBooking')}</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditingFlow({ ...flow })}
                          className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">{t('edit')}</button>
                        <button onClick={() => {
                          const updated = bookingFlows.filter((_, i) => i !== fi)
                          setBookingFlows(updated)
                          saveCurrentUnit12({ bookingFlows: updated })
                        }}
                          className="text-[10px] px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">{t('delete')}</button>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {t('triggerKw')}<span className="text-emerald-700 font-medium">{flow.triggerKeywords || t('notConfigured')}</span>
                    </div>
                    {flow.simpleMode
                      ? <div className="text-[10px] text-blue-600">{t('simpleModeFlow')}</div>
                      : <div className="text-[10px] text-gray-500">{t('collectSteps')}{flow.steps.map(s => stepLabel(s)).join(' → ')}</div>
                    }
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setEditingFlow({ id: `flow_${Date.now()}`, name: '', triggerKeywords: '', dataHint: '', steps: ['date_depart', 'timeslot', 'headcount', 'phone'], paymentInfo: '' })}
                  className="w-full py-2.5 rounded-xl text-xs font-medium border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> {t('addBookingType')}
                </button>

                {/* Global payment info */}
                <div className="pt-2">
                  <div className="text-xs font-semibold text-gray-700 mb-1">{t('defaultPayment')}</div>
                  <p className="text-[10px] text-gray-400 mb-1.5">{t('paymentInfoHint')}</p>
                  <textarea
                    value={paymentInfo}
                    onChange={e => setPaymentInfo(e.target.value)}
                    onBlur={() => saveCurrentUnit12({ paymentInfo })}
                    rows={2}
                    placeholder={t('paymentPlaceholder')}
                    className="w-full text-xs border rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-gray-400">
                      {savingSettings ? `💾 ${t('saving')}` : `✓ ${t('settingsAutoSyncHint')}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => saveCurrentUnit12({ paymentInfo })}
                      disabled={savingSettings}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm"
                      style={{ background: 'var(--primary)' }}
                    >
                      {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {t('saveBookingPaymentSettings')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Flow editor modal */}
          {editingFlow && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setEditingFlow(null) }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-gray-800">{t('flowEditorTitle')}</h3>
                  <button onClick={() => setEditingFlow(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('flowName')}</label>
                  <input value={editingFlow.name} onChange={e => setEditingFlow(f => f ? { ...f, name: e.target.value } : f)}
                    placeholder={t('flowNamePlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Trigger keywords */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('triggerKwLabel')}</label>
                  <p className="text-[10px] text-gray-400">{t('triggerKwHint')}</p>
                  <input value={editingFlow.triggerKeywords} onChange={e => setEditingFlow(f => f ? { ...f, triggerKeywords: e.target.value } : f)}
                    placeholder={t('triggerKwPlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Data hint */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('dataHintLabel')}</label>
                  <p className="text-[10px] text-gray-400">{t.rich('dataHintHint', { br: () => <br /> })}</p>
                  <input value={editingFlow.dataHint ?? ''} onChange={e => setEditingFlow(f => f ? { ...f, dataHint: e.target.value } : f)}
                    placeholder={t('dataHintPlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                {/* Simple mode toggle */}
                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editingFlow.simpleMode ?? false}
                      onChange={e => setEditingFlow(f => f ? { ...f, simpleMode: e.target.checked } : f)}
                      className="rounded" />
                    <span className="text-xs font-semibold text-blue-800">{t('simpleMode')}</span>
                  </label>
                  <p className="text-[10px] text-blue-600 leading-relaxed">{t('simpleModeHint')}</p>
                  {editingFlow.simpleMode && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editingFlow.requirePassengerId ?? true}
                        onChange={e => setEditingFlow(f => f ? { ...f, requirePassengerId: e.target.checked } : f)}
                        className="rounded" />
                      <span className="text-xs text-blue-700">{t('requireId')}</span>
                    </label>
                  )}
                </div>

                {/* Steps — hidden in simple mode */}
                {!editingFlow.simpleMode && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">{t('collectStepsLabel')}</label>
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
                  <label className="text-xs font-medium text-gray-600">{t('flowPaymentLabel')}</label>
                  <textarea value={editingFlow.paymentInfo} onChange={e => setEditingFlow(f => f ? { ...f, paymentInfo: e.target.value } : f)}
                    rows={2}
                    placeholder={t('flowPaymentPlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditingFlow(null)}
                    className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">{t('cancel')}</button>
                  <button onClick={() => {
                    if (!editingFlow) return
                    const idx = bookingFlows.findIndex(f => f.id === editingFlow.id)
                    const updated = idx >= 0
                      ? bookingFlows.map((f, i) => i === idx ? editingFlow : f)
                      : [...bookingFlows, editingFlow]
                    setBookingFlows(updated)
                    setEditingFlow(null)
                    saveCurrentUnit12({ bookingFlows: updated })
                  }} className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: 'var(--primary)' }}>
                    {t('saveFlow')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Tab: Forms ──────────────────────────────────────────────────────── */}
      {tab === 'forms' && (
        <CsFormsPanel industry={industry ?? 'homestay'} appUrl={appUrl} />
      )}

      {/* ── Tab: Test ───────────────────────────────────────────────────────── */}
      {tab === 'test' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => setTab('platforms')}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-sm font-medium"
            >
              ← {t('backToPlatformLinks')}
            </button>
            <span className="text-xs text-gray-400 font-medium">{t('testSandboxShortcutLabel')}</span>
          </div>
          <div className="border rounded-xl overflow-hidden">
            {/* Chat header */}
            <div className="bg-gray-50 border-b px-4 py-2.5 flex items-center gap-2 flex-wrap">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-gray-700">{t('testChat')}</span>
              <span className="text-[10px] text-gray-400">{t('testRouting')}</span>
              <HelpTip title={t('helpTestTitle')} href="/cs/help#test">
                {t('helpTestBody')}
              </HelpTip>

              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                {/* 智慧草稿 toggle */}
                <button
                  onClick={() => setDraftMode(v => !v)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-all ${
                    draftMode ? 'bg-violet-50 border-violet-300 text-violet-700 font-medium' : 'border-gray-200 text-gray-400 hover:text-gray-600'
                  }`}>
                  <Wand2 className="h-3 w-3" />
                  {t('draftMode')}{draftMode ? t('on') : t('off')}
                </button>
                {/* 對話摘要 */}
                {testHistory.length > 1 && (
                  <button onClick={summarizeConversation} disabled={summarizing}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-50">
                    {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                    {t('summary')}
                  </button>
                )}
                {/* 建立工單 */}
                {testHistory.length > 0 && (
                  <button onClick={createTicketFromConversation} disabled={creatingTicket}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-orange-600 hover:border-orange-300 disabled:opacity-50">
                    {creatingTicket ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
                    {t('createTicket')}
                  </button>
                )}
                {/* 結案 */}
                {testHistory.length > 0 && !caseClosed && (
                  <button onClick={closeCase}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300">
                    <ThumbsUp className="h-3 w-3" />
                    {t('closeCase')}
                  </button>
                )}
                {/* 清除 */}
                {testHistory.length > 0 && (
                  <button onClick={() => { setTestHistory([]); setSummary(''); setCaseClosed(false); setDraftText(''); setDraftMeta(null) }}
                    className="text-[10px] text-gray-400 hover:text-gray-600">
                    {t('clear')}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-white">
              {testHistory.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-10">
                  {t('testEmptyHint')}
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
                          {t('vipPriority')}
                        </div>
                      )}
                      {/* 流失預警 */}
                      {churn && (
                        <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium px-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('churnWarning')}
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
                            {msg.meta.risk === 'high' ? t('riskHigh') : msg.meta.risk === 'medium' ? t('riskMedium') : t('riskLow')}
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
                            📚 {t('addToKb')}
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
                    <span className="text-xs text-gray-400">{draftMode ? t('aiDrafting') : t('aiThinking')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 智慧草稿 panel */}
            {draftMode && draftText && (
              <div className="border-t bg-violet-50 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs font-medium text-violet-700">{t('smartDraft')}</span>
                  {draftMeta && (
                    <>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(draftMeta.risk ?? 'low')}`}>
                        {draftMeta.risk === 'high' ? t('riskHigh') : draftMeta.risk === 'medium' ? t('riskMedium') : t('riskLow')}
                      </span>
                      <span className="text-[10px] text-gray-500">{draftMeta.intent}</span>
                    </>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">{t('draftFor', { msg: draftUserMsg })}</span>
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
                    {t('adoptSend')}
                  </button>
                  <button onClick={discardDraft}
                    className="px-4 py-1.5 rounded-lg text-xs bg-gray-200 text-gray-600">
                    {t('discard')}
                  </button>
                </div>
              </div>
            )}

            {/* Image preview */}
            {testImage && (
              <div className="border-t px-3 pt-2 bg-gray-50 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={testImage.preview} alt="preview" className="h-14 w-14 object-cover rounded-lg border" />
                <span className="text-xs text-gray-500 flex-1">{t('imageSelected')}</span>
                <button onClick={() => setTestImage(null)} className="text-xs text-red-400 hover:text-red-600">{t('remove')}</button>
              </div>
            )}

            {/* Input */}
            <div className="border-t px-3 py-2.5 flex gap-2 bg-gray-50 items-center">
              {/* Image upload button */}
              <label className="cursor-pointer p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 shrink-0" title={t('uploadImage')}>
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
                placeholder={draftMode ? t('testInputPlaceholderDraft') : t('testInputPlaceholder')}
                className="flex-1 text-sm border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={testLoading}
              />
              <button onClick={sendTestMessage} disabled={testLoading || (!testInput.trim() && !testImage)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 shrink-0"
                style={{ background: 'var(--primary)' }}>
                {t('send')}
              </button>
            </div>
          </div>

          {/* 自動結案倒數 */}
          {caseClosed && autoCloseSecondsLeft !== null && (
            <div className="border border-green-200 rounded-xl bg-green-50 px-4 py-2.5 flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700 font-medium">{t('autoCloseCountdown')}</span>
              <span className="text-xs text-green-600 ml-auto">
                {t('autoCloseIn', { time: `${Math.floor(autoCloseSecondsLeft / 60)}:${String(autoCloseSecondsLeft % 60).padStart(2, '0')}` })}
              </span>
            </div>
          )}
          {caseClosed && autoCloseSecondsLeft === null && autoCloseMinutes > 0 && (
            <div className="border border-gray-200 rounded-xl bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
              {t('caseAutoClosed')}
            </div>
          )}

          {/* 對話摘要結果 */}
          {summary && (
            <div className="border border-indigo-200 rounded-xl bg-indigo-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700">{t('convSummary')}</span>
                <button onClick={() => setSummary('')} className="ml-auto text-[10px] text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{summary}</pre>
            </div>
          )}

          {/* Quick test phrases */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500 font-medium">{t('quickPhrases')}</div>
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
              <div className="text-sm font-medium text-gray-700">📚 {t('autoLearnFaq')}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t('autoLearnFaqHint')}</div>
            </div>
            <button
              onClick={() => setFaqDialog({ open: true, q: '', a: '', keywords: '', saving: false })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" />{t('manualAdd')}
            </button>
          </div>
          {faqItems.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8 border rounded-xl border-dashed">
              {t('noFaqRecords')}
            </div>
          ) : (
            <div className="space-y-2">
              {faqItems.map(item => (
                <div key={item.id} className="border rounded-xl p-3 bg-emerald-50/40 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-gray-800">Q: {item.q}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setFaqDialog({
                          open: true, id: item.id, q: item.q, a: item.a,
                          keywords: item.keywords?.join(', ') ?? '', saving: false,
                        })}
                        className="text-[10px] text-gray-400 hover:text-gray-700">{t('editFaq')}</button>
                      <button
                        onClick={async () => {
                          await fetch(`/api/marketing/cs-faq?industry=${industry}&itemId=${item.id}`, { method: 'DELETE' })
                          setFaqItems(prev => prev.filter(f => f.id !== item.id))
                        }}
                        className="text-[10px] text-red-400 hover:text-red-600">{t('delete')}</button>
                    </div>
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
            <span>{t('logsIntro')}</span>
            <HelpTip title={t('helpLogsTitle')} href="/cs/help#logs">
              {t('helpLogsBody')}
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
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('totalConv')}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-800">{avgLatency}<span className="text-xs text-gray-400 ml-0.5">ms</span></div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('avgSpeed')}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-red-500">{highRisk}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('highRiskConv')}</div>
                  </div>
                  <div className="bg-white border rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-orange-500">{claudeCount}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{t('claudeEscalated')}</div>
                  </div>
                </div>

                {/* 風險分佈 */}
                <div className="bg-white border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <PieChart className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">{t('riskDist')}</span>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                    {highRisk > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(highRisk/total)*100}%` }} />}
                    {medRisk > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(medRisk/total)*100}%` }} />}
                    {lowRisk > 0 && <div className="bg-green-400 transition-all" style={{ width: `${(lowRisk/total)*100}%` }} />}
                  </div>
                  <div className="flex gap-4 text-[10px] text-gray-500">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />{t('riskHigh')} {highRisk}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />{t('riskMedium')} {medRisk}</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />{t('riskLow')} {lowRisk}</span>
                    <span className="ml-auto"><span className="text-orange-500 font-medium">Claude</span> {claudeCount} · <span className="text-blue-500 font-medium">Gemini</span> {geminiCount}</span>
                  </div>
                </div>

                {/* 熱點問題統計 */}
                {topIntents.length > 0 && (
                  <div className="bg-white border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">{t('hotIntents')}</span>
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
                        <span className="text-xs font-semibold text-gray-700">{t('sentimentTrend')}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 ml-auto">{t('live')}</span>
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
            <span className="text-sm font-medium text-gray-700">{t('convLog')}</span>
            <span className="text-xs text-gray-400">{t('nRecords', { n: logs.length })}</span>
          </div>
          {logs.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">{t('noConvLog')}</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="border rounded-xl p-3 space-y-1.5 bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${riskColor(log.risk)}`}>
                      {log.risk === 'high' ? t('riskHigh') : log.risk === 'medium' ? t('riskMedium') : t('riskLow')}
                    </span>
                    <span className="text-[10px] text-gray-500">{log.intent}</span>
                    <span className={`text-[10px] font-medium ${log.provider === 'Claude' ? 'text-orange-500' : 'text-blue-500'}`}>
                      {log.provider}
                    </span>
                    <span className="text-[10px] text-gray-400">{log.latencyMs}ms</span>
                    <span className="text-[10px] text-gray-400">{new Date(log.ts).toLocaleString(locale)}</span>
                    <button
                      onClick={() => setFaqDialog({ open: true, q: log.message, a: log.reply, keywords: '', saving: false })}
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1">
                      📚 {t('addToKb')}
                    </button>
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium text-gray-500">{t('customerLabel')}</span>{log.message}
                  </div>
                  <div className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-2">
                    <span className="font-medium text-indigo-500">{t('aiLabel')}</span>{log.reply.slice(0, 120)}{log.reply.length > 120 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tickets ──────────────────────────────────────────────────────── */}
      {tab === 'tickets' && (csFeatures && !csFeatures.tickets ? renderLockedUpgrade(t('ticketSystem')) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{t('ticketSystem')}</span>
            <HelpTip title={t('helpTicketsTitle')} href="/cs/help#tickets">
              {t('helpTicketsBody')}
            </HelpTip>
            <div className="flex gap-1.5 ml-auto flex-wrap">
              {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
                <button key={s} onClick={() => setTicketFilter(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    ticketFilter === s ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  style={ticketFilter === s ? { background: 'var(--primary)' } : {}}>
                  {s === 'all' ? t('filterAll') : ticketStatusLabel(s)}
                  {s !== 'all' && ` (${tickets.filter(t => t.status === s).length})`}
                </button>
              ))}
              <button onClick={loadTickets} disabled={ticketsLoading}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                {ticketsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {ticketsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : tickets.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">{t('noTickets')}</div>
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
                        {t('priorityLabel', { p: ticketPriorityLabel(ticket.priority) })}
                      </span>
                      <span className="text-[10px] text-gray-500">{platformEmoji(ticket.platform)} {ticket.platform}</span>
                      {ticket.intent && <span className="text-[10px] text-gray-400">{ticket.intent}</span>}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(ticket.created_at).toLocaleString(locale)}</span>
                    </div>

                    {/* 客戶身分資訊與前往收件匣（確保跟收件匣 100% 一致的人類可讀姓名） */}
                    {(() => {
                      const custFromConvo = inboxConvos.find(c => c.from_id === ticket.from_id)
                      const humanName = ticket.from_name || custFromConvo?.name
                      const displayName = formatCustomerName(humanName, ticket.from_id || '', t)
                      return (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100/70 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {displayName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 text-sm truncate flex items-center gap-1.5">
                                {displayName}
                                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-gray-200/70 text-gray-600">
                                  {platformEmoji(ticket.platform)} {ticket.platform.toUpperCase()}
                                </span>
                              </div>
                              {ticket.from_id && (
                                <div className="text-[10px] font-mono text-gray-400 truncate">
                                  ID: {ticket.from_id}
                                </div>
                              )}
                            </div>
                          </div>
                          {ticket.from_id ? (
                            <button
                              type="button"
                              onClick={() => jumpToCustomerInbox(ticket.platform, ticket.from_id, humanName ?? undefined)}
                              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white font-medium text-xs shadow-xs hover:opacity-90 transition-opacity"
                            >
                              <Inbox className="h-3.5 w-3.5" />
                              {t('goToInboxReply')} →
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400">{t('noLinkedCustomerAccount')}</span>
                          )}
                          {(ticket.intent === '行程預訂待核款' || ticket.subject?.includes('行程預訂') || ticket.description?.includes('報名資料') || ticket.description?.includes('自建表單')) && (
                            <button
                              type="button"
                              onClick={() => setTab('forms')}
                              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 font-medium text-xs hover:bg-emerald-100 transition-colors"
                            >
                              📋 {t('viewRegistrationListCta')} →
                            </button>
                          )}
                        </div>
                      )
                    })()}

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
                        📚 {t('addToKb')}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      {/* ── Tab: Inbox ────────────────────────────────────────────────────────── */}
      {tab === 'inbox' && (csFeatures && !csFeatures.inbox ? renderLockedUpgrade(t('unifiedInbox')) : (() => {
        const filteredConvos = inboxConvos.filter(c => {
          if (!inboxSearch.trim()) return true
          const q = inboxSearch.toLowerCase().trim()
          const name = (c.name || '').toLowerCase()
          const fromId = (c.from_id || '').toLowerCase()
          return name.includes(q) || fromId.includes(q)
        })
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">{t('unifiedInbox')}</span>
              <HelpTip title={t('helpInboxTitle')} href="/cs/help#inbox">
                {t('helpInboxBody')}
              </HelpTip>
              <div className="flex gap-1.5 ml-auto flex-wrap">
                {['all', 'line', 'whatsapp', 'telegram', 'test'].map(p => (
                  <button key={p} onClick={() => { setInboxPlatformFilter(p); }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                      inboxPlatformFilter === p ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                    style={inboxPlatformFilter === p ? { background: 'var(--primary)' } : {}}>
                    {p === 'all' ? t('filterAll') : `${platformEmoji(p)} ${p.toUpperCase()}`}
                  </button>
                ))}
                <button onClick={() => void loadInbox()} disabled={inboxLoading}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                  {inboxLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {inboxLoading && inboxConvos.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            ) : inboxConvos.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-12 border rounded-xl">
                <div className="mb-2">{t('noInbox')}</div>
                <div className="text-[11px]">{t('noInboxHint')}</div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row border rounded-xl overflow-hidden bg-white shadow-sm" style={{ height: 'calc(100vh - 210px)', minHeight: '600px' }}>
                {/* 左側：客戶列表（支援搜尋、垂直滾動、全部客戶） */}
                <div className="md:w-80 shrink-0 border-b md:border-b-0 md:border-r flex flex-col bg-gray-50/50">
                  {/* 搜尋列與計數 */}
                  <div className="p-2.5 border-b bg-white space-y-2 shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        value={inboxSearch}
                        onChange={e => setInboxSearch(e.target.value)}
                        placeholder={t('searchCustomerPlaceholder')}
                        className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50 focus:bg-white transition-all"
                      />
                      <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {inboxSearch && (
                        <button
                          type="button"
                          onClick={() => setInboxSearch('')}
                          className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 text-xs p-0.5"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 px-0.5">
                      <span>{t('totalCustomerConvos', { n: inboxConvos.length })}</span>
                      {inboxSearch && <span>{t('filteredCount', { n: filteredConvos.length })}</span>}
                    </div>
                  </div>

                  {/* 滾動客戶名單列表 */}
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {filteredConvos.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">
                        {inboxSearch ? t('noMatchingCustomers') : t('noConvLog')}
                      </div>
                    ) : (
                      filteredConvos.map(convo => {
                        const active = activeConvo?.platform === convo.platform && activeConvo?.from_id === convo.from_id
                        const displayName = formatCustomerName(convo.name, convo.from_id, t)
                        return (
                          <button
                            key={`${convo.platform}:${convo.from_id}`}
                            onClick={() => {
                              setActiveConvo(convo)
                              setInboxThreadKey(`${convo.platform}:${convo.from_id}`)
                              void loadThreadBubbles(convo.platform, convo.from_id)
                            }}
                            className={`w-full text-left p-3 hover:bg-white transition-colors border-l-4 ${
                              active ? 'bg-white border-l-primary shadow-xs' : 'border-l-transparent bg-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs font-semibold text-gray-900 truncate flex-1">
                                {displayName}
                              </span>
                              {convo.takeover && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium shrink-0">
                                  {t('humanTakeoverBadge')}
                                </span>
                              )}
                              {convo.lastMessageAt && (
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {new Date(convo.lastMessageAt).toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-1 text-[11px] text-gray-500">
                              <span className="truncate flex items-center gap-1 font-mono text-[10px] text-gray-400">
                                {platformEmoji(convo.platform)} {convo.from_id.slice(0, 16)}{convo.from_id.length > 16 ? '…' : ''}
                              </span>
                              {convo.messageCount != null && (
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                                  {t('messageCountSuffix', { n: convo.messageCount })}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* 右側：對話串 + 回覆框 */}
                <div className="flex-1 flex flex-col min-w-0 bg-white">
                  {!activeConvo ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 p-6">
                      <Inbox className="h-10 w-10 text-gray-300" />
                      <p className="text-sm">{t('inboxSelectHint')}</p>
                    </div>
                  ) : (
                    <>
                      {/* 對話頭部 */}
                      <div className="px-4 py-3 border-b bg-gray-50/70 shrink-0 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {formatCustomerName(activeConvo.name, activeConvo.from_id, t).charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-gray-900 truncate flex items-center gap-1.5">
                              {formatCustomerName(activeConvo.name, activeConvo.from_id, t)}
                              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-gray-200/70 text-gray-600 font-mono">
                                {platformEmoji(activeConvo.platform)} {activeConvo.platform.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-gray-400 truncate">
                              {t('accountIdLabel')}: {activeConvo.from_id}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleInboxTakeover}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-xs transition-colors cursor-pointer ${
                              activeConvo.takeover
                                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            }`}
                            title={activeConvo.takeover ? t('clickForAiReplyTitle') : t('clickForHumanTakeoverTitle')}
                          >
                            {activeConvo.takeover ? t('humanTakeoverActiveLabel') : t('aiAutoReplyActiveLabel')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void loadThreadBubbles(activeConvo.platform, activeConvo.from_id)}
                            disabled={threadLoading}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                            title={t('reloadThreadTitle')}
                          >
                            {threadLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* 訊息對話區 */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
                        {threadLoading && threadBubbles.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('loadingConvHistory')}
                          </div>
                        ) : threadBubbles.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                            {t('noMessageHistory')}
                          </div>
                        ) : (
                          threadBubbles.map((bubble, idx) => {
                            const isOut = bubble.side === 'out'
                            const isAgent = bubble.sender === 'agent'
                            return (
                              <div key={idx} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs ${
                                  isOut
                                    ? isAgent
                                      ? 'bg-amber-700 text-white rounded-tr-xs'
                                      : 'bg-primary text-white rounded-tr-xs'
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-xs'
                                }`}>
                                  <div className="text-[10px] opacity-80 mb-1 flex items-center justify-between gap-4 font-medium">
                                    <span>
                                      {!isOut
                                        ? `👤 ${formatCustomerName(activeConvo.name, activeConvo.from_id, t)}`
                                        : isAgent
                                        ? `🧑‍💼 ${t('humanAgentLabel')}`
                                        : `🤖 ${t('aiAutoReplyLabel')}`}
                                    </span>
                                    {bubble.at && (
                                      <span className="font-normal opacity-75">
                                        {new Date(bubble.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="whitespace-pre-wrap leading-relaxed break-words">{bubble.text}</div>
                                  {isOut && !isAgent && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const prevCust = [...threadBubbles.slice(0, idx)].reverse().find(b => b.side === 'in')
                                        setFaqDialog({ open: true, q: prevCust?.text || '', a: bubble.text, keywords: '', saving: false })
                                      }}
                                      className="mt-1.5 text-[10px] underline opacity-80 hover:opacity-100 flex items-center gap-1"
                                    >
                                      📚 {t('addToFaqLibrary')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* 底部輸入框 */}
                      <div className="border-t p-3 bg-white space-y-2 shrink-0">
                        {inboxSendError && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{t('inboxSendFailed', { error: inboxSendError })}</span>
                          </div>
                        )}
                        <div className="flex items-end gap-2">
                          <textarea
                            rows={2}
                            value={inboxReplyText}
                            onChange={e => setInboxReplyText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                void sendInboxReply()
                              }
                            }}
                            placeholder={activeConvo.takeover ? t('inboxReplyPlaceholderActive') : t('inboxReplyPlaceholderInactive')}
                            className="flex-1 text-xs border border-gray-300 rounded-xl p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <button
                            type="button"
                            onClick={sendInboxReply}
                            disabled={!inboxReplyText.trim() || inboxSending}
                            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm transition-all hover:opacity-90"
                            style={{ background: 'var(--primary)' }}
                          >
                            {inboxSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {t('inboxSend')}
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center justify-between px-1">
                          <span>{t('shiftEnterHint')}</span>
                          {!activeConvo.takeover && (
                            <span className="text-amber-600">※ {t('humanReplyAutoTakeoverHint')}</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })())}

      {/* ── Tab: AI 回答修正（置於功能表最下方） ──────────────────────────── */}
      {tab === 'corrections' && (
        <CsCorrectionsPanel />
      )}

      {/* ── 報名表單 Modal ── */}
      {bookingFormOpen && bookingFormConfig && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setBookingFormOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-gray-800">{t('bookingFormTitle')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{bookingFormConfig.packageName}</p>
              </div>
              <button onClick={() => setBookingFormOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* 參加人員 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">{t('participants')}</label>
                <div className="flex gap-1.5">
                  <button onClick={() => setBookingParticipants(p => [...p, { name: '', birthday: '', idNumber: '' }])}
                    className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                    + {t('add')}
                  </button>
                  {bookingParticipants.length > 1 && (
                    <button onClick={() => setBookingParticipants(p => p.slice(0, -1))}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                      − {t('remove')}
                    </button>
                  )}
                </div>
              </div>
              {bookingParticipants.map((p, i) => {
                const age = calcAge(p.birthday)
                const cat = age >= 0 ? getAgeCategory(age) : null
                const isInfant = cat === '幼兒'
                const catColor = cat === '成人' ? 'bg-blue-100 text-blue-700' : cat === '小孩' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                const catText = cat === '成人' ? t('ageAdult') : cat === '小孩' ? t('ageChild') : t('ageInfant')
                return (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 w-4">{i + 1}.</span>
                      {cat && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catColor}`}>{catText}{age >= 0 ? t('ageYears', { age }) : ''}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500">{t('pName')} <span className="text-red-500">*</span></label>
                        <input value={p.name} onChange={e => setBookingParticipants(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          placeholder={t('participantNamePlaceholder')}
                          className="w-full mt-0.5 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">{t('pBirthday')} <span className="text-red-500">*</span></label>
                        <input type="date" value={p.birthday} onChange={e => setBookingParticipants(prev => prev.map((x, j) => j === i ? { ...x, birthday: e.target.value } : x))}
                          className="w-full mt-0.5 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                      </div>
                    </div>
                    {bookingFormConfig.requirePassengerId && !isInfant && (
                      <div>
                        <label className="text-[10px] text-gray-500">{t('pIdNumber')} <span className="text-red-500">*</span></label>
                        <input value={p.idNumber} onChange={e => setBookingParticipants(prev => prev.map((x, j) => j === i ? { ...x, idNumber: e.target.value.toUpperCase() } : x))}
                          placeholder="A123456789"
                          className="w-full mt-0.5 text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 font-mono" />
                      </div>
                    )}
                    {isInfant && <p className="text-[10px] text-orange-600">{t('infantExempt')}</p>}
                  </div>
                )
              })}
            </div>

            {/* 聯絡電話 */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">{t('contactPhone')} <span className="text-red-500">*</span></label>
              <p className="text-[10px] text-gray-400">{t('contactPhoneHint')}</p>
              <input value={bookingContactPhone} onChange={e => setBookingContactPhone(e.target.value)}
                placeholder="0912-345-678"
                type="tel"
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBookingFormOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">{t('cancel')}</button>
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
                      content: t('bookingThanks'),
                    }])
                  } finally {
                    setBookingSubmitting(false)
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {bookingSubmitting ? t('submitting2') : t('confirmSubmit')}
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
            <div className="font-bold text-gray-900">📚 {faqDialog.id ? t('editFaq') : t('addToKb')}</div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('faqQ')}</label>
              <textarea rows={2} value={faqDialog.q}
                onChange={e => setFaqDialog(p => ({ ...p, q: e.target.value }))}
                placeholder={t('faqQPh')}
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('faqA')}<span className="text-red-500 ml-0.5">*</span></label>
              <textarea rows={4} value={faqDialog.a}
                onChange={e => setFaqDialog(p => ({ ...p, a: e.target.value }))}
                placeholder={t('faqAPh')}
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t('faqKw')}</label>
              <input value={faqDialog.keywords}
                onChange={e => setFaqDialog(p => ({ ...p, keywords: e.target.value }))}
                placeholder={t('faqKwPh')}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFaqDialog(p => ({ ...p, open: false }))}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('cancel')}</button>
              <button
                disabled={!faqDialog.a.trim() || faqDialog.saving}
                onClick={async () => {
                  setFaqDialog(p => ({ ...p, saving: true }))
                  const keywords = faqDialog.keywords.trim()
                    ? faqDialog.keywords.split(',').map(k => k.trim()).filter(Boolean)
                    : []
                  if (faqDialog.id) {
                    // 編輯既有項目：照使用者輸入原樣儲存，不跑 AI 自動改寫
                    const res = await fetch('/api/marketing/cs-faq', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ industry, itemId: faqDialog.id, q: faqDialog.q, a: faqDialog.a, keywords }),
                    })
                    if (res.ok) {
                      setFaqItems(prev => prev.map(f => f.id === faqDialog.id ? { ...f, q: faqDialog.q, a: faqDialog.a, keywords } : f))
                      setFaqDialog({ open: false, q: '', a: '', keywords: '', saving: false })
                    } else {
                      setFaqDialog(p => ({ ...p, saving: false }))
                    }
                    return
                  }
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
                {faqDialog.saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{faqDialog.id ? t('saving') : t('aiAnalyzing')}</>
                  : (faqDialog.id ? t('saveChanges') : t('saveToKb'))}
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

export function CsWorkspace({ industry, initialTab }: { industry?: string; initialTab?: Cs12Tab }) {
  const t = useTranslations('CsWorkspace')
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

      let found = false
      if (savedId) {
        try {
          const r = await fetch(`/api/marketing/campaign/${savedId}`)
          if (r.ok) {
            const c = (await r.json()).campaign
            if (c) {
              setCampaignId(c.id)
              setUnit12Data(c.unit_data?.[12] as Unit12Data | undefined)
              found = true
            }
          }
        } catch { /* ignore, 往下走 fallback */ }
      }

      // localStorage 遺失（換裝置/清快取）時，回頭找同產業最近一筆有內容的舊 campaign，
      // 避免每次都建立空白新草稿、讓先前上傳的知識庫「消失」。
      if (!found) {
        try {
          const r = await fetch('/api/marketing/campaign')
          if (r.ok) {
            const list = ((await r.json()).campaigns ?? []) as Array<{ id: string; industry?: string; unit_data?: Record<string, unknown> }>
            const match = list.find(c => {
              if (industry && c.industry !== industry) return false
              const u12 = c.unit_data?.[12] as Unit12Data | undefined
              return !!(u12?.systemPrompt || u12?.knowledgeBase || u12?.dialogueFiles?.length)
            })
            if (match) {
              setCampaignId(match.id)
              setUnit12Data(match.unit_data?.[12] as Unit12Data | undefined)
              if (typeof window !== 'undefined') localStorage.setItem(storageKey, match.id)
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
    const indLabel = industry ? (t.has(`industry.${industry}`) ? t(`industry.${industry}`) : (CS_INDUSTRY_TEMPLATES[industry]?.label ?? industry)) : ''
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

  // handleDone 每次都送出整個 unit_data[12]（非局部 patch），若連續觸發（例如快速刪除
  // 兩個檔案）沒有排隊、直接平行送出，網路回應順序不保證跟送出順序一致，後到的回應會
  // 覆蓋掉先到的，导致其中一個刪除操作被悄悄復原。用 promise chain 強制排隊，保證後一次
  // 儲存一定等前一次真的寫進資料庫後才送出，不會互相蓋掉。
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

  const handleDone = useCallback((data: Unit12Data) => {
    setUnit12Data(data)
    const run = async () => {
      const cid = await ensureCampaign()
      if (!cid) return
      await patchCampaign(cid, { unit_data: { 12: data } })
    }
    const next = saveQueueRef.current.catch(() => {}).then(run)
    saveQueueRef.current = next
    return next
  }, [ensureCampaign])

  if (!loaded) return <div className="h-[calc(100vh-53px)] bg-white" />

  return (
    <div className="h-[calc(100vh-53px)] overflow-y-auto bg-white p-4 sm:p-6">
      <Unit12CustomerService
        campaignId={campaignId}
        savedData={unit12Data}
        unit2Data={companyData}
        industry={industry}
        initialTab={initialTab}
        onDone={handleDone}
      />
    </div>
  )
}
