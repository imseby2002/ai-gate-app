// 代管 AdsPower 定價（USD＝點數）：每月成員費 3 + 環境費（累進），年付一次預付 12 個月。
// 級距與單價經使用者確認；每格皆低於客人自購 AdsPower 同週期價格。
export type BillingCycle = 'monthly' | 'annual'

export const MANAGED_PACKAGES = [10, 20, 50, 100, 200] as const
export const MEMBER_FEE = 3

// [級距上限, 每環境月費]
const TIERS: Record<BillingCycle, [number, number][]> = {
  monthly: [[50, 0.22], [100, 0.2], [200, 0.19]],
  annual: [[50, 0.18], [100, 0.16], [200, 0.15]],
}

export const PERIOD_DAYS: Record<BillingCycle, number> = { monthly: 30, annual: 365 }

export function isPackage(n: unknown): n is (typeof MANAGED_PACKAGES)[number] {
  return MANAGED_PACKAGES.includes(n as (typeof MANAGED_PACKAGES)[number])
}

export function isCycle(c: unknown): c is BillingCycle {
  return c === 'monthly' || c === 'annual'
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** 換算每月費用（累進計價） */
export function monthlyPrice(envs: number, cycle: BillingCycle): number {
  let total = MEMBER_FEE
  let prev = 0
  for (const [cap, rate] of TIERS[cycle]) {
    if (envs <= prev) break
    total += (Math.min(envs, cap) - prev) * rate
    prev = cap
  }
  return round2(total)
}

/** 每期扣款金額：月付 1 個月、年付 12 個月 */
export function periodPrice(envs: number, cycle: BillingCycle): number {
  return round2(monthlyPrice(envs, cycle) * (cycle === 'annual' ? 12 : 1))
}

export function periodEnd(from: Date, cycle: BillingCycle): string {
  return new Date(from.getTime() + PERIOD_DAYS[cycle] * 24 * 60 * 60 * 1000).toISOString()
}
