// 公司方案模組化計價（美金／月）。唯一的價格來源：結帳、admin 預覽、方案頁都呼叫這裡。
// 月費 = 公司基本費 + 開通模組費 + ERP（含 10 人，超過每人加價）+ 門市零售包 + 自訂網域。
// 年繳以 10 個月計價，比照 CS／訂房／行銷方案的年繳慣例。
// 純常數與計算，client／server 皆可 import。

export const COMPANY_BASE_USD = 39

/** 公司可付費開通的模組與月費（皆為 MAX 等級，協作人數不限） */
export const COMPANY_MODULE_PRICES_USD = {
  cs: 41,
  booking: 49,
  marketing: 79,
} as const
export type CompanyPaidModule = keyof typeof COMPANY_MODULE_PRICES_USD

export const COMPANY_MODULE_LABELS: Record<CompanyPaidModule, string> = {
  cs: '客服 CS',
  booking: '訂房 BOOKING',
  marketing: '行銷 MARKETING',
}

export const ERP_BASE_USD = 29
export const ERP_INCLUDED_SEATS = 10
export const ERP_EXTRA_SEAT_USD = 2
export const RETAIL_STORE_USD = 10
export const CUSTOM_DOMAIN_USD = 10
export const YEARLY_MONTHS = 10
/** 公司方案每月贈點（美元），當月有效、不累積；數值需與 migration 20260925_company_credit_wallet.sql 一致 */
export const COMPANY_MONTHLY_GIFT_USD = 10

export interface CompanyPlanConfig {
  /** companies.enabled_modules；只有 COMPANY_MODULE_PRICES_USD 裡的模組會計費 */
  modules: readonly string[]
  /** 0 = 未開通 ERP */
  erpSeats: number
  retailStores: number
  customDomain: boolean
}

export interface CompanyPriceLine {
  label: string
  usd: number
}

export function isCompanyPaidModule(id: string): id is CompanyPaidModule {
  return Object.prototype.hasOwnProperty.call(COMPANY_MODULE_PRICES_USD, id)
}

export function calcCompanyMonthlyPrice(config: CompanyPlanConfig): { lines: CompanyPriceLine[]; monthlyUsd: number } {
  const lines: CompanyPriceLine[] = [{ label: '公司基本費', usd: COMPANY_BASE_USD }]

  for (const id of Object.keys(COMPANY_MODULE_PRICES_USD) as CompanyPaidModule[]) {
    if (config.modules.includes(id)) lines.push({ label: COMPANY_MODULE_LABELS[id], usd: COMPANY_MODULE_PRICES_USD[id] })
  }

  const seats = Math.max(0, Math.floor(config.erpSeats))
  if (seats > 0) {
    const extra = Math.max(0, seats - ERP_INCLUDED_SEATS)
    lines.push({ label: `ERP 基本包（${seats} 人，含 ${ERP_INCLUDED_SEATS} 人）`, usd: ERP_BASE_USD + extra * ERP_EXTRA_SEAT_USD })
  }

  const stores = Math.max(0, Math.floor(config.retailStores))
  if (stores > 0) lines.push({ label: `ERP 門市零售包（${stores} 家門市）`, usd: stores * RETAIL_STORE_USD })

  if (config.customDomain) lines.push({ label: '自訂網域', usd: CUSTOM_DOMAIN_USD })

  return { lines, monthlyUsd: lines.reduce((sum, l) => sum + l.usd, 0) }
}

export function calcCompanyPrice(config: CompanyPlanConfig, cycle: 'monthly' | 'yearly') {
  const { lines, monthlyUsd } = calcCompanyMonthlyPrice(config)
  return { lines, monthlyUsd, totalUsd: cycle === 'yearly' ? monthlyUsd * YEARLY_MONTHS : monthlyUsd }
}
