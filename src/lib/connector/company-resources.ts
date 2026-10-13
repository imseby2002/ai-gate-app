// 公司帳號社群矩陣資源（後台控制）：官方 IP 附贈數、AdsPower 共享代管（環境數＋成員席次）與扣款。
// 企業版為方案內附贈、不扣點；一般公司版從公司錢包扣（扣點以公司建立者身分走 lib/skills/billing 的公司錢包）。
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/company/activeCompany'
import { deductCredits } from '@/lib/skills/billing'
import { notifyAdmin } from '@/lib/notify/adminAlert'
import { companyPeriodPrice, periodEnd, type BillingCycle } from './managed-pricing'

export type CompanyResources = {
  company_id: string
  isp_gift: number
  residential_gift: number
  adspower_mode: 'own' | 'managed'
  env_quota: number
  member_seats: number
  group_name: string | null
  status: 'inactive' | 'active' | 'suspended'
  billing_cycle: BillingCycle
  price_credits: number | null
  paid_until: string | null
  auto_renew: boolean
  admin_note: string | null
}

export const COMPANY_RESOURCE_DEFAULTS = {
  isp_gift: 0,
  residential_gift: 0,
  adspower_mode: 'own' as const,
  env_quota: 200,
  member_seats: 1,
  status: 'inactive' as const,
  billing_cycle: 'annual' as BillingCycle,
  auto_renew: true,
}

export function defaultCompanyGroupName(companyId: string) {
  return `AIGATE-C-${companyId.replace(/-/g, '').slice(0, 8)}`
}

/** 使用者目前所屬公司（右上角切換，否則 profiles.company_id）與該公司的資源設定；無公司回 null */
export async function getUserCompanyResources(userId: string): Promise<{ companyId: string; resources: CompanyResources | null } | null> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', userId).maybeSingle()
  const companyId = await resolveUserCompanyId(admin, userId, profile?.company_id ?? null)
  if (!companyId) return null
  const { data } = await admin
    .from('marketing_company_social_resources')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()
  return { companyId, resources: (data as CompanyResources | null) ?? null }
}

/** 公司在職成員的 user id */
export async function companyMemberIds(companyId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from('company_members')
    .select('member_id')
    .eq('company_id', companyId)
    .eq('status', 'active')
  return (data ?? []).map(m => m.member_id).filter(Boolean) as string[]
}

async function isEnterprise(admin: SupabaseClient, companyId: string): Promise<boolean> {
  const { data } = await admin.rpc('company_enterprise_active', { p_company_id: companyId })
  return !!data
}

/** 預收一期：企業版附贈不扣；一般公司版以公司建立者身分扣公司錢包 */
export async function chargeCompanyPeriod(
  admin: SupabaseClient,
  companyId: string,
  envs: number,
  seats: number,
  cycle: BillingCycle,
  reason: string,
) {
  if (await isEnterprise(admin, companyId)) return { ok: true as const, price: 0 }
  const price = companyPeriodPrice(envs, seats, cycle)
  const { data: company } = await admin.from('companies').select('created_by, name').eq('id', companyId).maybeSingle()
  if (!company?.created_by) return { ok: false as const, price, reason: 'error' as const }
  const res = await deductCredits(
    company.created_by,
    price,
    `AdsPower 共享代管 ${envs} 環境／${seats} 成員（${cycle === 'annual' ? '年付' : '月付'}）${reason}`,
  )
  return res.ok ? { ok: true as const, price } : { ok: false as const, price, reason: res.reason }
}

/** 開通或重新啟用公司代管：扣一期並寫入效期 */
export async function activateCompanyManaged(admin: SupabaseClient, r: CompanyResources) {
  const charge = await chargeCompanyPeriod(admin, r.company_id, r.env_quota, r.member_seats, r.billing_cycle, '開通')
  if (!charge.ok) return charge
  const now = new Date()
  const { error } = await admin
    .from('marketing_company_social_resources')
    .update({
      status: 'active',
      group_name: r.group_name || defaultCompanyGroupName(r.company_id),
      price_credits: charge.price,
      paid_until: periodEnd(now, r.billing_cycle),
      updated_at: now.toISOString(),
    })
    .eq('company_id', r.company_id)
  if (error) throw error
  return charge
}

/** 每日排程：到期的公司代管自動續扣，失敗或關閉自動續費則暫停並通知管理員 */
export async function renewExpiredCompanyManaged(admin: SupabaseClient) {
  const { data: rows, error } = await admin
    .from('marketing_company_social_resources')
    .select('*')
    .eq('adspower_mode', 'managed')
    .eq('status', 'active')
    .lte('paid_until', new Date().toISOString())
  if (error) throw error

  let renewed = 0
  const suspended: string[] = []
  for (const r of (rows ?? []) as CompanyResources[]) {
    const charge = r.auto_renew
      ? await chargeCompanyPeriod(admin, r.company_id, r.env_quota, r.member_seats, r.billing_cycle, '續費')
      : null
    const now = new Date().toISOString()
    if (charge?.ok) {
      await admin
        .from('marketing_company_social_resources')
        .update({ price_credits: charge.price, paid_until: periodEnd(new Date(r.paid_until ?? now), r.billing_cycle), updated_at: now })
        .eq('company_id', r.company_id)
      renewed++
    } else {
      await admin.from('marketing_company_social_resources').update({ status: 'suspended', updated_at: now }).eq('company_id', r.company_id)
      suspended.push(`公司 ${r.company_id}（分組 ${r.group_name ?? '—'}，${r.auto_renew ? '點數不足' : '未續費'}）`)
    }
  }
  if (suspended.length) {
    await notifyAdmin('AdsPower 公司共享代管已暫停', [
      '以下公司的共享代管到期未續費，已在 AI-GATE 暫停。請到 AdsPower 團隊後台停用對應成員：',
      ...suspended,
    ])
  }
  return { checked: rows?.length ?? 0, renewed, suspended: suspended.length }
}
