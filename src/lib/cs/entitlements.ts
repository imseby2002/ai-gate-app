// CS 方案權限中心：唯一的權威判斷點，其他地方（API、UI）都呼叫 getCsEntitlements()
// 取得解析後的權限，不各自寫死判斷邏輯。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// 方案等級（名稱在所有語言都固定用 FREE / CORE / PRO / MAX）
export type CsPlan = 'free' | 'core' | 'pro' | 'max'

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
  /** WhatsApp 個人版（Baileys QR 掃碼）僅 PRO 以上可用 */
  whatsappPersonal: boolean
  /** L3 進階處理（客人傳照片辨識、複雜問題轉更強模型）僅 CORE 以上可用；免費層封頂在 L2 常規回覆 */
  advancedSupport: boolean
  /** 即時網路搜尋（天氣、附近景點等知識庫沒有的即時資訊）僅 PRO 以上可用 */
  webSearch: boolean
  assistedSetup: { freePerMonth: number; priceUsd: number }
}

export const CS_PLAN_FEATURES: Record<CsPlan, CsPlanFeatures> = {
  free: {
    platformLimit: 3,
    collaboratorLimit: 0,
    aiSettingsScope: 'basic',
    claudeEscalation: 'off',
    dataSources: false,
    tickets: false,
    inbox: false,
    autoLearning: false,
    pricingCalculator: false,
    whatsappPersonal: false,
    advancedSupport: false,
    webSearch: false,
    assistedSetup: { freePerMonth: 0, priceUsd: 25 },
  },
  core: {
    platformLimit: 3,
    collaboratorLimit: 1,
    aiSettingsScope: 'full',
    claudeEscalation: 'high',
    dataSources: true,
    tickets: true,
    inbox: true,
    autoLearning: true,
    pricingCalculator: false,
    whatsappPersonal: true,
    advancedSupport: true,
    webSearch: false,
    assistedSetup: { freePerMonth: 0, priceUsd: 15 },
  },
  pro: {
    platformLimit: 3,
    collaboratorLimit: Infinity,
    aiSettingsScope: 'full',
    claudeEscalation: 'high',
    dataSources: true,
    tickets: true,
    inbox: true,
    autoLearning: true,
    pricingCalculator: false,
    whatsappPersonal: true,
    advancedSupport: true,
    webSearch: true,
    assistedSetup: { freePerMonth: 1, priceUsd: 15 },
  },
  max: {
    platformLimit: Infinity,
    collaboratorLimit: Infinity,
    aiSettingsScope: 'full',
    claudeEscalation: 'high',
    dataSources: true,
    tickets: true,
    inbox: true,
    autoLearning: true,
    pricingCalculator: true,
    whatsappPersonal: true,
    advancedSupport: true,
    webSearch: true,
    assistedSetup: { freePerMonth: 2, priceUsd: 15 },
  },
}

// 客製功能（新增功能／需改寫程式）：與「協助設定」（僅頻道串接與設定）不同，一律付費、沒有免費額度。
// 判斷標準看技術特徵，不是主觀感受：
// - 基礎客製：調整既有邏輯但不動資料庫結構（例：客製一次性 regex/規則），固定價，依方案分級（免費層較貴，反映其低承諾的維護風險）。
// - 複雜客製：需新增資料表／獨立模組／第三方串接，一次性建置費另議 + 每月維護費
//   （因為往後系統升級都要顧到這個客戶專屬的表/模組，是持續性成本，不能只收一次性費用了事）。
export const CS_FEATURE_REQUEST_PRICING = {
  basicPriceUsdByPlan: { free: 39, core: 15, pro: 15, max: 15 } as Record<CsPlan, number>,
  basicNote: '需審核',
  complexNote: '需新增資料庫／獨立模組／第三方串接，採「一次性建置費＋每月維護費」，審核後報價',
}

/**
 * 取得某民宿（ownerId）目前的方案與解析後的權限。
 * 沒有 cs_subscriptions 資料 = free（免遷移既有帳號）。
 * feature_overrides 可疊加在方案預設值之上，供企業客製功能使用。
 *
 * 訂閱查詢一律用 service role：cs_subscriptions 的 RLS 只允許讀自己的 row，
 * 協作者操作老闆的資料時（ownerId ≠ auth.uid()）用請求端 client 會查不到
 * 訂閱而被誤判成 free。傳入的 supabase 參數保留是為了呼叫端相容，實際不再使用。
 * （動態 import 避免這支檔案的常數被 client component 引用時把 admin client 打包進前端）
 */
export async function getCsEntitlements(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{ plan: CsPlan; features: CsPlanFeatures }> {
  void supabase
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin
    .from('cs_subscriptions')
    .select('plan, status, feature_overrides, current_period_end')
    .eq('user_id', ownerId)
    .maybeSingle()

  // 到期即失效：沒有自動續訂與定時降級 cron，一律在讀取時檢查
  // current_period_end，過期就視同免費方案。current_period_end 為 null
  // 視為不到期（管理員手動指定的長期方案）。
  const expired = !!data?.current_period_end && new Date(data.current_period_end).getTime() < Date.now()

  const plan: CsPlan = (data?.status === 'active' && !expired && data?.plan && data.plan in CS_PLAN_FEATURES)
    ? (data.plan as CsPlan)
    : 'free'

  // 過期訂閱連帶失效 feature_overrides（客製加開的功能不應在到期後繼續生效）；
  // 未過期時照常疊加，包括管理員對免費帳號手動加開的功能。
  const overrides = (!expired ? data?.feature_overrides ?? {} : {}) as Partial<CsPlanFeatures>
  const features: CsPlanFeatures = { ...CS_PLAN_FEATURES[plan], ...overrides }

  return { plan, features }
}
