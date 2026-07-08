// CS 方案權限中心：唯一的權威判斷點，其他地方（API、UI）都呼叫 getCsEntitlements()
// 取得解析後的權限，不各自寫死判斷邏輯。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type CsPlan = 'free' | 'pro' | 'team' | 'enterprise'

export interface CsPlanFeatures {
  platformLimit: number
  collaboratorLimit: number
  aiSettingsScope: 'basic' | 'full'
  claudeEscalation: 'off' | 'high'
  dataSources: boolean
  tickets: boolean
  inbox: boolean
  autoLearning: boolean
  pricingCalculator: boolean
  assistedSetup: { freePerMonth: number; priceUsd: number }
}

export const CS_PLAN_FEATURES: Record<CsPlan, CsPlanFeatures> = {
  free: {
    platformLimit: 1,
    collaboratorLimit: 0,
    aiSettingsScope: 'basic',
    claudeEscalation: 'off',
    dataSources: false,
    tickets: false,
    inbox: false,
    autoLearning: false,
    pricingCalculator: false,
    assistedSetup: { freePerMonth: 0, priceUsd: 25 },
  },
  pro: {
    platformLimit: 3,
    collaboratorLimit: 1,
    aiSettingsScope: 'full',
    claudeEscalation: 'high',
    dataSources: true,
    tickets: true,
    inbox: true,
    autoLearning: true,
    pricingCalculator: false,
    assistedSetup: { freePerMonth: 0, priceUsd: 15 },
  },
  team: {
    platformLimit: 3,
    collaboratorLimit: Infinity,
    aiSettingsScope: 'full',
    claudeEscalation: 'high',
    dataSources: true,
    tickets: true,
    inbox: true,
    autoLearning: true,
    pricingCalculator: false,
    assistedSetup: { freePerMonth: 1, priceUsd: 15 },
  },
  enterprise: {
    platformLimit: Infinity,
    collaboratorLimit: Infinity,
    aiSettingsScope: 'full',
    claudeEscalation: 'high',
    dataSources: true,
    tickets: true,
    inbox: true,
    autoLearning: true,
    pricingCalculator: true,
    assistedSetup: { freePerMonth: 2, priceUsd: 15 },
  },
}

// 客製功能（新增功能／需改寫程式）：與「協助設定」（僅頻道串接與設定）不同，
// 一律付費、沒有免費額度，所有方案適用同一套定價。
// 基礎客製：固定 $15/次，需審核是否可行；進階／複雜功能：無固定價，個別報價。
export const CS_FEATURE_REQUEST_PRICING = {
  basicPriceUsd: 15,
  basicNote: '需審核',
  advancedNote: '另外報價',
}

/**
 * 取得某民宿（ownerId）目前的方案與解析後的權限。
 * 沒有 cs_subscriptions 資料 = free（免遷移既有帳號）。
 * feature_overrides 可疊加在方案預設值之上，供企業客製功能使用。
 */
export async function getCsEntitlements(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{ plan: CsPlan; features: CsPlanFeatures }> {
  const { data } = await supabase
    .from('cs_subscriptions')
    .select('plan, status, feature_overrides')
    .eq('user_id', ownerId)
    .maybeSingle()

  const plan: CsPlan = (data?.status === 'active' && data?.plan && data.plan in CS_PLAN_FEATURES)
    ? (data.plan as CsPlan)
    : 'free'

  const overrides = (data?.feature_overrides ?? {}) as Partial<CsPlanFeatures>
  const features: CsPlanFeatures = { ...CS_PLAN_FEATURES[plan], ...overrides }

  return { plan, features }
}
