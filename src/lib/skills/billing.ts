// Skill 點數計價共用層（server-side，使用 service-role 略過 RLS）
import { createAdminClient } from '@/lib/supabase/admin'

// 查詢使用者點數餘額（以 credit_transactions 加總為真相來源）
export async function getBalance(userId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin.rpc('get_credit_balance', { p_user_id: userId })
  return Number(data ?? 0)
}

// 原子扣點；餘額不足回 { ok: false, reason: 'insufficient' }
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
): Promise<{ ok: true; balance: number } | { ok: false; reason: 'insufficient' | 'error' }> {
  if (amount <= 0) return { ok: true, balance: await getBalance(userId) }
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('deduct_skill_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
  })
  if (error) {
    return { ok: false, reason: error.message?.includes('INSUFFICIENT_CREDITS') ? 'insufficient' : 'error' }
  }
  return { ok: true, balance: Number(data) }
}

// 紀錄一次 skill 執行
export async function logSkillRun(params: {
  userId: string
  skillId: string
  input: Record<string, unknown>
  output: string
  creditsSpent: number
  status: 'success' | 'error'
  error?: string
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('skill_runs').insert({
    user_id: params.userId,
    skill_id: params.skillId,
    input: params.input,
    output: params.output.slice(0, 20000),
    credits_spent: params.creditsSpent,
    status: params.status,
    error: params.error ?? null,
  })
}
