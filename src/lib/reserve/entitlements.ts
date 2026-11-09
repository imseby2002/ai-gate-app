// 預約系統方案權限：FREE 1 間門市、簡訊提醒用固定內容；CORE 最多 20 間分店、可自訂簡訊內容。
// 簡訊與 AI 助理兩個方案都可用，依實際用量扣點。
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_STORES } from '@/lib/reserve/current-store'

export type ReservePlan = 'free' | 'core'

export interface ReservePlanFeatures {
  maxStores: number
  customSmsTemplate: boolean
}

export const RESERVE_PLAN_FEATURES: Record<ReservePlan, ReservePlanFeatures> = {
  free: { maxStores: 1, customSmsTemplate: false },
  core: { maxStores: MAX_STORES, customSmsTemplate: true },
}

export interface ReserveEntitlements {
  plan: ReservePlan
  features: ReservePlanFeatures
  periodEnd: string | null
}

/** 沒有訂閱或已過期 = free；總管理員與公司開通預約模組視同 CORE */
export async function getReserveEntitlements(userId: string): Promise<ReserveEntitlements> {
  const admin = createAdminClient()
  const [{ data: profile }, { data: sub }] = await Promise.all([
    admin.from('profiles').select('user_type').eq('id', userId).maybeSingle(),
    admin.from('reserve_subscriptions').select('plan, status, current_period_end').eq('user_id', userId).maybeSingle(),
  ])
  if (profile?.user_type === 'admin') return { plan: 'core', features: RESERVE_PLAN_FEATURES.core, periodEnd: null }

  const expired = !!sub?.current_period_end && new Date(sub.current_period_end).getTime() < Date.now()
  let plan: ReservePlan = sub?.status === 'active' && !expired && sub.plan === 'core' ? 'core' : 'free'
  if (plan === 'free') {
    const { hasCompanyModuleGrant } = await import('@/lib/company/entitlements')
    if (await hasCompanyModuleGrant(userId, 'reserve')) plan = 'core'
  }
  return { plan, features: RESERVE_PLAN_FEATURES[plan], periodEnd: plan === 'core' ? sub?.current_period_end ?? null : null }
}
