// 行銷模組扣點層：與專家技能共用同一套點數帳本（credit_transactions），
// 這裡集中各生成功能的計價常數與「執行前檢查、成功後扣點」流程。
// 計價原則：依實際 API 成本 ×3 左右加成，數字可隨供應商調價修改，改這裡即全站生效。
//
// 計費對象：只有 user_type === 'external'（付費客戶）才扣點，
// admin/employee 不計費 —— 比照全站既有慣例（api/chat、api/roundtable「Check
// credits for external users」、lib/skills/billing.ts 的 skills/run route、
// lib/resume/billing.ts）。這條規則晚於行銷模組原始設計，這裡補齊。
import { getBalance, deductCredits as deductCreditsRaw } from '@/lib/skills/billing'
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
// 電話撥打（每通，內含通話費加成；TTS 另計）
export const CALL_COST = 0.15
// 行銷 Email（每封）
export const EMAIL_COST = 0.002
// 行銷 SMS 簡訊（每則，依通道成本加成，約合 NT$ 1）
export const SMS_COST = 0.035
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

/**
 * 執行前餘額檢查。不足時回傳 402 的 payload（餘額、需要多少），
 * route 直接 `return NextResponse.json(check.payload, { status: 402 })`。
 * billable=false（admin/employee/cron）一律放行，不查餘額。
 */
export async function checkCredits(
  userId: string,
  estimate: number,
  billable: boolean,
): Promise<{ ok: true; balance: number } | { ok: false; payload: { error: string; balance: number; required: number } }> {
  if (!billable) return { ok: true, balance: Infinity }
  const balance = await getBalance(userId)
  if (balance < estimate) {
    return { ok: false, payload: { error: '點數不足', balance, required: estimate } }
  }
  return { ok: true, balance }
}

/**
 * 成功後扣點。billable=false（admin/employee/cron）一律略過，不寫入 credit_transactions。
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  billable: boolean,
): Promise<{ ok: true; balance: number } | { ok: false; reason: 'insufficient' | 'error' }> {
  if (!billable) return { ok: true, balance: Infinity }
  return deductCreditsRaw(userId, amount, description)
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
