// 行銷模組扣點層：與專家技能共用同一套點數帳本（credit_transactions），
// 這裡集中各生成功能的計價常數與「執行前檢查、成功後扣點」流程。
// 計價原則：依實際 API 成本 ×3 左右加成，數字可隨供應商調價修改，改這裡即全站生效。
//
// 計費對象：只有 user_type === 'external'（付費客戶）才扣點，
// admin/employee 不計費 —— 比照全站既有慣例（api/chat、api/roundtable「Check
// credits for external users」、lib/skills/billing.ts 的 skills/run route、
// lib/resume/billing.ts）。這條規則晚於行銷模組原始設計，這裡補齊。
import { getBalance, deductCredits as deductCreditsRaw } from '@/lib/skills/billing'
import { getCompanyBillingContext } from '@/lib/company/entitlements'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMarketingEntitlements, type MarketingPlan } from './entitlements'

export { getBalance }

/**
 * 判斷這個帳號是否要為生成成本付費（僅 external 用戶計費）。
 * 用 service role 直接查 profiles，不依賴呼叫端是否有 request-scoped
 * Supabase client —— email-send route 走 cron-aware 的 getCronOrUserAuth()，
 * cron 情境下沒有使用者 session，此時視為不計費（cron 是系統內部動作，
 * 且沒有真實 profiles row 可查）。
 */
export async function isBillableUser(userId: string): Promise<boolean> {
  if (!userId || userId === 'cron-service') return false
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', userId)
    .maybeSingle()
  return profile?.user_type === 'external'
}

// ── 等級倍率計價 ─────────────────────────────────────────────────────────────
// 扣點 = 供應商實際成本（USD）× 方案倍率。付費方案的倍率套用在方案未內含的用量功能上。
// FREE ×2、CORE ×1.8、PRO ×1.6、MAX ×1.4
export const PLAN_COST_MULTIPLIER: Record<MarketingPlan, number> = {
  free: 2,
  pro: 1.8,
  team: 1.6,
  enterprise: 1.4,
}
// 非行銷模組（或無法判斷方案）時使用的倍率，等同 FREE
export const DEFAULT_COST_MULTIPLIER = PLAN_COST_MULTIPLIER.free

/** 取得帳號目前方案對應的成本倍率（依 lib/marketing/entitlements 判斷方案） */
export async function getCostMultiplier(userId: string): Promise<number> {
  try {
    const { plan } = await getMarketingEntitlements(null, userId)
    return PLAN_COST_MULTIPLIER[plan] ?? DEFAULT_COST_MULTIPLIER
  } catch {
    return DEFAULT_COST_MULTIPLIER
  }
}

/** 成本 × 倍率 → 扣點（四捨五入至小數第 4 位，最低 0.001） */
export function priceFromCost(costUsd: number, multiplier: number): number {
  if (!(costUsd > 0)) return 0
  return Math.max(0.001, Math.round(costUsd * multiplier * 10000) / 10000)
}

// ── 供應商成本（USD）────────────────────────────────────────────────────────
// 圖片（每張）。flux / nano 等舊模型 id 目前皆走 Nano Banana Pro（Google 直連 1K/2K $0.134）
export const NANO_BANANA_PRO_GOOGLE_COST = 0.134
export const NANO_BANANA_PRO_FAL_COST = 0.15
export const NANO_BANANA_PRO_FAL_REF_IMAGE_COST = 0.067
export const IMAGE_PROVIDER_COSTS: Record<string, number> = {
  dalle3: 0.04,
  flux: NANO_BANANA_PRO_GOOGLE_COST,
  'flux-1-pro': NANO_BANANA_PRO_GOOGLE_COST,
  nano: NANO_BANANA_PRO_GOOGLE_COST,
  'nano-banana': NANO_BANANA_PRO_GOOGLE_COST,
  ideogram: 0.06, // Ideogram v3 BALANCED
}
// 非行銷模組沿用的每張定價（成本 × FREE 倍率）
export const IMAGE_COSTS: Record<string, number> = Object.fromEntries(
  Object.entries(IMAGE_PROVIDER_COSTS).map(([k, v]) => [k, priceFromCost(v, DEFAULT_COST_MULTIPLIER)]),
)
// 舊常數名稱相容（Nano Banana Pro 每張，FREE 倍率）
export const NANO_BANANA_PRO_COST = IMAGE_COSTS.flux

// 影片（每秒）：Kling v1.6（fal）standard $0.056／pro $0.094；Veo 3.1 720p/1080p $0.40；Sora 2 Pro 1080p $0.70
const VIDEO_COST_PER_SECOND: Record<string, number> = {
  'kling-standard': 0.056,
  'kling-img2video': 0.056,
  'kling-pro': 0.094,
  veo3: 0.4,
  'veo3-img2video': 0.4,
  sora: 0.7,
  'sora-img2video': 0.7,
}
export function videoProviderCost(model: string, durationSeconds: number): number {
  const perSec = VIDEO_COST_PER_SECOND[model] ?? VIDEO_COST_PER_SECOND['kling-standard']
  return perSec * Math.max(1, Math.round(durationSeconds || 5))
}
/** 影片扣點（預設 FREE 倍率；行銷模組傳入方案倍率） */
export function videoCost(model: string, durationSeconds: number, multiplier = DEFAULT_COST_MULTIPLIER): number {
  return priceFromCost(videoProviderCost(model, durationSeconds), multiplier)
}

// LLM（每百萬 token，USD）：Claude 依 Anthropic 官方價；Gemini 2.5 Flash 依 Google 公開價
const LLM_PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  // DeepSeek 各來源報價不一，取較高者 $0.27／$1.10
  'deepseek-chat': { input: 0.27, output: 1.1 },
}

// 外部資料來源（每次／每筆，USD）
// Tavily advanced search：2 credits × $0.008；Outscraper：$3／1,000 筆（超過每月免費額度後，保守一律計入）
export const TAVILY_ADVANCED_SEARCH_COST = 0.016
export const OUTSCRAPER_RECORD_COST = 0.003
// 一鍵發布：每個平台每則（固定扣點，不乘倍率）
export const PUBLISH_PER_POST_CREDITS = 0.01
/** 依實際 token 用量計算成本（usage 取自 AI SDK 回傳） */
export function llmCost(model: string, usage?: { inputTokens?: number; outputTokens?: number } | null): number {
  const p = LLM_PRICES[model]
  if (!p || !usage) return 0
  return ((usage.inputTokens ?? 0) * p.input + (usage.outputTokens ?? 0) * p.output) / 1_000_000
}

// HeyGen 虛擬主播影片（每支）
export const HEYGEN_VIDEO_COST = 1.0
// ElevenLabs TTS（每次合成）
export const TTS_COST = 0.03

// ── 電話／簡訊／Email 供應商成本（USD），扣點＝成本 × 方案倍率 ────────────────
export type TelcoCountry = 'TW' | 'VN' | 'US' | 'INTL'

/** 依門號判斷國別（+1 北美走 US） */
export function detectTelcoCountry(rawPhone: string): TelcoCountry {
  const cleaned = rawPhone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+886') || cleaned.startsWith('886')) return 'TW'
  if (cleaned.startsWith('09') && cleaned.length === 10) return 'TW'
  if (cleaned.startsWith('+84') || cleaned.startsWith('84')) return 'VN'
  if (/^0[35789]\d{8}$/.test(cleaned)) return 'VN'
  if (cleaned.startsWith('+1') || (cleaned.startsWith('1') && cleaned.length === 11)) return 'US'
  return 'INTL'
}

function isTwMobile(rawPhone: string): boolean {
  const d = rawPhone.replace(/\D/g, '')
  return d.startsWith('8869') || d.startsWith('09')
}

// 語音（每分鐘，未滿 1 分鐘以 1 分鐘計，與 Twilio 計費方式一致）
// Twilio 台灣：手機 $0.1985、市話 $0.1196；美國 $0.013；越南手機 $0.1777
// Stringee 越南境內：約 NT$0.8~1.2／分，取 $0.04；其他國家未逐一建表，保守取 $0.20
export function voiceCostPerMinute(phone: string, provider: string): number {
  const country = detectTelcoCountry(phone)
  if (country === 'TW') return isTwMobile(phone) ? 0.1985 : 0.1196
  if (country === 'US') return 0.013
  if (country === 'VN') return provider === 'stringee' ? 0.04 : 0.1777
  return 0.2
}

export function callCost(phone: string, provider: string, durationSec: number): number {
  if (!(durationSec > 0)) return 0
  return Math.ceil(durationSec / 60) * voiceCostPerMinute(phone, provider)
}

// 簡訊（每段）：台灣 sms-get NT$0.86 ≈ $0.027；美國 Bird $0.0035；
// 越南 Stringee 約 NT$0.55~0.8 ≈ $0.025；其他國家（Twilio）未逐一建表，保守取 $0.10
const SMS_SEGMENT_COSTS: Record<TelcoCountry, number> = { TW: 0.027, US: 0.0035, VN: 0.025, INTL: 0.1 }

// GSM-7 基本字元集（含常用符號）；出現其他字元（中文、emoji 等）即改 UCS-2
const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/

/** 簡訊分段數：GSM-7 單則 160／長簡訊每段 153；UCS-2 單則 70／每段 67 */
export function smsSegments(text: string): number {
  const len = [...text].length
  if (len === 0) return 1
  const [single, multi] = GSM7.test(text) ? [160, 153] : [70, 67]
  return len <= single ? 1 : Math.ceil(len / multi)
}

export function smsCost(phone: string, text: string): number {
  return smsSegments(text) * SMS_SEGMENT_COSTS[detectTelcoCountry(phone)]
}

// Email（每封）：Resend 超量 $0.90／1,000 封
export const EMAIL_SEND_COST = 0.0009
// AI 視覺工坊「AI 建議」（Claude 看圖，每次）
export const AI_STUDIO_SUGGEST_COST = 0.01
// AI 視覺工坊節點執行的預估上限（實際依節點回報的 cost 扣）
export const AI_STUDIO_MAX_ESTIMATE = 0.2

// 自製專家：建立來源（訓練）與問答的計價
// 建立來源：網址每則 0.02；檔案／文字每 1000 字 0.01（萃取＋儲存成本）
export const EXPERT_SOURCE_URL_COST = 0.02
export const EXPERT_SOURCE_PER_1K_CHARS = 0.01
export function expertSourceCost(type: 'url' | 'file' | 'text', charCount: number): number {
  const base = type === 'url' ? EXPERT_SOURCE_URL_COST : 0
  return Math.round((base + (charCount / 1000) * EXPERT_SOURCE_PER_1K_CHARS) * 1000) / 1000
}
// 問答：知識庫塞進 context，input token 偏高，每次固定 0.05
export const EXPERT_QUERY_COST = 0.05

// ── 每月贈點（當月用完即止、不累積；見 supabase/migrations/20261003_marketing_monthly_gift.sql）──
// FREE 需完成 Email 驗證才發放；公司方案成員改用公司錢包，不另給個人贈點
export const MONTHLY_GIFT_CREDITS: Record<MarketingPlan, number> = {
  free: 1,
  pro: 10,
  team: 20,
  enterprise: 35,
}

async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(userId)
    return !!data?.user?.email_confirmed_at
  } catch {
    return false
  }
}

/** 本月可領的贈點額度（依方案；FREE 未驗證 Email 為 0） */
export async function getMonthlyGiftAllowance(userId: string): Promise<number> {
  if (await getCompanyBillingContext(userId)) return 0
  const { plan } = await getMarketingEntitlements(null, userId)
  if (plan === 'free' && !(await isEmailVerified(userId))) return 0
  return MONTHLY_GIFT_CREDITS[plan] ?? 0
}

/** 本月剩餘贈點 */
export async function getMonthlyGiftRemaining(userId: string): Promise<number> {
  const allowance = await getMonthlyGiftAllowance(userId)
  const { data, error } = await createAdminClient().rpc('get_marketing_gift', { p_user_id: userId, p_allowance: allowance })
  if (error) {
    console.error('[marketing billing] 讀取每月贈點失敗', { userId, error })
    return 0
  }
  return Number(data ?? 0)
}

/**
 * 執行前餘額檢查（本月贈點 + 個人餘額）。不足時回傳 402 的 payload（餘額、需要多少），
 * route 直接 `return NextResponse.json(check.payload, { status: 402 })`。
 * billable=false（admin/employee/cron）一律放行，不查餘額。
 */
export async function checkCredits(
  userId: string,
  estimate: number,
  billable: boolean,
): Promise<{ ok: true; balance: number } | { ok: false; payload: { error: string; balance: number; required: number } }> {
  if (!billable) return { ok: true, balance: Infinity }
  const [balance, gift] = await Promise.all([getBalance(userId), getMonthlyGiftRemaining(userId)])
  const total = balance + gift
  if (total < estimate) {
    return { ok: false, payload: { error: '點數不足', balance: total, required: estimate } }
  }
  return { ok: true, balance: total }
}

/**
 * 成功後扣點：先扣本月贈點，不足再扣個人餘額。billable=false（admin/employee/cron）一律略過。
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  billable: boolean,
): Promise<{ ok: true; balance: number } | { ok: false; reason: 'insufficient' | 'error' }> {
  if (!billable) return { ok: true, balance: Infinity }
  let fromGift = 0
  if (amount > 0) {
    const allowance = await getMonthlyGiftAllowance(userId)
    if (allowance > 0) {
      const { data, error } = await createAdminClient().rpc('consume_marketing_gift', {
        p_user_id: userId,
        p_allowance: allowance,
        p_amount: amount,
        p_description: description,
      })
      if (error) console.error('[marketing billing] 扣每月贈點失敗，改扣個人餘額', { userId, error })
      else fromGift = Number(data ?? 0)
    }
  }
  const rest = Math.round((amount - fromGift) * 10000) / 10000
  if (rest <= 0) {
    return { ok: true, balance: (await getBalance(userId)) + (await getMonthlyGiftRemaining(userId)) }
  }
  return deductCreditsRaw(userId, rest, description)
}

/**
 * 依用量計價功能的執行前檢查：預估成本 × 方案倍率，餘額不足時回傳 402 payload，足夠回傳 null。
 * 非付費帳號（admin／employee／cron）一律放行。
 */
export async function precheckUsage(
  userId: string,
  estimateUsd: number,
): Promise<{ error: string; balance: number; required: number } | null> {
  const billable = await isBillableUser(userId)
  if (!billable) return null
  const required = priceFromCost(estimateUsd, await getCostMultiplier(userId))
  const check = await checkCredits(userId, required, billable)
  return check.ok ? null : check.payload
}

/**
 * 依用量計價功能的執行後扣點：實際成本 × 方案倍率。扣點失敗只記錄、不影響已完成的結果。
 * 回傳實際扣除的點數（非付費帳號為 0）。
 */
export async function chargeUsage(userId: string, costUsd: number, description: string): Promise<number> {
  const billable = await isBillableUser(userId)
  if (!billable || !(costUsd > 0)) return 0
  const amount = priceFromCost(costUsd, await getCostMultiplier(userId))
  const res = await deductCredits(userId, amount, description, billable)
  if (!res.ok) console.error('[marketing billing] 扣點失敗', { userId, amount, description, reason: res.reason })
  return amount
}
