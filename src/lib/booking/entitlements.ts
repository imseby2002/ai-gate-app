// 訂房方案權限中心：唯一的權威判斷點，其他地方（API、UI）都呼叫 getBookingEntitlements()
// 取得解析後的權限，不各自寫死判斷邏輯。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type BookingPlan = 'free' | 'core' | 'pro' | 'enterprise'

export interface BookingPlanFeatures {
  propertyBaseLimit: number
  extraPropertyPriceUsd: number
  collaboratorLimit: number
  dynamicPricing: boolean
  emailSync: boolean
  realtimeSync: boolean
  csIntegration: boolean
  promoCodes: boolean
  assistedSetup: { freePerMonth: number; priceUsd: number }
}

export const BOOKING_PLAN_FEATURES: Record<BookingPlan, BookingPlanFeatures> = {
  free: {
    propertyBaseLimit: 1,
    extraPropertyPriceUsd: 0,
    collaboratorLimit: 0,
    dynamicPricing: false,
    emailSync: false,
    realtimeSync: false,
    csIntegration: false,
    promoCodes: false,
    assistedSetup: { freePerMonth: 0, priceUsd: 20 },
  },
  core: {
    propertyBaseLimit: 5,
    extraPropertyPriceUsd: 4,
    collaboratorLimit: 1,
    dynamicPricing: true,
    emailSync: true,
    realtimeSync: false,
    csIntegration: false,
    promoCodes: true,
    assistedSetup: { freePerMonth: 0, priceUsd: 20 },
  },
  pro: {
    propertyBaseLimit: 5,
    extraPropertyPriceUsd: 3,
    collaboratorLimit: 2,
    dynamicPricing: true,
    emailSync: true,
    realtimeSync: true,
    csIntegration: true,
    promoCodes: true,
    assistedSetup: { freePerMonth: 1, priceUsd: 20 },
  },
  enterprise: {
    propertyBaseLimit: 15,
    extraPropertyPriceUsd: 2,
    collaboratorLimit: Infinity,
    dynamicPricing: true,
    emailSync: true,
    realtimeSync: true,
    csIntegration: true,
    promoCodes: true,
    assistedSetup: { freePerMonth: 2, priceUsd: 20 },
  },
}

export interface BookingEntitlements {
  plan: BookingPlan
  features: BookingPlanFeatures
  extraProperties: number
  propertyLimit: number
}

/**
 * 取得某民宿（ownerId）目前的訂房方案與解析後的權限。
 * 沒有 booking_subscriptions 資料 = free（免遷移既有帳號）。
 * feature_overrides 可疊加在方案預設值之上，供企業客製功能使用。
 *
 * 訂閱查詢一律用 service role：booking_subscriptions 的 RLS 只允許讀自己的
 * row，協作者操作老闆的民宿時（ownerId ≠ auth.uid()）用請求端 client 會查不到
 * 訂閱而被誤判成 free。傳入的 supabase 參數保留是為了呼叫端相容，實際不再使用。
 */
export async function getBookingEntitlements(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<BookingEntitlements> {
  void supabase
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin
    .from('booking_subscriptions')
    .select('plan, status, extra_properties, feature_overrides, current_period_end')
    .eq('user_id', ownerId)
    .maybeSingle()

  // 到期即失效：一次性付款、無自動續訂與定時降級 cron，一律在讀取時檢查
  // current_period_end，過期就視同免費方案（與 CS 模組同一套規則）。
  // current_period_end 為 null 視為不到期（管理員手動指定的長期方案）。
  const expired = !!data?.current_period_end && new Date(data.current_period_end).getTime() < Date.now()

  const plan: BookingPlan = (data?.status === 'active' && !expired && data?.plan && data.plan in BOOKING_PLAN_FEATURES)
    ? (data.plan as BookingPlan)
    : 'free'

  // 過期訂閱連帶失效 feature_overrides；未過期時照常疊加（包括管理員對免費帳號手動加開的功能）
  const overrides = (!expired ? data?.feature_overrides ?? {} : {}) as Partial<BookingPlanFeatures>
  const features: BookingPlanFeatures = { ...BOOKING_PLAN_FEATURES[plan], ...overrides }
  const extraProperties = data?.extra_properties ?? 0

  return { plan, features, extraProperties, propertyLimit: features.propertyBaseLimit + extraProperties }
}
