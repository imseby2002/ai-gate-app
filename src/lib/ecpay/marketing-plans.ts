// 行銷方案儲值方案 — 美金計價（全站已改用美金，不再用台幣定價）。
// usdPrice 為權威金額；送給綠界的 TotalAmount 於結帳當下用 lib/fx.ts 即時匯率換算成整數台幣。
// 年繳約打 8 折（比照 cs-plans.ts 的折扣比例），金額是初版粗估，之後想調整價格只要改這裡，不用動結帳流程。
export const MARKETING_PLAN_PACKAGES = [
  { id: 'pro_monthly',        plan: 'pro',        cycle: 'monthly', usdPrice: 29,  label: '行銷 PRO 方案（月繳）' },
  { id: 'pro_yearly',         plan: 'pro',        cycle: 'yearly',  usdPrice: 278, label: '行銷 PRO 方案（年繳）' },
  { id: 'team_monthly',       plan: 'team',       cycle: 'monthly', usdPrice: 49,  label: '行銷 TEAM 方案（月繳）' },
  { id: 'team_yearly',        plan: 'team',       cycle: 'yearly',  usdPrice: 470, label: '行銷 TEAM 方案（年繳）' },
  { id: 'enterprise_monthly', plan: 'enterprise', cycle: 'monthly', usdPrice: 79,  label: '行銷企業方案（月繳）' },
  { id: 'enterprise_yearly',  plan: 'enterprise', cycle: 'yearly',  usdPrice: 758, label: '行銷企業方案（年繳）' },
] as const

export type MarketingPlanPackageId = typeof MARKETING_PLAN_PACKAGES[number]['id']
