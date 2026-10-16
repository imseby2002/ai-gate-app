// 官方發文 IP 售價（USD，點數＝美金）：前後端共用的純函式
// ISP（獨享／共享）按 IP 月租 monthly_price_usd；住宅代理按 GB（price_per_gb_usd，使用者自選 GB 數，不過期）
// 舊資料只有 monthly_price_twd 時，依匯率換算
import type { ProxyType } from './types'

export interface OfficialPriceFields {
  proxy_type: ProxyType
  monthly_price_usd?: number | null
  price_per_gb_usd?: number | null
  monthly_price_twd?: number | null
}

export function officialPriceUsd(p: OfficialPriceFields, usdTwdRate: number | null): number | null {
  if (p.proxy_type === 'residential') return p.price_per_gb_usd ? Number(p.price_per_gb_usd) : null
  if (p.monthly_price_usd) return Math.round(Number(p.monthly_price_usd) * 100) / 100
  if (p.monthly_price_twd && usdTwdRate) return Math.ceil((p.monthly_price_twd / usdTwdRate) * 100) / 100
  return null
}

// 住宅代理購買／加購 gb 的總價
export function resiPackUsd(pricePerGb: number, gb: number): number {
  return Math.round(pricePerGb * gb * 100) / 100
}
