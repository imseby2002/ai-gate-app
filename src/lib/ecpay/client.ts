import crypto from 'crypto'

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

// 綠界 CheckMacValue 產生（SHA256）
export function generateCheckMac(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string
): string {
  // 移除 CheckMacValue 本身，按 key 字母排序（不分大小寫）
  const sorted = Object.keys(params)
    .filter(k => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  const raw = `HashKey=${hashKey}&${sorted.map(k => `${k}=${params[k]}`).join('&')}&HashIV=${hashIV}`

  // 綠界特殊 URL encode（與標準不同）
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

  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase()
}

// 驗證綠界回傳的 CheckMacValue
export function verifyCheckMac(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string
): boolean {
  const received = params.CheckMacValue
  if (!received) return false
  const expected = generateCheckMac(params, hashKey, hashIV)
  return received.toUpperCase() === expected.toUpperCase()
}

// 產生唯一訂單編號（綠界限制 20 字元英數）
export function generateTradeNo(userId: string): string {
  const now = Date.now().toString(36).toUpperCase()
  const uid = userId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `AG${uid}${now}`.slice(0, 20)
}

// 從訂單編號解析 userId（存在 metadata 裡，這裡只做前綴辨識）
// 實際 userId 存在 credit_transactions 的 description 欄位

// 儲值方案（TWD → USD 以 1:32 換算，給用戶 5% 優惠）
export const CREDIT_PACKAGES = [
  {
    id: 'pkg_300',
    twdAmount: 300,
    usdCredit: 10.0,      // $10 USD credit
    label: 'NT$300',
    desc: '獲得 $10 美元 AI 點數',
    badge: '',
  },
  {
    id: 'pkg_1000',
    twdAmount: 1000,
    usdCredit: 35.0,      // $35 USD credit（優惠 12%）
    label: 'NT$1,000',
    desc: '獲得 $35 美元 AI 點數',
    badge: '推薦',
  },
  {
    id: 'pkg_3000',
    twdAmount: 3000,
    usdCredit: 110.0,     // $110 USD credit（優惠 15%）
    label: 'NT$3,000',
    desc: '獲得 $110 美元 AI 點數',
    badge: '最超值',
  },
] as const

export type PackageId = typeof CREDIT_PACKAGES[number]['id']
