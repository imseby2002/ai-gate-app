// ECPay 環境設定
export function getEcpayConfig() {
  const isSandbox = process.env.ECPAY_IS_SANDBOX !== 'false'
  return {
    merchantId: process.env.ECPAY_MERCHANT_ID!,
    hashKey: process.env.ECPAY_HASH_KEY!,
    hashIV: process.env.ECPAY_HASH_IV!,
    paymentUrl: isSandbox
      ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
      : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
    // 信用卡定期定額訂單作業（取消／查詢），見 developers.ecpay.com.tw「信用卡定期定額訂單作業」
    periodActionUrl: isSandbox
      ? 'https://ecpayment-stage.ecpay.com.tw/1.0.0/Cashier/CreditCardPeriodAction'
      : 'https://ecpayment.ecpay.com.tw/1.0.0/Cashier/CreditCardPeriodAction',
    isSandbox,
  }
}

// 綠界 CheckMacValue 產生（SHA256）— 使用 Web Crypto API（Edge 相容）
export async function generateCheckMac(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string
): Promise<string> {
  const sorted = Object.keys(params)
    .filter(k => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  const raw = `HashKey=${hashKey}&${sorted.map(k => `${k}=${params[k]}`).join('&')}&HashIV=${hashIV}`

  // 綠界特殊 URL encode
  const encoded = encodeURIComponent(raw)
    .replace(/%20/g, '+')
    .replace(/%21/g, '!')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2A/g, '*')
    .replace(/%2D/g, '-')
    .replace(/%2E/g, '.')
    .replace(/%5F/g, '_')
    .toLowerCase()

  // Web Crypto API SHA-256
  const msgBuffer = new TextEncoder().encode(encoded)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// 驗證綠界回傳的 CheckMacValue
export async function verifyCheckMac(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string
): Promise<boolean> {
  const received = params.CheckMacValue
  if (!received) return false
  const expected = await generateCheckMac(params, hashKey, hashIV)
  return received.toUpperCase() === expected.toUpperCase()
}

// 綠界要求的交易時間格式：yyyy/MM/dd HH:mm:ss（24 小時制、數字補零）。
// 用 toLocaleString 組字串會依 Node/ICU 版本不同而不穩定（例如某些 ICU
// 版本 hour12:false 午夜會印出 24:00:00、或日期時間中間帶逗號），
// 改用 formatToParts 自己取欄位組字串，並明確指定 hourCycle: 'h23' 避免此問題。
export function formatEcpayTradeDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

// 解析付款完成後要導回的頁面。ECPay 付款完會把「瀏覽器」導回 OrderResultURL，
// 這是跨站 POST，不會帶登入 cookie，若落在需登入的頁面會被踢回登入頁（總覽）。
// 因此我們把 OrderResultURL 指向客戶「原本所在子域」的公開結果頁 /pay/result，
// 並帶上要返回的站內路徑（next）。回傳 origin 用來組 OrderResultURL、path 供結果頁返回。
// 安全性：只信任本站網域（*.im-tourist.com / APP_URL host / localhost），
// 避免被拿來把 OrderResultURL 導到任意外部網址。
export function resolvePayReturn(returnUrl?: string): { origin: string; path: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const fallback = { origin: appUrl, path: '/' }
  if (!returnUrl) return fallback
  try {
    const u = new URL(returnUrl)
    const host = u.hostname.toLowerCase()
    const appHost = new URL(appUrl).hostname.toLowerCase()
    const allowed = host === appHost || host === 'im-tourist.com' || host.endsWith('.im-tourist.com') || host === 'localhost'
    if (allowed && (u.protocol === 'https:' || u.protocol === 'http:')) {
      const path = u.pathname + u.search
      return { origin: u.origin, path: path.startsWith('/') && !path.startsWith('//') ? path : '/' }
    }
  } catch { /* 非法 URL → 用 fallback */ }
  return fallback
}

// 產生唯一訂單編號（綠界限制 20 字元英數）
export function generateTradeNo(userId: string): string {
  const now = Date.now().toString(36).toUpperCase()
  const uid = userId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `AG${uid}${now}`.slice(0, 20)
}

// 儲值方案 — 美金計價（不再用台幣定價）。usdPrice：實際支付金額；usdCredit：入帳點數（含優惠）。
// 送給綠界的 TotalAmount 於結帳當下用 lib/fx.ts 即時匯率把 usdPrice 換算成整數台幣。
export const CREDIT_PACKAGES = [
  {
    id: 'pkg_10',
    usdPrice: 10,
    usdCredit: 10.0,
    label: '$10',
    desc: '獲得 $10 美元 AI 點數',
    badge: '',
  },
  {
    id: 'pkg_30',
    usdPrice: 30,
    usdCredit: 35.0,
    label: '$30',
    desc: '獲得 $35 美元 AI 點數',
    badge: '推薦',
  },
  {
    id: 'pkg_95',
    usdPrice: 95,
    usdCredit: 110.0,
    label: '$95',
    desc: '獲得 $110 美元 AI 點數',
    badge: '最超值',
  },
] as const

export type PackageId = typeof CREDIT_PACKAGES[number]['id']

// ── 信用卡定期定額（固定金額、固定週期自動續扣；用於「勾選自動於下一期扣款」）──
// 綠界規定：TotalAmount 必須等於 PeriodAmount；PeriodType='M' 時 Frequency 上限 12、ExecTimes 上限 99。
// 這裡固定「每月扣一次」，ExecTimes 設 99（近 8 年）視同不限期，使用者可隨時在頁面取消。
export interface PeriodicFields {
  PeriodAmount: string
  PeriodType: string
  Frequency: string
  ExecTimes: string
  PeriodReturnURL: string
}

export function buildPeriodicFields(periodAmountTwd: number, periodReturnUrl: string): PeriodicFields {
  return {
    PeriodAmount: String(periodAmountTwd),
    PeriodType: 'M',
    Frequency: '1',
    ExecTimes: '99',
    PeriodReturnURL: periodReturnUrl,
  }
}

// 取消／終止定期定額訂單。Action='E' 為取消（來源：綠界「信用卡定期定額訂單作業」C=關帳／R=退刷／E=取消／N=放棄）。
export async function buildCancelPeriodicRequest(params: {
  merchantTradeNo: string
  tradeNo: string
  totalAmountTwd: number
}): Promise<{ url: string; params: Record<string, string> }> {
  const config = getEcpayConfig()
  const body: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: params.merchantTradeNo,
    TradeNo: params.tradeNo,
    Action: 'E',
    TotalAmount: String(params.totalAmountTwd),
  }
  body.CheckMacValue = await generateCheckMac(body, config.hashKey, config.hashIV)
  return { url: config.periodActionUrl, params: body }
}

// ── 信用卡綁定服務（記憶卡號）— 用於「低於門檻自動儲值」的背景扣款 ──────────────
// 首次以 AioCheckOut V5 + BindingCard=1 + MerchantMemberID 綁卡並完成首筆扣款；
// 之後的背景扣款走「幕後交易授權」API（見下方 chargeBoundCardBackground 的重要說明）。
export function buildMerchantMemberId(merchantId: string, userId: string): string {
  return `${merchantId}${userId.replace(/-/g, '')}`.slice(0, 30)
}

export function buildBindingCardFields(merchantMemberId: string): Record<string, string> {
  return {
    BindingCard: '1',
    MerchantMemberID: merchantMemberId,
  }
}

/**
 * 使用已綁定卡片做背景扣款（低於門檻自動儲值觸發）。
 *
 * ⚠️ 重要：綠界「幕後交易授權」(developers.ecpay.com.tw/45958/) 的確切端點與參數，
 * 在建置當下因文件站對自動化請求回傳 403 而無法逐欄位核對，此處實作為根據綠界
 * AioCheckOut／CheckMacValue 慣例的最佳猜測，**上線前必須先在綠界測試環境跑過一次
 * 真實請求並核對回傳格式**，否則請維持 ECPAY_BACKGROUND_CHARGE_ENABLED=false（預設關閉，
 * 此時系統會改用「餘額過低通知」讓客人手動儲值，不會嘗試背景扣款）。
 */
export async function chargeBoundCardBackground(params: {
  merchantMemberId: string
  totalAmountTwd: number
  merchantTradeNo: string
  itemName: string
}): Promise<{ url: string; params: Record<string, string> }> {
  const config = getEcpayConfig()
  const tradeDate = formatEcpayTradeDate()

  const body: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantMemberID: params.merchantMemberId,
    MerchantTradeNo: params.merchantTradeNo,
    MerchantTradeDate: tradeDate,
    TotalAmount: String(params.totalAmountTwd),
    TradeDesc: encodeURIComponent(params.itemName),
    ItemName: params.itemName,
  }
  body.CheckMacValue = await generateCheckMac(body, config.hashKey, config.hashIV)

  // 幕後交易授權端點（同上方註記，上線前需核對）
  const url = config.isSandbox
    ? 'https://ecpayment-stage.ecpay.com.tw/CreditDetail/CardBinding'
    : 'https://ecpayment.ecpay.com.tw/CreditDetail/CardBinding'

  return { url, params: body }
}
