// CS 方案儲值方案 — 美金計價（不再用台幣定價）。
// usdPrice 為權威金額；送給綠界的 TotalAmount 於結帳當下用 lib/fx.ts 即時匯率換算成整數台幣。
// 等級名稱在所有語言都固定用 FREE / CORE / PRO / MAX。
export const CS_PLAN_PACKAGES = [
  { id: 'core_monthly', plan: 'core', cycle: 'monthly', usdPrice: 19,  label: 'CORE 方案（月繳）' },
  { id: 'core_yearly',  plan: 'core', cycle: 'yearly',  usdPrice: 182, label: 'CORE 方案（年繳）' },
  { id: 'pro_monthly',  plan: 'pro',  cycle: 'monthly', usdPrice: 29,  label: 'PRO 方案（月繳）' },
  { id: 'pro_yearly',   plan: 'pro',  cycle: 'yearly',  usdPrice: 278, label: 'PRO 方案（年繳）' },
  { id: 'max_monthly',  plan: 'max',  cycle: 'monthly', usdPrice: 41,  label: 'MAX 方案（月繳）' },
  { id: 'max_yearly',   plan: 'max',  cycle: 'yearly',  usdPrice: 399, label: 'MAX 方案（年繳）' },
] as const

export type CsPlanPackageId = typeof CS_PLAN_PACKAGES[number]['id']
