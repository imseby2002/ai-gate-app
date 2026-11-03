import { getEsimSettings, saveEsimSettings, getEsimOrdersByCouponCode } from './db'

export interface EsimCoupon {
  id: string
  code: string // e.g. "WELCOME50", "TRAVEL9", "JAPAN88" (大寫無空白)
  name: string // e.g. "新客首購折扣 NT$ 50", "出國限時 9 折優惠"
  discount_type: 'fixed' | 'percent' | 'free' // 'fixed' = 現折固定金額 (TWD), 'percent' = 折扣成數 (例如 0.9 = 9折), 'free' = 贈品（免費兌換 1 張）
  discount_value: number // 50 (代表折 50 元) 或 0.9 (代表 9 折)
  min_spend_twd: number // 最低消費門檻金額 (0 代表無門檻)
  max_discount_twd?: number // 折扣上限金額 (可選)
  applicable_countries?: string[] // 限定國家代碼 (可選，例如 ["JP"]，空陣列代表全館通用)
  applicable_plan_ids?: string[] // 限定產品 channel_dataplan_id (可選，空代表不限)
  applicable_plan_names?: Record<string, string> // 限定產品顯示名稱 (id → 名稱)
  is_active: boolean // 是否啟用
  usage_count: number // 已套用次數
  max_usage_count?: number // 最大可使用次數限制 (可選)
  max_uses_per_customer?: number // 每位顧客（依 Email）可使用次數 (可選)
  max_uses_per_day?: number // 每日（台灣時間）可使用次數 (可選)
  starts_at?: string // 啟用日期 (YYYY-MM-DD 或 ISO 8601，可選；只填日期時為台灣時間當天 00:00 開始)
  expires_at?: string // 到期時間 (YYYY-MM-DD 或 ISO 8601，可選)
  cs_gift_emails?: string[] // 允許當作 CS 客服贈品發放的帳號 Email（系統會依此券複製出客人專屬、只能用一次的兌換碼）
  cs_gift_source?: string // 由哪張範本券複製出的 CS 贈品兌換碼（範本券代碼）
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
  countryCode?: string,
  opts: { planId?: string; unitPriceTwd?: number; customerEmail?: string } = {}
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

  // CS 贈品範本券只給系統複製客人專屬兌換碼用，代碼本身不能直接兌換
  if ((coupon.cs_gift_emails ?? []).length > 0 && !coupon.cs_gift_source) {
    return {
      valid: false,
      error: `優惠代碼「${code}」無法直接使用，請輸入您收到的專屬兌換碼`,
      discountTwd: 0,
      finalPriceTwd: subtotalTwd,
    }
  }

  // 0. 檢查啟用日期
  if (coupon.starts_at) {
    const startTime = /^\d{4}-\d{2}-\d{2}$/.test(coupon.starts_at)
      ? new Date(`${coupon.starts_at}T00:00:00+08:00`).getTime()
      : new Date(coupon.starts_at).getTime()
    if (!isNaN(startTime) && Date.now() < startTime) {
      return {
        valid: false,
        error: `優惠券「${code}」將於 ${coupon.starts_at.split('T')[0]} 開始使用`,
        discountTwd: 0,
        finalPriceTwd: subtotalTwd,
      }
    }
  }

  // 1. 檢查到期日
  if (coupon.expires_at) {
    // 只填日期時，視為台灣時間當天 23:59:59 到期
    const expiryTime = /^\d{4}-\d{2}-\d{2}$/.test(coupon.expires_at)
      ? new Date(`${coupon.expires_at}T23:59:59+08:00`).getTime()
      : new Date(coupon.expires_at).getTime()
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

  // 2.5 檢查每人限用次數（依 Email，只計已付款訂單）
  const perCustomer = coupon.max_uses_per_customer
  const email = (opts.customerEmail || '').trim().toLowerCase()
  if (typeof perCustomer === 'number' && perCustomer > 0 && email) {
    try {
      const orders = await getEsimOrdersByCouponCode(coupon.code)
      const used = orders.filter(
        o => o.payment_status === 'paid' && (o.customer_email || '').trim().toLowerCase() === email
      ).length
      if (used >= perCustomer) {
        return {
          valid: false,
          error: `此優惠碼每位顧客限用 ${perCustomer} 次，您已使用過`,
          discountTwd: 0,
          finalPriceTwd: subtotalTwd,
        }
      }
    } catch (err) {
      console.warn('[Coupons] Failed to check per-customer usage:', err)
    }
  }

  // 2.6 檢查每日使用上限（台灣時間當日，只計已付款訂單）
  const perDay = coupon.max_uses_per_day
  if (typeof perDay === 'number' && perDay > 0) {
    try {
      const twDay = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
      const today = twDay(new Date().toISOString())
      const orders = await getEsimOrdersByCouponCode(coupon.code)
      const usedToday = orders.filter(
        o => o.payment_status === 'paid' && twDay(o.paid_at || o.created_at) === today
      ).length
      if (usedToday >= perDay) {
        return {
          valid: false,
          error: `優惠券「${code}」今日名額已滿（每日限 ${perDay} 次），請明天再試`,
          discountTwd: 0,
          finalPriceTwd: subtotalTwd,
        }
      }
    } catch (err) {
      console.warn('[Coupons] Failed to check daily usage:', err)
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

  // 3.5 檢查限定產品
  if (coupon.applicable_plan_ids && coupon.applicable_plan_ids.length > 0) {
    if (!opts.planId || !coupon.applicable_plan_ids.includes(opts.planId)) {
      const names = coupon.applicable_plan_ids
        .map(id => coupon.applicable_plan_names?.[id] || id)
        .slice(0, 5)
        .join('、')
      return {
        valid: false,
        error: `此優惠碼僅適用於指定產品（${names}${coupon.applicable_plan_ids.length > 5 ? ' 等' : ''}）`,
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
  } else if (coupon.discount_type === 'free') {
    // 贈品：免費兌換 1 張
    const unit = typeof opts.unitPriceTwd === 'number' && opts.unitPriceTwd > 0 ? opts.unitPriceTwd : subtotalTwd
    discountTwd = Math.min(subtotalTwd, unit)
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
