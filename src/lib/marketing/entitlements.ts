// 行銷方案權限中心：唯一的權威判斷點，其他地方（API、UI）都呼叫 getMarketingEntitlements()
// 取得解析後的權限，不各自寫死判斷邏輯。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type MarketingPlan = 'free' | 'pro' | 'team' | 'enterprise'

export type ProductDesignerAccess = 'none' | 'copyOnly' | 'full'
export type AiStudioAccess = 'none' | 'basic' | 'expert'
export type ProspectMarketingAccess = 'collectOnly' | 'email' | 'full'

export interface MarketingPlanFeatures {
  campaignLimit: number
  collaboratorLimit: number
  // 行銷自動化（marketing-auto）各單元
  copywritingUnlimited: boolean   // 單元4 文案產出：false = 有限次數
  imageGen: boolean               // 單元6 圖片產出（點數扣款）
  uploadPlatforms: boolean        // 單元9 上傳平台
  videoGen: boolean               // 單元8 影片產出（點數扣款）
  aiCallEmail: boolean            // 單元10 AI電訪＋Email行銷（點數扣款）
  avatarMarketing: boolean        // 單元11 主播行銷 HeyGen（點數扣款）
  // 獨立產品
  productDesigner: ProductDesignerAccess
  aiStudio: AiStudioAccess
  geoWriterMonthlyLimit: number   // Infinity = 無限
  marketingPipeline: boolean
  prospectMarketing: ProspectMarketingAccess
  // 專家模式
  expertSkills: boolean           // 13 項現有技能：全方案皆可用（點數扣款）
  customExpertBuild: boolean      // 自製專家功能「建立」權限（TEAM 以上）；Free/PRO 只能使用
}

export const MARKETING_PLAN_FEATURES: Record<MarketingPlan, MarketingPlanFeatures> = {
  free: {
    campaignLimit: 1,
    collaboratorLimit: 0,
    copywritingUnlimited: false,
    imageGen: false,
    uploadPlatforms: false,
    videoGen: false,
    aiCallEmail: false,
    avatarMarketing: false,
    productDesigner: 'none',
    aiStudio: 'none',
    geoWriterMonthlyLimit: 1,
    marketingPipeline: false,
    prospectMarketing: 'collectOnly',
    expertSkills: true,
    customExpertBuild: false,
  },
  pro: {
    campaignLimit: 10,
    collaboratorLimit: 1,
    copywritingUnlimited: true,
    imageGen: true,
    uploadPlatforms: true,
    videoGen: false,
    aiCallEmail: false,
    avatarMarketing: false,
    productDesigner: 'copyOnly',
    aiStudio: 'none',
    geoWriterMonthlyLimit: Infinity,
    marketingPipeline: false,
    prospectMarketing: 'email',
    expertSkills: true,
    customExpertBuild: false,
  },
  team: {
    campaignLimit: Infinity,
    collaboratorLimit: Infinity,
    copywritingUnlimited: true,
    imageGen: true,
    uploadPlatforms: true,
    videoGen: true,
    aiCallEmail: true,
    avatarMarketing: false,
    productDesigner: 'full',
    aiStudio: 'basic',
    geoWriterMonthlyLimit: Infinity,
    marketingPipeline: true,
    prospectMarketing: 'full',
    expertSkills: true,
    customExpertBuild: true,
  },
  enterprise: {
    campaignLimit: Infinity,
    collaboratorLimit: Infinity,
    copywritingUnlimited: true,
    imageGen: true,
    uploadPlatforms: true,
    videoGen: true,
    aiCallEmail: true,
    avatarMarketing: true,
    productDesigner: 'full',
    aiStudio: 'expert',
    geoWriterMonthlyLimit: Infinity,
    marketingPipeline: true,
    prospectMarketing: 'full',
    expertSkills: true,
    customExpertBuild: true,
  },
}

/**
 * 取得某帳號（ownerId）目前的行銷方案與解析後的權限。
 * 沒有 marketing_subscriptions 資料 = free（免遷移既有帳號）。
 * feature_overrides 可疊加在方案預設值之上，供企業客製功能使用。
 *
 * 訂閱查詢一律用 service role（比照 cs/booking entitlements 的作法），一併處理
 * 「傳入的請求端 client 在某些呼叫路徑（例如 cron-aware 的 email-send route）
 * 不一定存在」的情況。傳入的 supabase 參數保留是為了呼叫端相容，實際不再使用。
 */
export async function getMarketingEntitlements(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{ plan: MarketingPlan; features: MarketingPlanFeatures }> {
  void supabase
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  // 內部帳號（admin / employee）不受方案／額度限制，不查訂閱表（見下方判斷）。
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('user_type')
    .eq('id', ownerId)
    .maybeSingle()
  // 內部帳號（admin / employee）不受方案／額度限制，一律視同企業方案。
  // 比照全站計費慣例：只有 external（付費客戶）才受方案與額度限制（見 lib/marketing/billing.ts）。
  if (ownerProfile?.user_type === 'admin' || ownerProfile?.user_type === 'employee') {
    return { plan: 'enterprise', features: MARKETING_PLAN_FEATURES.enterprise }
  }

  let data: { plan?: string; status?: string; feature_overrides?: Partial<MarketingPlanFeatures>; current_period_end?: string | null } | null = null
  try {
    const res = await admin
      .from('marketing_subscriptions')
      .select('plan, status, feature_overrides, current_period_end')
      .eq('user_id', ownerId)
      .maybeSingle()
    data = res.data
  } catch (err) {
    // 查詢失敗就當作 free（安全預設，不多給付費功能），並記錄以便排查
    console.error('[marketing entitlements] lookup failed, defaulting to free:', err)
  }

  // 到期即失效：一次性付款、無自動續訂與定時降級 cron，一律在讀取時檢查
  // current_period_end，過期就視同免費方案（與 CS/訂房模組同一套規則）。
  // current_period_end 為 null 視為不到期（管理員手動指定的長期方案）。
  const expired = !!data?.current_period_end && new Date(data.current_period_end).getTime() < Date.now()

  const plan: MarketingPlan = (data?.status === 'active' && !expired && data?.plan && data.plan in MARKETING_PLAN_FEATURES)
    ? (data.plan as MarketingPlan)
    : 'free'

  // 過期訂閱連帶失效 feature_overrides（客製加開的功能不應在到期後繼續生效）；
  // 未過期時照常疊加，包括管理員對免費帳號手動加開的功能。
  const overrides = (!expired ? data?.feature_overrides ?? {} : {}) as Partial<MarketingPlanFeatures>
  const features: MarketingPlanFeatures = { ...MARKETING_PLAN_FEATURES[plan], ...overrides }

  return { plan, features }
}
