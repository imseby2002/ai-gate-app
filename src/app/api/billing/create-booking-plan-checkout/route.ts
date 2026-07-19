import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
  buildPeriodicFields,
} from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'
import { BOOKING_PLAN_PACKAGES, type BookingPlanPackageId } from '@/lib/ecpay/booking-plans'

// POST /api/billing/create-booking-plan-checkout
// 客戶自助升級訂房方案：可勾選「自動於下一期扣款」走綠界定期定額，否則為一次性付款（到期前需自行再次購買延續）。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId, referralCode, autoRenew } = await req.json() as { packageId: BookingPlanPackageId; referralCode?: string; autoRenew?: boolean }
  const pkg = BOOKING_PLAN_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  // 推薦碼驗證：必須存在、且不能是自己的碼（防自我推薦）
  let referralCodeUsed: string | null = null
  const trimmedCode = referralCode?.trim().toUpperCase()
  if (trimmedCode) {
    // 推薦碼查詢需跨用戶讀取，RLS 只允許讀自己的 row，這裡改用 service role。
    const admin = createAdminClient()
    const { data: referrer } = await admin
      .from('booking_subscriptions')
      .select('user_id')
      .eq('referral_code', trimmedCode)
      .maybeSingle()
    if (!referrer) return NextResponse.json({ error: '推薦碼不存在，請確認後再試' }, { status: 400 })
    if (referrer.user_id === user.id) return NextResponse.json({ error: '不能使用自己的推薦碼' }, { status: 400 })

    // 推薦碼僅限首次付費使用，已經是付費客戶不能事後補用推薦碼賺天數
    const { data: priorPaid } = await admin
      .from('booking_plan_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .limit(1)
      .maybeSingle()
    if (priorPaid) return NextResponse.json({ error: '推薦碼僅限首次付費使用' }, { status: 400 })

    referralCodeUsed = trimmedCode
  }

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { twd: totalAmountTwd, rate } = await usdToTwdInteger(pkg.usdPrice)

  // 先建立待處理訂單，ecpay-return 回調時依 trade_no 找到這筆並升級方案
  const { error: insertErr } = await supabase.from('booking_plan_purchases').insert({
    user_id: user.id,
    trade_no: tradeNo,
    plan: pkg.plan,
    billing_cycle: pkg.cycle,
    twd_amount: totalAmountTwd,
    referral_code_used: referralCodeUsed,
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const params: Record<string, string> = {
    MerchantID:       config.merchantId,
    MerchantTradeNo:  tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType:      'aio',
    TotalAmount:      String(totalAmountTwd),
    TradeDesc:        encodeURIComponent(`AI GATE ${pkg.label}`),
    ItemName:         `AI GATE ${pkg.label}`,
    ReturnURL:        `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:   `${appUrl}/booking/plan?upgrade=done`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${appUrl}/booking/plan?upgrade=cancel`,
  }

  // 勾選「自動於下一期扣款」→ 走綠界定期定額。推薦碼只在首次付費核銷（見 ecpay-return），
  // 自動續扣的後續期數不重複核銷，故定期定額與推薦碼可以並存。
  if (autoRenew) {
    params.ChoosePayment = 'Credit'
    Object.assign(params, buildPeriodicFields(totalAmountTwd, `${appUrl}/api/billing/ecpay-period-return`))

    const admin = createAdminClient()
    await admin.from('ecpay_periodic_orders').insert({
      user_id: user.id,
      kind: 'booking_plan',
      reference_id: pkg.id,
      merchant_trade_no: tradeNo,
      period_type: 'M',
      frequency: 1,
      exec_times: 99,
      period_amount_twd: totalAmountTwd,
      usd_value: pkg.usdPrice,
      fx_rate: rate,
      status: 'pending',
    })
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: { label: pkg.label },
  })
}
