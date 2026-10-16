// 代管 AdsPower 扣款與續費：開通／重新啟用時預收一期，到期由每日排程自動續扣，點數不足則暫停。
import type { SupabaseClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/skills/billing'
import { isBillableUser } from '@/lib/marketing/billing'
import { notifyAdmin } from '@/lib/notify/adminAlert'
import { periodPrice, periodEnd, type BillingCycle } from './managed-pricing'

const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: '月付', annual: '年付' }

/** 預收一期費用；非付費帳號（管理員／員工）不扣點 */
export async function chargeManagedPeriod(userId: string, envs: number, cycle: BillingCycle, reason: string, companyId?: string | null) {
  const price = periodPrice(envs, cycle)
  if (!(await isBillableUser(userId))) return { ok: true as const, price: 0 }
  // 申請時記錄的公司優先（扣該公司錢包）；沒有則依使用者預設公司
  const res = await deductCredits(userId, price, `AdsPower 代管 ${envs} 環境（${CYCLE_LABEL[cycle]}）${reason}`, companyId)
  return res.ok ? { ok: true as const, price } : { ok: false as const, price, reason: res.reason }
}

/** 開通或重新啟用：扣一期並寫入到期日 */
export async function activateManaged(
  admin: SupabaseClient,
  userId: string,
  envs: number,
  cycle: BillingCycle,
  extra: Record<string, unknown> = {},
) {
  const { data: row } = await admin.from('marketing_adspower_managed').select('company_id').eq('user_id', userId).maybeSingle()
  const charge = await chargeManagedPeriod(userId, envs, cycle, '開通', row?.company_id ?? null)
  if (!charge.ok) return charge
  const now = new Date()
  const { error } = await admin
    .from('marketing_adspower_managed')
    .update({
      ...extra,
      status: 'active',
      env_quota: envs,
      billing_cycle: cycle,
      price_credits: charge.price,
      paid_until: periodEnd(now, cycle),
      next_env_quota: null,
      next_billing_cycle: null,
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw error
  return charge
}

/** 每日排程：到期者依（下期）額度與週期續扣，失敗或關閉自動續費則暫停並通知管理員停用 AdsPower 成員 */
export async function renewExpiredManaged(admin: SupabaseClient) {
  const { data: rows, error } = await admin
    .from('marketing_adspower_managed')
    .select('user_id, company_id, login_account, group_name, env_quota, billing_cycle, auto_renew, paid_until, next_env_quota, next_billing_cycle')
    .eq('status', 'active')
    .lte('paid_until', new Date().toISOString())
  if (error) throw error

  let renewed = 0
  const suspended: string[] = []
  for (const r of rows ?? []) {
    const envs = r.next_env_quota ?? r.env_quota
    const cycle = (r.next_billing_cycle ?? r.billing_cycle) as BillingCycle
    const charge = r.auto_renew ? await chargeManagedPeriod(r.user_id, envs, cycle, '續費', r.company_id) : null
    const now = new Date().toISOString()
    if (charge?.ok) {
      await admin
        .from('marketing_adspower_managed')
        .update({
          env_quota: envs,
          billing_cycle: cycle,
          price_credits: charge.price,
          paid_until: periodEnd(new Date(r.paid_until), cycle),
          next_env_quota: null,
          next_billing_cycle: null,
          updated_at: now,
        })
        .eq('user_id', r.user_id)
      renewed++
    } else {
      await admin.from('marketing_adspower_managed').update({ status: 'suspended', updated_at: now }).eq('user_id', r.user_id)
      suspended.push(`${r.login_account ?? r.user_id}（分組 ${r.group_name ?? '—'}，${r.auto_renew ? '點數不足' : '未續費'}）`)
    }
  }

  if (suspended.length) {
    await notifyAdmin('AdsPower 代管帳號已暫停', [
      '以下代管帳號到期未續費，已在 AI-GATE 暫停。請到 AdsPower 團隊後台停用對應成員：',
      ...suspended,
    ])
  }
  return { checked: rows?.length ?? 0, renewed, suspended: suspended.length }
}
