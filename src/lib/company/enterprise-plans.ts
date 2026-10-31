// 企業方案三級定價（美金／月）：企業 CORE／PRO／MAX。純常數與計算，client／server 皆可 import。
// 平台費 = 公司方案全模組單買加總（含該級內含門市與 ERP 人數）× 0.9，再加客製工時與 AI 點數池。
// 超出內含量的門市與人數照單買單價加收、不打折；CORE／PRO 有上限，MAX 不限。
// 沒有門市的企業不收門市零售包。三級皆為公開定價，不再單獨報價；超過 MAX 以加值服務加購。
import {
  COMPANY_BASE_USD,
  COMPANY_MODULE_PRICES_USD,
  CUSTOM_DOMAIN_USD,
  ERP_BASE_USD,
  ERP_EXTRA_SEAT_USD,
  ERP_INCLUDED_SEATS,
  RETAIL_STORE_USD,
  type CompanyPriceLine,
} from './pricing'

export type EnterpriseTier = 'core' | 'pro' | 'max'
export const ENTERPRISE_TIERS: EnterpriseTier[] = ['core', 'pro', 'max']

export const ENTERPRISE_BUNDLE_DISCOUNT = 0.1
export const ENTERPRISE_CUSTOM_HOUR_USD = 30
export const ENTERPRISE_LEAD_OPS_HOUR_USD = 10

export interface EnterpriseTierDef {
  /** 中文／英文／越文名稱 */
  label: { zh: string; en: string; vi: string }
  includedStores: number
  /** null = 不限 */
  maxStores: number | null
  includedSeats: number
  maxSeats: number | null
  /** 每月內含客製工時（小時），未用完不累積 */
  customHours: number
  /** 每月內含 AI 點數（1 點 = US$1） */
  points: number
  /** 扣點倍率：原廠官方單價 × multiplier */
  multiplier: number
  /** false = 不可客製；'modify' = 只能修改現有功能；'full' = 可開發專屬新功能 */
  customization: false | 'modify' | 'full'
  subdomain: boolean
  customDomain: boolean
}

export const ENTERPRISE_TIER_DEFS: Record<EnterpriseTier, EnterpriseTierDef> = {
  core: {
    label: { zh: '企業 CORE（企業基礎版）', en: 'Enterprise CORE', vi: 'Doanh nghiệp CORE' },
    includedStores: 5, maxStores: 10, includedSeats: 20, maxSeats: 30,
    customHours: 0, points: 62, multiplier: 1.4, customization: false, subdomain: false, customDomain: false,
  },
  pro: {
    label: { zh: '企業 PRO（企業進階版）', en: 'Enterprise PRO', vi: 'Doanh nghiệp PRO' },
    includedStores: 15, maxStores: 30, includedSeats: 50, maxSeats: 100,
    customHours: 4, points: 211, multiplier: 1.3, customization: 'modify', subdomain: true, customDomain: false,
  },
  max: {
    label: { zh: '企業 MAX（企業專屬版）', en: 'Enterprise MAX', vi: 'Doanh nghiệp MAX' },
    includedStores: 30, maxStores: null, includedSeats: 100, maxSeats: null,
    customHours: 10, points: 582, multiplier: 1.2, customization: 'full', subdomain: true, customDomain: true,
  },
}

/** 加值服務單價（USD）。通訊與 IP 以原廠公開價 × 1.2 取整；AdsPower 沿用 connector/managed-pricing.ts */
export const ENTERPRISE_ADD_ONS: { key: string; label: string; unit: string; included: Record<EnterpriseTier, string> }[] = [
  { key: 'adspower_seat', label: 'AdsPower 代管：成員席次', unit: '$3／席／月', included: { core: '—', pro: '1 席', max: '3 席' } },
  { key: 'adspower_env', label: 'AdsPower 代管：瀏覽器環境', unit: '$0.22／個／月（51–100 個 $0.20、101 個起 $0.19）', included: { core: '—', pro: '10 個', max: '50 個' } },
  { key: 'ip_isp', label: '發文／養號 IP：靜態 ISP', unit: '$3.5／IP／月', included: { core: '—', pro: '1 個', max: '3 個' } },
  { key: 'ip_residential', label: '發文／養號 IP：住宅代理', unit: '$8.5／GB（不過期）', included: { core: '—', pro: '—', max: '—' } },
  { key: 'warmup_account', label: '養號帳號（任務管理）', unit: '工具不另收；建議每帳號搭 1 個環境＋1 個 IP', included: { core: '5 個', pro: '20 個', max: '50 個' } },
  { key: 'sms_vn', label: '簡訊（越南）', unit: '$0.19／則', included: { core: '—', pro: '—', max: '—' } },
  { key: 'call_vn', label: '電話撥打（越南）', unit: '$0.24／分鐘', included: { core: '—', pro: '—', max: '—' } },
  { key: 'phone_number', label: '專用電話號碼', unit: '$1.5／個／月', included: { core: '—', pro: '—', max: '1 個' } },
  { key: 'zalo_zns', label: 'Zalo ZNS', unit: '通知 250 VND／則；行銷 360 VND／則', included: { core: '—', pro: '—', max: '—' } },
  { key: 'email', label: 'Email 寄送', unit: '$1.1／1,000 封', included: { core: '1,000 封', pro: '5,000 封', max: '20,000 封' } },
  { key: 'points', label: 'AI 點數', unit: '$1／點', included: { core: '62 點', pro: '211 點', max: '582 點' } },
  { key: 'custom_hour', label: '客製開發／特殊功能', unit: `$${ENTERPRISE_CUSTOM_HOUR_USD}／小時`, included: { core: '不提供', pro: '4 小時', max: '10 小時' } },
  { key: 'lead_ops_hour', label: '潛在客戶開發代操', unit: `$${ENTERPRISE_LEAD_OPS_HOUR_USD}／小時（另加通訊費）`, included: { core: '不提供', pro: '依工時', max: '依工時' } },
]

const MODULES_USD = Object.values(COMPANY_MODULE_PRICES_USD).reduce((s, v) => s + v, 0)

function erpUsd(seats: number): number {
  return ERP_BASE_USD + Math.max(0, seats - ERP_INCLUDED_SEATS) * ERP_EXTRA_SEAT_USD
}

export interface EnterpriseUsage {
  /** 實際門市數；0 = 沒有門市（不收門市零售包） */
  stores: number
  /** 實際 ERP 使用人數 */
  seats: number
}

export interface EnterprisePrice {
  lines: CompanyPriceLine[]
  monthlyUsd: number
  /** 超過 CORE／PRO 上限時列出原因；有值代表應改選更高等級 */
  overCap: string[]
}

export function calcEnterpriseMonthlyPrice(tier: EnterpriseTier, usage: EnterpriseUsage): EnterprisePrice {
  const def = ENTERPRISE_TIER_DEFS[tier]
  const stores = Math.max(0, Math.floor(usage.stores))
  const seats = Math.max(0, Math.floor(usage.seats))
  const hasStores = stores > 0

  const listUsd = COMPANY_BASE_USD + MODULES_USD + erpUsd(def.includedSeats)
    + (hasStores ? def.includedStores * RETAIL_STORE_USD : 0)
    + (def.customDomain ? CUSTOM_DOMAIN_USD : 0)
  const platformUsd = Math.round(listUsd * (1 - ENTERPRISE_BUNDLE_DISCOUNT))

  const lines: CompanyPriceLine[] = [
    { label: `平台費（全模組單買 $${listUsd} × ${1 - ENTERPRISE_BUNDLE_DISCOUNT}${hasStores ? `，含 ${def.includedStores} 家門市` : '，無門市'}、${def.includedSeats} 人）`, usd: platformUsd, key: 'enterprise_platform' },
  ]
  if (def.customHours > 0) lines.push({ label: `客製開發 ${def.customHours} 小時 × $${ENTERPRISE_CUSTOM_HOUR_USD}`, usd: def.customHours * ENTERPRISE_CUSTOM_HOUR_USD, key: 'enterprise_hours' })
  lines.push({ label: `AI 點數池 ${def.points} 點（扣點 × ${def.multiplier}）`, usd: def.points, key: 'enterprise_points' })

  const extraStores = hasStores ? Math.max(0, stores - def.includedStores) : 0
  if (extraStores > 0) lines.push({ label: `超出門市 ${extraStores} 家 × $${RETAIL_STORE_USD}`, usd: extraStores * RETAIL_STORE_USD, key: 'enterprise_extra_stores' })
  const extraSeats = Math.max(0, seats - def.includedSeats)
  if (extraSeats > 0) lines.push({ label: `超出人數 ${extraSeats} 人 × $${ERP_EXTRA_SEAT_USD}`, usd: extraSeats * ERP_EXTRA_SEAT_USD, key: 'enterprise_extra_seats' })

  const overCap: string[] = []
  if (def.maxStores != null && stores > def.maxStores) overCap.push(`門市 ${stores} 家超過上限 ${def.maxStores} 家`)
  if (def.maxSeats != null && seats > def.maxSeats) overCap.push(`人數 ${seats} 人超過上限 ${def.maxSeats} 人`)

  return { lines, monthlyUsd: lines.reduce((s, l) => s + l.usd, 0), overCap }
}
