import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
  resolvePayReturn,
  buildPeriodicFields,
  CREDIT_PACKAGES,
  type PackageId,
} from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId, returnUrl, autoRenew } = await req.json() as { packageId: PackageId; returnUrl?: string; autoRenew?: boolean }
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的儲值方案' }, { status: 400 })

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  // 付款完成導回客戶原本所在子域的公開結果頁（免登入，顯示成功並帶回原頁）
  const { origin, path } = resolvePayReturn(returnUrl)
  const nextEnc = encodeURIComponent(path)
  const { twd: totalAmountTwd, rate } = await usdToTwdInteger(pkg.usdPrice)

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
    TotalAmount:      String(totalAmountTwd),
    TradeDesc:        encodeURIComponent(`AI GATE 點數 ${pkg.label}`),
    ItemName:         `AI GATE 點數 ${pkg.label}`,
    ReturnURL:        `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:   `${origin}/pay/result?status=done&type=credit&next=${nextEnc}`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${origin}/pay/result?status=cancel&type=credit&next=${nextEnc}`,
  }

  // 勾選「自動於下一期扣款」→ 加上定期定額欄位，並建立追蹤記錄供之後取消/查詢。
  // 綠界定期定額僅支援信用卡，不可用 ALL（會包含 ATM/超商等無法自動扣款的方式）。
  if (autoRenew) {
    params.ChoosePayment = 'Credit'
    Object.assign(params, buildPeriodicFields(totalAmountTwd, `${appUrl}/api/billing/ecpay-period-return`))

    const admin = createAdminClient()
    await admin.from('ecpay_periodic_orders').insert({
      user_id: user.id,
      kind: 'credit_topup',
      reference_id: pkg.id,
      merchant_trade_no: tradeNo,
      period_type: 'M',
      frequency: 1,
      exec_times: 99,
      period_amount_twd: totalAmountTwd,
      usd_value: pkg.usdCredit,
      fx_rate: rate,
      status: 'pending',
    })
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
