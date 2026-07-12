import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
} from '@/lib/ecpay/client'
import { CS_PLAN_PACKAGES, type CsPlanPackageId } from '@/lib/ecpay/cs-plans'

// POST /api/billing/create-cs-plan-checkout
// 客戶自助升級 CS 方案：一次性 ECPay 付款（非自動續訂），到期前需自行再次購買延續。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json() as { packageId: CsPlanPackageId }
  const pkg = CS_PLAN_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // 先建立待處理訂單，ecpay-return 回調時依 trade_no 找到這筆並升級方案
  const { error: insertErr } = await supabase.from('cs_plan_purchases').insert({
    user_id: user.id,
    trade_no: tradeNo,
    plan: pkg.plan,
    billing_cycle: pkg.cycle,
    twd_amount: pkg.twdAmount,
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const params: Record<string, string> = {
    MerchantID:       config.merchantId,
    MerchantTradeNo:  tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType:      'aio',
    TotalAmount:      String(pkg.twdAmount),
    TradeDesc:        encodeURIComponent(`AI GATE ${pkg.label}`),
    ItemName:         `AI GATE ${pkg.label}`,
    ReturnURL:        `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:   `${appUrl}/cs/plan?upgrade=done`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${appUrl}/cs/plan?upgrade=cancel`,
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: { label: pkg.label },
  })
}
