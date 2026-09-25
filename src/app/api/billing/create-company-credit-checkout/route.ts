import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canTopUpCompanyWallet } from '@/lib/company/membership'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
  resolvePayReturn,
  CREDIT_PACKAGES,
  type PackageId,
} from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'

// POST /api/billing/create-company-credit-checkout
// 公司錢包線上儲值：負責人／管理員／經理或財務單位成員可操作，沿用個人儲值的點數方案（含優惠）。
// 付款成功後由 ecpay-return 依 trade_no 寫入公司錢包的儲值桶。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await canTopUpCompanyWallet(user.id)
  if (!company) return NextResponse.json({ error: '公司錢包儲值需由負責人、管理員、經理或財務人員操作' }, { status: 403 })

  const { packageId, returnUrl } = await req.json() as { packageId: PackageId; returnUrl?: string }
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的儲值方案' }, { status: 400 })

  // 公司錢包只在公司方案有效時被使用，未啟用前先擋下，避免儲值後用不到
  const admin = createAdminClient()
  const { data: active } = await admin.rpc('company_plan_active', { p_company_id: company.companyId })
  if (!active) return NextResponse.json({ error: '請先啟用公司版再儲值公司錢包' }, { status: 400 })

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(company.companyId)
  const tradeDate = formatEcpayTradeDate()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { origin, path } = resolvePayReturn(returnUrl)
  const nextEnc = encodeURIComponent(path)
  const { twd: totalAmountTwd } = await usdToTwdInteger(pkg.usdPrice)

  const { error: insertErr } = await admin.from('company_credit_purchases').insert({
    company_id: company.companyId,
    purchased_by: user.id,
    trade_no: tradeNo,
    package_id: pkg.id,
    usd_credit: pkg.usdCredit,
    twd_amount: totalAmountTwd,
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const itemName = `AI GATE 公司點數 ${pkg.label}`
  const params: Record<string, string> = {
    MerchantID:        config.merchantId,
    MerchantTradeNo:   tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType:       'aio',
    TotalAmount:       String(totalAmountTwd),
    TradeDesc:         encodeURIComponent(itemName),
    ItemName:          itemName,
    ReturnURL:         `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:    `${origin}/pay/result?status=done&type=credit&next=${nextEnc}`,
    ChoosePayment:     'ALL',
    EncryptType:       '1',
    ClientBackURL:     `${origin}/pay/result?status=cancel&type=credit&next=${nextEnc}`,
  }
  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: { label: pkg.label, usdCredit: pkg.usdCredit },
  })
}
