// Skill 點數計價共用層（server-side，使用 service-role 略過 RLS）
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyBillingContext } from '@/lib/company/entitlements'
import { checkEnterpriseCostAlert } from '@/lib/company/enterprise'

// 查詢使用者可用點數。專屬客製-企業版不限點數（Infinity）；公司版回傳公司錢包餘額（本月贈點＋儲值）；
// 否則為個人餘額（以 credit_transactions 加總為真相來源）。
export async function getBalance(userId: string): Promise<number> {
  const admin = createAdminClient()
  const company = await getCompanyBillingContext(userId)
  if (company?.enterprise) return Infinity
  if (company) {
    const { data } = await admin.rpc('get_company_credit_balance', { p_company_id: company.companyId })
    const row = Array.isArray(data) ? data[0] : data
    return Number(row?.gift ?? 0) + Number(row?.paid ?? 0)
  }
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
  const company = await getCompanyBillingContext(userId)
  // 專屬客製-企業版：不扣點，只記錄用量並檢查成本警示
  if (company?.enterprise) {
    const { error } = await admin.rpc('record_company_usage', {
      p_company_id: company.companyId,
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
    })
    if (error) console.error('[billing] 企業版用量記錄失敗', { userId, companyId: company.companyId, amount, error })
    void checkEnterpriseCostAlert(company.companyId)
    return { ok: true, balance: Infinity }
  }
  // 公司版成員：從公司錢包扣（先扣本月贈點，再扣儲值）
  if (company) {
    const { data, error } = await admin.rpc('deduct_company_credits', {
      p_company_id: company.companyId,
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
    })
    if (error) {
      return { ok: false, reason: error.message?.includes('INSUFFICIENT_CREDITS') ? 'insufficient' : 'error' }
    }
    return { ok: true, balance: Number(data) }
  }
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
