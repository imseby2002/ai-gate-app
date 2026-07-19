// CS 方案儲值方案 — 美金計價（不再用台幣定價）。
// usdPrice 為權威金額；送給綠界的 TotalAmount 於結帳當下用 lib/fx.ts 即時匯率換算成整數台幣。
export const CS_PLAN_PACKAGES = [
  { id: 'pro_monthly',        plan: 'pro',        cycle: 'monthly', usdPrice: 19,  label: 'PRO 方案（月繳）' },
  { id: 'pro_yearly',         plan: 'pro',        cycle: 'yearly',  usdPrice: 182, label: 'PRO 方案（年繳）' },
  { id: 'team_monthly',       plan: 'team',       cycle: 'monthly', usdPrice: 29,  label: 'TEAM 方案（月繳）' },
  { id: 'team_yearly',        plan: 'team',       cycle: 'yearly',  usdPrice: 278, label: 'TEAM 方案（年繳）' },
  { id: 'enterprise_monthly', plan: 'enterprise', cycle: 'monthly', usdPrice: 41,  label: '企業方案（月繳）' },
  { id: 'enterprise_yearly',  plan: 'enterprise', cycle: 'yearly',  usdPrice: 399, label: '企業方案（年繳）' },
] as const

export type CsPlanPackageId = typeof CS_PLAN_PACKAGES[number]['id']
