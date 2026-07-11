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
 */
export async function getBookingEntitlements(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<BookingEntitlements> {
  const { data } = await supabase
    .from('booking_subscriptions')
    .select('plan, status, extra_properties, feature_overrides')
    .eq('user_id', ownerId)
    .maybeSingle()

  const plan: BookingPlan = (data?.status === 'active' && data?.plan && data.plan in BOOKING_PLAN_FEATURES)
    ? (data.plan as BookingPlan)
    : 'free'

  const overrides = (data?.feature_overrides ?? {}) as Partial<BookingPlanFeatures>
  const features: BookingPlanFeatures = { ...BOOKING_PLAN_FEATURES[plan], ...overrides }
  const extraProperties = data?.extra_properties ?? 0

  return { plan, features, extraProperties, propertyLimit: features.propertyBaseLimit + extraProperties }
}
