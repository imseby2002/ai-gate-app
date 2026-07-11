// 訂房方案儲值方案（TWD，約 1:32 換算後取整數，方便標價）。
// 金額是初版粗估，之後想調整價格只要改這裡，不用動結帳流程。
export const BOOKING_PLAN_PACKAGES = [
  { id: 'core_monthly',       plan: 'core',       cycle: 'monthly', twdAmount: 150,   usdPrice: 5,   label: 'CORE 方案（月繳）' },
  { id: 'core_yearly',        plan: 'core',       cycle: 'yearly',  twdAmount: 1700,  usdPrice: 54,  label: 'CORE 方案（年繳）' },
  { id: 'pro_monthly',        plan: 'pro',        cycle: 'monthly', twdAmount: 600,   usdPrice: 19,  label: 'PRO 方案（月繳）' },
  { id: 'pro_yearly',         plan: 'pro',        cycle: 'yearly',  twdAmount: 6480,  usdPrice: 205, label: 'PRO 方案（年繳）' },
  { id: 'enterprise_monthly', plan: 'enterprise', cycle: 'monthly', twdAmount: 1230,  usdPrice: 39,  label: 'MAX 方案（月繳）' },
  { id: 'enterprise_yearly',  plan: 'enterprise', cycle: 'yearly',  twdAmount: 13300, usdPrice: 421, label: 'MAX 方案（年繳）' },
] as const

export type BookingPlanPackageId = typeof BOOKING_PLAN_PACKAGES[number]['id']
