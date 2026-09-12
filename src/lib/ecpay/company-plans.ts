// 公司會員方案儲值方案 — 美金計價，比照 cs-plans.ts／booking-plans.ts 的慣例。
// 定價邏輯：以 CS 客製功能免費層參考價 $39/次、CORE 以上優惠價 $15/次為基準
// （見 src/lib/cs/entitlements.ts 的 CS_FEATURE_REQUEST_PRICING），讓每月
// 免費次數的方案費用低於等值的單次計費，才有實際升級誘因。年繳約年省 2 個月。
export const COMPANY_PLAN_PACKAGES = [
  { id: 'core_monthly', plan: 'core', cycle: 'monthly', usdPrice: 19,  label: 'CORE 方案（月繳）' },
  { id: 'core_yearly',  plan: 'core', cycle: 'yearly',  usdPrice: 190, label: 'CORE 方案（年繳）' },
  { id: 'pro_monthly',  plan: 'pro',  cycle: 'monthly', usdPrice: 39,  label: 'PRO 方案（月繳）' },
  { id: 'pro_yearly',   plan: 'pro',  cycle: 'yearly',  usdPrice: 390, label: 'PRO 方案（年繳）' },
  { id: 'max_monthly',  plan: 'max',  cycle: 'monthly', usdPrice: 79,  label: 'MAX 方案（月繳）' },
  { id: 'max_yearly',   plan: 'max',  cycle: 'yearly',  usdPrice: 790, label: 'MAX 方案（年繳）' },
] as const

export type CompanyPlanPackageId = typeof COMPANY_PLAN_PACKAGES[number]['id']
