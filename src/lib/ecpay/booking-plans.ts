// 訂房方案儲值方案 — 美金計價（不再用台幣定價）。
// usdPrice 為權威金額；送給綠界的 TotalAmount 於結帳當下用 lib/fx.ts 即時匯率換算成整數台幣。
// 年繳為短期促銷價（打 7 折），金額是初版粗估，之後想調整價格只要改這裡，不用動結帳流程。
export const BOOKING_PLAN_PACKAGES = [
  { id: 'core_monthly',       plan: 'core',       cycle: 'monthly', usdPrice: 8,   label: 'CORE 方案（月繳）' },
  { id: 'core_yearly',        plan: 'core',       cycle: 'yearly',  usdPrice: 67,  label: 'CORE 方案（年繳）' },
  { id: 'pro_monthly',        plan: 'pro',        cycle: 'monthly', usdPrice: 29,  label: 'PRO 方案（月繳）' },
  { id: 'pro_yearly',         plan: 'pro',        cycle: 'yearly',  usdPrice: 244, label: 'PRO 方案（年繳）' },
  { id: 'enterprise_monthly', plan: 'enterprise', cycle: 'monthly', usdPrice: 49,  label: 'MAX 方案（月繳）' },
  { id: 'enterprise_yearly',  plan: 'enterprise', cycle: 'yearly',  usdPrice: 412, label: 'MAX 方案（年繳）' },
] as const

export type BookingPlanPackageId = typeof BOOKING_PLAN_PACKAGES[number]['id']
