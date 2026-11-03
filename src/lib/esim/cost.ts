import { getEsimSettings } from './db'
import { DEFAULT_PRICING_SETTINGS, EsimPricingSettings } from './catalog'

/** 取得後台定價設定的港幣→台幣匯率（成本換算用） */
export async function getHkdTwdRate(): Promise<number> {
  try {
    const s = await getEsimSettings<EsimPricingSettings>('pricing_settings', DEFAULT_PRICING_SETTINGS)
    return Number(s?.hkd_twd_rate) || DEFAULT_PRICING_SETTINGS.hkd_twd_rate
  } catch {
    return DEFAULT_PRICING_SETTINGS.hkd_twd_rate
  }
}

/** 訂單成本（台幣，四捨五入） */
export function orderCostTwd(costHkd: unknown, rate: number): number {
  return Math.round((Number(costHkd) || 0) * rate)
}
