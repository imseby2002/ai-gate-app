// 公司版扣點情境（伺服器端專用）：依右上角切換的公司判斷。
// 獨立於 lib/company/entitlements.ts，因為後者也被前端元件引用，不能帶入 next/headers。
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/company/activeCompany'
import type { CompanyBillingContext } from '@/lib/company/entitlements'

/**
 * userId 目前所屬公司若有有效的公司版（'company' 方案），回傳公司 id 與是否為專屬客製-企業版；否則 null。
 * 公司預設依右上角切換（本人請求時），否則 profiles.company_id；companyIdOverride 可指定（如代管申請時記錄的公司）。
 * 扣點（lib/skills/billing.ts）、CHAT 限制、意見反映計費都依此判斷。
 */
export async function getCompanyBillingContext(userId: string, companyIdOverride?: string | null): Promise<CompanyBillingContext | null> {
  const admin = createAdminClient()
  let companyId = companyIdOverride ?? null
  if (!companyId) {
    const { data: profile } = await admin.from('profiles').select('company_id').eq('id', userId).maybeSingle()
    companyId = await resolveUserCompanyId(admin, userId, profile?.company_id ?? null)
  }
  if (!companyId) return null
  const [{ data: active, error }, { data: enterprise, error: entErr }] = await Promise.all([
    admin.rpc('company_plan_active', { p_company_id: companyId }),
    admin.rpc('company_enterprise_active', { p_company_id: companyId }),
  ])
  if (error || entErr) {
    console.error('[company entitlements] 公司方案狀態查詢失敗', { userId, error: error ?? entErr })
    return null
  }
  return active ? { companyId, enterprise: !!enterprise } : null
}

/** 扣點改走公司錢包時的公司 id（有效公司版才有）；否則 null */
export async function getBillingCompanyId(userId: string): Promise<string | null> {
  return (await getCompanyBillingContext(userId))?.companyId ?? null
}
