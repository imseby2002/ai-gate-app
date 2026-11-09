// 預約系統方案 — 美金計價；結帳當下用 lib/fx.ts 即時匯率換算成整數台幣。
export const RESERVE_PLAN_PACKAGES = [
  { id: 'core_monthly', plan: 'core', cycle: 'monthly', usdPrice: 5, label: '預約系統 CORE 方案（月繳）' },
] as const

export type ReservePlanPackageId = typeof RESERVE_PLAN_PACKAGES[number]['id']
