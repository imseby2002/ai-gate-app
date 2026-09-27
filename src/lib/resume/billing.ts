// resume / work 模組 AI 工具的計費與存取守衛
// 比照 skills（api/skills/run）：模組權限 + 執行前餘額檢查，計價共用 skills/billing。
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBalance } from '@/lib/skills/billing'
import {
  getModuleEntitlements, planRequiredResponse, consumeMonthlyQuota, quotaExceededResponse,
} from '@/lib/module-plans/entitlements'
import { RESUME_TOOL_CATEGORY, RESUME_CATEGORY_LABEL, minPlanLabel } from '@/lib/module-plans/definitions'

// 各工具固定扣點（單位與 credit_transactions.amount_usd 相同）
export const RESUME_COSTS = {
  'resume-optimize': 0.05, // 兩階段（分析 + 撰寫），較重
  'cover-letter': 0.02,
  'worker-tools': 0.02,
} as const

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// 認證後的模組權限 + 餘額檢查。
// error 為 null 代表通過，可直接 return 呼叫端的 Response（401/403/402）。
// billable：只有 external（付費客戶）才會被扣點與受餘額限制；admin/employee
// 為內部帳號，比照 chat/roundtable 的既有慣例（見 api/chat/route.ts「Check
// credits for external users」），一律不計費，呼叫端應依此跳過 deductCredits。
export interface ResumeAccessResult {
  error: Response | null
  billable: boolean
}

export async function guardResumeAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  cost: number,
): Promise<ResumeAccessResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, is_active, enabled_modules')
    .eq('id', userId)
    .single()

  if (!profile) return { error: json({ error: 'Unauthorized' }, 401), billable: false }
  if (profile.is_active === false) return { error: json({ error: '帳號已停用' }, 403), billable: false }

  // 模組權限：admin 全開，其他看 enabled_modules（比照 skills/run 的預設）
  if (profile.user_type !== 'admin') {
    const enabled: string[] = profile.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume', 'booking']
    if (!enabled.includes('resume')) {
      return { error: json({ error: '未開通模組：resume' }, 403), billable: false }
    }
  }

  const billable = profile.user_type === 'external'
  if (billable) {
    const balance = await getBalance(userId)
    if (balance < cost) {
      return { error: json({ error: '點數不足', balance, required: cost }, 402), billable }
    }
  }

  return { error: null, billable }
}

/**
 * 職場助手方案檢查（lib/module-plans/definitions.ts）：工具分類是否開放、履歷優化／求職信每月次數。
 * 在 guardResumeAccess 通過後、扣點前呼叫；回傳 Response 代表不允許。內部帳號為 MAX 不受限。
 */
export async function checkResumePlan(userId: string, toolId: string): Promise<Response | null> {
  const { plan, features } = await getModuleEntitlements(userId, 'resume')

  const category = RESUME_TOOL_CATEGORY[toolId]
  if (!category) return json({ error: `未知的工具：${toolId}` }, 400)
  if (!features.categories.includes(category)) {
    return planRequiredResponse(
      `「${RESUME_CATEGORY_LABEL[category]}」工具需職場助手 ${minPlanLabel('resume', f => f.categories.includes(category))}方案`,
      plan,
    )
  }

  const limit = toolId === 'resume-optimize' ? features.optimizeMonthlyLimit
    : toolId === 'cover-letter' ? features.coverLetterMonthlyLimit
    : Infinity
  if (!await consumeMonthlyQuota(userId, 'resume', toolId, limit)) {
    const name = toolId === 'resume-optimize' ? '履歷優化' : '求職信'
    return quotaExceededResponse(`本月${name} ${limit} 次已用完，CORE 以上不限次數`, plan)
  }
  return null
}

/** 求職信模板是否在方案可用範圍內（依 sort_order 前 N 個；MAX 全部） */
export async function allowedCoverLetterTemplateIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<Set<string> | null> {
  const { features } = await getModuleEntitlements(userId, 'resume')
  if (features.templateLimit === Infinity) return null
  const { data } = await supabase
    .from('cover_letter_templates')
    .select('id')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(features.templateLimit)
  return new Set((data ?? []).map((t: { id: string }) => t.id))
}
