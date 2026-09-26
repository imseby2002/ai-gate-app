// 官方發文 IP 點數計費：方案附贈以外的額外 IP，每 30 天以點數扣款一次。
// 點數＝美金（與全站 credit_transactions 同一本帳），價格由 monthly_price_twd 依即時匯率換算。
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUsdToTwdRate } from '@/lib/fx'
import { deductCredits } from '@/lib/skills/billing'
import { isBillableUser } from '@/lib/marketing/billing'

export const LEASE_PERIOD_DAYS = 30

export function twdToCredits(twd: number, usdTwdRate: number): number {
  return Math.ceil((twd / usdTwdRate) * 100) / 100
}

export async function officialProxyCredits(monthlyPriceTwd: number): Promise<number> {
  return twdToCredits(monthlyPriceTwd, await getUsdToTwdRate())
}

export function nextExpiry(from: Date = new Date()): string {
  return new Date(from.getTime() + LEASE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

// 到期或退租：租用紀錄改狀態、移除代理池節點、官方 IP 空出名額
export async function releaseLease(
  admin: SupabaseClient,
  lease: { id: string; official_proxy_id: string },
  status: 'expired' | 'canceled',
) {
  const now = new Date().toISOString()
  await admin.from('marketing_proxy_leases').update({ status, updated_at: now }).eq('id', lease.id)
  await admin.from('marketing_proxies').delete().eq('lease_id', lease.id)
  const { data: off } = await admin
    .from('marketing_official_proxies')
    .select('current_tenants_count')
    .eq('id', lease.official_proxy_id)
    .maybeSingle()
  if (off) {
    await admin
      .from('marketing_official_proxies')
      .update({ current_tenants_count: Math.max(0, (off.current_tenants_count ?? 1) - 1), status: 'available', updated_at: now })
      .eq('id', lease.official_proxy_id)
  }
}

// 每日排程：到期的付費租用，點數足夠且開啟自動續約就續扣 30 天，否則到期釋放
export async function renewExpiredPaidLeases(admin: SupabaseClient) {
  const { data: leases, error } = await admin
    .from('marketing_proxy_leases')
    .select('id, user_id, official_proxy_id, price_credits, auto_renew, expires_at, official_proxy:marketing_official_proxies(name, monthly_price_twd)')
    .eq('status', 'active')
    .eq('is_paid', true)
    .lte('expires_at', new Date().toISOString())
  if (error) throw error

  let renewed = 0
  let expired = 0
  for (const lease of leases ?? []) {
    const off = (Array.isArray(lease.official_proxy) ? lease.official_proxy[0] : lease.official_proxy) as
      { name?: string; monthly_price_twd?: number } | null
    const price = off?.monthly_price_twd != null ? await officialProxyCredits(off.monthly_price_twd) : Number(lease.price_credits ?? 0)
    const billable = await isBillableUser(lease.user_id)

    let ok = false
    if (lease.auto_renew && price > 0) {
      ok = !billable || (await deductCredits(lease.user_id, price, `官方發文 IP 續租 30 天：${off?.name ?? lease.official_proxy_id}`)).ok
    }

    if (ok) {
      await admin
        .from('marketing_proxy_leases')
        .update({ expires_at: nextExpiry(new Date(lease.expires_at)), price_credits: price, updated_at: new Date().toISOString() })
        .eq('id', lease.id)
      renewed++
    } else {
      await releaseLease(admin, lease, 'expired')
      expired++
    }
  }
  return { checked: leases?.length ?? 0, renewed, expired }
}
