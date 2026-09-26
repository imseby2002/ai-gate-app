// admin 公司列表（含成員、方案、公司錢包、企業版用量）。
// /admin/companies 頁面首次載入與 GET /api/admin/companies 共用，兩邊資料一致——
// 之前頁面自己查一份不含方案欄位的資料，重新整理後對話框會把方案顯示成 FREE，
// 此時儲存會把企業版誤降成 FREE。
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin'
import { getEnterpriseMonthUsage } from '@/lib/company/enterprise'

export async function loadAdminCompanyList() {
  const admin = createAdminClient()
  const [
    { data: companies, error: compErr },
    { data: members, error: memErr },
    { data: profiles, error: profErr },
    { data: subscriptions },
  ] = await Promise.all([
    admin.from('companies').select('*').order('created_at', { ascending: false }),
    admin.from('company_members').select('*').order('created_at', { ascending: true }),
    admin.from('profiles').select('id, email, full_name'),
    admin.from('company_subscriptions').select('company_id, plan, current_period_end, erp_seats, retail_stores, custom_domain, enterprise, enterprise_monthly_usd, cost_alert_ratio'),
  ])

  if (compErr) throw new Error(compErr.message)

  const profMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const planMap = new Map((subscriptions ?? []).map(s => [s.company_id, s]))

  // 組織每間公司的成員資料
  const membersByCompany = new Map<string, any[]>()
  for (const m of members ?? []) {
    const list = membersByCompany.get(m.company_id) ?? []
    list.push({
      ...m,
      profile: m.member_id ? profMap.get(m.member_id) ?? null : null,
    })
    membersByCompany.set(m.company_id, list)
  }

  // 公司錢包餘額（本月贈點＋儲值），每間公司一次 RPC
  const walletEntries = await Promise.all((companies ?? []).map(async c => {
    const { data } = await admin.rpc('get_company_credit_balance', { p_company_id: c.id })
    const row = Array.isArray(data) ? data[0] : data
    return [c.id, { gift: Number(row?.gift ?? 0), paid: Number(row?.paid ?? 0) }] as const
  }))
  const walletMap = new Map(walletEntries)

  // 專屬客製-企業版：本月用量（以點數計），供後台對照議價月費
  const usageEntries = await Promise.all((subscriptions ?? []).filter(s => s.enterprise).map(async s =>
    [s.company_id, await getEnterpriseMonthUsage(s.company_id)] as const))
  const usageMap = new Map(usageEntries)

  const result = (companies ?? []).map(c => {
    const compMembers = membersByCompany.get(c.id) ?? []
    const ownerMember = compMembers.find(m => m.role === 'owner' && m.status === 'active')
    const itMember = compMembers.find(m => m.role === 'admin' && m.status === 'active')
    const creatorProfile = profMap.get(c.created_by) ?? null
    return {
      ...c,
      creator: creatorProfile,
      owner: ownerMember?.profile ?? null,
      it: itMember?.profile ?? null,
      memberCount: compMembers.filter(m => m.status === 'active').length,
      pendingCount: compMembers.filter(m => m.status === 'pending').length,
      members: compMembers,
      plan: planMap.get(c.id)?.plan ?? 'free',
      currentPeriodEnd: planMap.get(c.id)?.current_period_end ?? null,
      erpSeats: planMap.get(c.id)?.erp_seats ?? 0,
      retailStores: planMap.get(c.id)?.retail_stores ?? 0,
      customDomain: planMap.get(c.id)?.custom_domain ?? false,
      wallet: walletMap.get(c.id) ?? { gift: 0, paid: 0 },
      enterprise: planMap.get(c.id)?.enterprise ?? false,
      enterpriseMonthlyUsd: planMap.get(c.id)?.enterprise_monthly_usd ?? null,
      costAlertRatio: planMap.get(c.id)?.cost_alert_ratio ?? 0.5,
      enterpriseUsage: usageMap.get(c.id) ?? null,
    }
  })

  return result
}
