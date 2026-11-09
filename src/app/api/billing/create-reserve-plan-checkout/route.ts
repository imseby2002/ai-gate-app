import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEcpayConfig, generateCheckMac, generateTradeNo, formatEcpayTradeDate } from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'
import { RESERVE_PLAN_PACKAGES, type ReservePlanPackageId } from '@/lib/ecpay/reserve-plans'

// POST /api/billing/create-reserve-plan-checkout
// 預約系統升級 CORE：一次性 ECPay 付款（非自動續訂），到期前再次購買會從原到期日往後延。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json().catch(() => ({})) as { packageId?: ReservePlanPackageId }
  const pkg = RESERVE_PLAN_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { twd: totalAmountTwd } = await usdToTwdInteger(pkg.usdPrice)

  // 先建立待處理訂單，ecpay-return 回調時依 trade_no 找到這筆並升級方案
  const { error: insertErr } = await supabase.from('reserve_plan_purchases').insert({
    user_id: user.id,
    trade_no: tradeNo,
    plan: pkg.plan,
    billing_cycle: pkg.cycle,
    twd_amount: totalAmountTwd,
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const params: Record<string, string> = {
    MerchantID:        config.merchantId,
    MerchantTradeNo:   tradeNo,
    MerchantTradeDate: formatEcpayTradeDate(),
    PaymentType:       'aio',
    TotalAmount:       String(totalAmountTwd),
    TradeDesc:         encodeURIComponent(`AI GATE ${pkg.label}`),
    ItemName:          `AI GATE ${pkg.label}`,
    ReturnURL:         `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:    `${appUrl}/reserve/plan?upgrade=done`,
    ChoosePayment:     'ALL',
    EncryptType:       '1',
    ClientBackURL:     `${appUrl}/reserve/plan?upgrade=cancel`,
  }
  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({ paymentUrl: config.paymentUrl, params, packageInfo: { label: pkg.label } })
}
