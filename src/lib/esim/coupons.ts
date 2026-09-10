import { getEsimSettings, saveEsimSettings } from './db'

export interface EsimCoupon {
  id: string
  code: string // e.g. "WELCOME50", "TRAVEL9", "JAPAN88" (大寫無空白)
  name: string // e.g. "新客首購折扣 NT$ 50", "出國限時 9 折優惠"
  discount_type: 'fixed' | 'percent' // 'fixed' = 現折固定金額 (TWD), 'percent' = 折扣成數 (例如 0.9 = 9折, 0.85 = 85折)
  discount_value: number // 50 (代表折 50 元) 或 0.9 (代表 9 折)
  min_spend_twd: number // 最低消費門檻金額 (0 代表無門檻)
  max_discount_twd?: number // 折扣上限金額 (可選)
  applicable_countries?: string[] // 限定國家代碼 (可選，例如 ["JP"]，空陣列代表全館通用)
  is_active: boolean // 是否啟用
  usage_count: number // 已套用次數
  max_usage_count?: number // 最大可使用次數限制 (可選)
  expires_at?: string // 到期時間 (YYYY-MM-DD 或 ISO 8601，可選)
  created_at: string
}

export const DEFAULT_COUPONS: EsimCoupon[] = [
  {
    id: 'coupon_welcome50',
    code: 'WELCOME50',
    name: '新客首購現折 NT$ 50',
    discount_type: 'fixed',
    discount_value: 50,
    min_spend_twd: 100,
    is_active: true,
    usage_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'coupon_travel9',
    code: 'TRAVEL9',
    name: '出國限時全館 9 折優惠',
    discount_type: 'percent',
    discount_value: 0.9,
    min_spend_twd: 0,
    is_active: true,
    usage_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'coupon_japan88',
    code: 'JAPAN88',
    name: '日本旅遊專屬 88 折',
    discount_type: 'percent',
    discount_value: 0.88,
    min_spend_twd: 200,
    applicable_countries: ['JP'],
    is_active: true,
    usage_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  },
]

/**
 * 取得所有優惠券清單
 */
export async function getCoupons(): Promise<EsimCoupon[]> {
  try {
    const list = await getEsimSettings<EsimCoupon[]>('esim_coupons', DEFAULT_COUPONS)
    if (!Array.isArray(list) || list.length === 0) {
      return DEFAULT_COUPONS
    }
    return list
  } catch (err) {
    console.warn('[Coupons] Failed to load coupons, using defaults:', err)
    return DEFAULT_COUPONS
  }
}

/**
 * 儲存優惠券清單
 */
export async function saveCoupons(coupons: EsimCoupon[]): Promise<boolean> {
  return await saveEsimSettings('esim_coupons', coupons, 'eSIM 商城優惠券清單')
}

export interface CouponValidationResult {
  valid: boolean
  error?: string
  coupon?: EsimCoupon
  discountTwd: number
  finalPriceTwd: number
}

/**
 * 驗證並計算優惠券折扣
 * @param rawCode 使用者輸入的優惠券代碼
 * @param subtotalTwd 訂單小計金額 (TWD)
 * @param countryCode 訂單所屬國家代碼 (可選，例如 "JP")
 */
export async function validateCoupon(
  rawCode: string,
  subtotalTwd: number,
  countryCode?: string
): Promise<CouponValidationResult> {
  const code = (rawCode || '').trim().toUpperCase()
  if (!code) {
    return {
      valid: false,
      error: '請輸入優惠券代碼',
      discountTwd: 0,
      finalPriceTwd: subtotalTwd,
    }
  }

  const coupons = await getCoupons()
  const coupon = coupons.find(c => c.code.toUpperCase() === code)

  if (!coupon) {
    return {
      valid: false,
      error: `找不到優惠券代碼「${code}」，請確認是否輸入正確`,
      discountTwd: 0,
      finalPriceTwd: subtotalTwd,
    }
  }

  if (!coupon.is_active) {
    return {
      valid: false,
      error: `優惠券「${code}」目前已暫停使用`,
      discountTwd: 0,
      finalPriceTwd: subtotalTwd,
    }
  }

  // 1. 檢查到期日
  if (coupon.expires_at) {
    const expiryTime = new Date(coupon.expires_at).getTime()
    if (!isNaN(expiryTime) && Date.now() > expiryTime) {
      return {
        valid: false,
        error: `優惠券「${code}」已於 ${coupon.expires_at.split('T')[0]} 截止失效`,
        discountTwd: 0,
        finalPriceTwd: subtotalTwd,
      }
    }
  }

  // 2. 檢查使用次數上限
  if (typeof coupon.max_usage_count === 'number' && coupon.max_usage_count > 0) {
    if ((coupon.usage_count || 0) >= coupon.max_usage_count) {
      return {
        valid: false,
        error: `優惠券「${code}」已達兌換次數上限`,
        discountTwd: 0,
        finalPriceTwd: subtotalTwd,
      }
    }
  }

  // 3. 檢查適用國家
  if (coupon.applicable_countries && coupon.applicable_countries.length > 0) {
    const targetCountry = (countryCode || '').toUpperCase().trim()
    const isApplicable = coupon.applicable_countries.some(c => c.toUpperCase() === targetCountry)
    if (!isApplicable) {
      return {
        valid: false,
        error: `此優惠碼僅適用於指定國家/地區（${coupon.applicable_countries.join(', ')}）`,
        discountTwd: 0,
        finalPriceTwd: subtotalTwd,
      }
    }
  }

  // 4. 檢查最低消費金額
  if (coupon.min_spend_twd > 0 && subtotalTwd < coupon.min_spend_twd) {
    return {
      valid: false,
      error: `此優惠碼需單筆消費滿 NT$ ${coupon.min_spend_twd} 方可折抵（目前為 NT$ ${subtotalTwd}）`,
      discountTwd: 0,
      finalPriceTwd: subtotalTwd,
    }
  }

  // 5. 計算折扣金額
  let discountTwd = 0
  if (coupon.discount_type === 'fixed') {
    discountTwd = Math.min(subtotalTwd, coupon.discount_value)
  } else if (coupon.discount_type === 'percent') {
    // discount_value 例如 0.9 代表打 9 折，折扣金額 = subtotal * (1 - 0.9)
    const discountRate = Math.max(0, Math.min(1, 1 - coupon.discount_value))
    let calculated = Math.round(subtotalTwd * discountRate)
    if (typeof coupon.max_discount_twd === 'number' && coupon.max_discount_twd > 0) {
      calculated = Math.min(calculated, coupon.max_discount_twd)
    }
    discountTwd = Math.min(subtotalTwd, calculated)
  }

  const finalPriceTwd = Math.max(0, subtotalTwd - discountTwd)

  return {
    valid: true,
    coupon,
    discountTwd,
    finalPriceTwd,
  }
}

/**
 * 訂單成功結帳後，累計優惠券使用次數
 */
export async function incrementCouponUsage(code: string): Promise<void> {
  try {
    const coupons = await getCoupons()
    const target = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase())
    if (target) {
      target.usage_count = (target.usage_count || 0) + 1
      await saveCoupons(coupons)
    }
  } catch (err) {
    console.warn('[Coupons] Failed to increment coupon usage:', err)
  }
}
