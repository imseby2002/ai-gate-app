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

// 圖片生成（每張）
export const IMAGE_COSTS: Record<string, number> = {
  dalle3: 0.08,
  flux: 0.05,
  'flux-1-pro': 0.05,
  nano: 0.02,
  'nano-banana': 0.02,
}

// 影片生成（每 5 秒為一單位計）
const VIDEO_COST_PER_5S: Record<string, number> = {
  'kling-standard': 0.5,
  'kling-pro': 1.0,
  'kling-img2video': 0.5,
}
// 固定長度模型（veo3 約 25 秒、sora 約 60 秒）採單支計價
const VIDEO_FLAT_COST: Record<string, number> = {
  veo3: 2.5,
  'veo3-img2video': 2.5,
  sora: 5.0,
  'sora-img2video': 5.0,
}

export function videoCost(model: string, durationSeconds: number): number {
  if (model in VIDEO_FLAT_COST) return VIDEO_FLAT_COST[model]
  const per5s = VIDEO_COST_PER_5S[model] ?? 0.5
  return per5s * Math.max(1, Math.ceil(durationSeconds / 5))
}

// HeyGen 虛擬主播影片（每支）
export const HEYGEN_VIDEO_COST = 1.0
// ElevenLabs TTS（每次合成）
export const TTS_COST = 0.03
// 電話撥打（每通，內含通話費加成；TTS 另計）
export const CALL_COST = 0.15
// 行銷 Email（每封）
export const EMAIL_COST = 0.002
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
