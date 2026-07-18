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

// 儲值方案（TWD → USD 以 1:32 換算，給用戶 5% 優惠）
export const CREDIT_PACKAGES = [
  {
    id: 'pkg_300',
    twdAmount: 300,
    usdCredit: 10.0,
    label: 'NT$300',
    desc: '獲得 $10 美元 AI 點數',
    badge: '',
  },
  {
    id: 'pkg_1000',
    twdAmount: 1000,
    usdCredit: 35.0,
    label: 'NT$1,000',
    desc: '獲得 $35 美元 AI 點數',
    badge: '推薦',
  },
  {
    id: 'pkg_3000',
    twdAmount: 3000,
    usdCredit: 110.0,
    label: 'NT$3,000',
    desc: '獲得 $110 美元 AI 點數',
    badge: '最超值',
  },
] as const

export type PackageId = typeof CREDIT_PACKAGES[number]['id']
