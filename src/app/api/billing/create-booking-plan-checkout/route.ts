import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
} from '@/lib/ecpay/client'
import { BOOKING_PLAN_PACKAGES, type BookingPlanPackageId } from '@/lib/ecpay/booking-plans'

// POST /api/billing/create-booking-plan-checkout
// 客戶自助升級訂房方案：一次性 ECPay 付款（非自動續訂），到期前需自行再次購買延續。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId, referralCode } = await req.json() as { packageId: BookingPlanPackageId; referralCode?: string }
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
    referralCodeUsed = trimmedCode
  }

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // 先建立待處理訂單，ecpay-return 回調時依 trade_no 找到這筆並升級方案
  const { error: insertErr } = await supabase.from('booking_plan_purchases').insert({
    user_id: user.id,
    trade_no: tradeNo,
    plan: pkg.plan,
    billing_cycle: pkg.cycle,
    twd_amount: pkg.twdAmount,
    referral_code_used: referralCodeUsed,
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
    OrderResultURL:   `${appUrl}/booking/plan?upgrade=done`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${appUrl}/booking/plan?upgrade=cancel`,
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: { label: pkg.label },
  })
}
