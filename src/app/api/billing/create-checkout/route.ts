import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
  CREDIT_PACKAGES,
  type PackageId,
} from '@/lib/ecpay/client'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json() as { packageId: PackageId }
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的儲值方案' }, { status: 400 })

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // 先建立待處理記錄，讓回調時可以查到 userId
  await supabase.from('credit_transactions').insert({
    user_id: user.id,
    amount_usd: 0,                             // 尚未完成付款，金額為 0
    type: 'purchase',
    description: `PENDING:${tradeNo}:${pkg.id}:${pkg.usdCredit}`,
    balance_after: 0,
  })

  // 組建綠界必要參數
  const params: Record<string, string> = {
    MerchantID:       config.merchantId,
    MerchantTradeNo:  tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType:      'aio',
    TotalAmount:      String(pkg.twdAmount),
    TradeDesc:        encodeURIComponent(`AI GATE 點數 ${pkg.label}`),
    ItemName:         `AI GATE 點數 ${pkg.label}`,
    ReturnURL:        `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:   `${appUrl}/settings?payment=done`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${appUrl}/settings?payment=cancel`,
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  // 回傳表單參數讓前端自動提交
  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: {
      label: pkg.label,
      usdCredit: pkg.usdCredit,
    },
  })
}
