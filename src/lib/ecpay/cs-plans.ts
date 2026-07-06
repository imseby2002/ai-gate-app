// CS 方案儲值方案（TWD，約 1:32 換算後取整數，方便標價）。
// 金額是初版粗估，之後想調整價格只要改這裡，不用動結帳流程。
export const CS_PLAN_PACKAGES = [
  { id: 'pro_monthly',        plan: 'pro',        cycle: 'monthly', twdAmount: 600,   usdPrice: 19,  label: 'PRO 方案（月繳）' },
  { id: 'pro_yearly',         plan: 'pro',        cycle: 'yearly',  twdAmount: 5800,  usdPrice: 182, label: 'PRO 方案（年繳）' },
  { id: 'team_monthly',       plan: 'team',       cycle: 'monthly', twdAmount: 900,   usdPrice: 29,  label: 'TEAM 方案（月繳）' },
  { id: 'team_yearly',        plan: 'team',       cycle: 'yearly',  twdAmount: 8900,  usdPrice: 278, label: 'TEAM 方案（年繳）' },
  { id: 'enterprise_monthly', plan: 'enterprise', cycle: 'monthly', twdAmount: 1300,  usdPrice: 41,  label: '企業方案（月繳）' },
  { id: 'enterprise_yearly',  plan: 'enterprise', cycle: 'yearly',  twdAmount: 12800, usdPrice: 399, label: '企業方案（年繳）' },
] as const

export type CsPlanPackageId = typeof CS_PLAN_PACKAGES[number]['id']
