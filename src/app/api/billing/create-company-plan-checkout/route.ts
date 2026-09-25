import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompany } from '@/lib/company/membership'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
  resolvePayReturn,
} from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'
import { calcCompanyPrice } from '@/lib/company/pricing'

// POST /api/billing/create-company-plan-checkout
// 公司負責人／IT 管理員支付公司方案（模組化計價，見 lib/company/pricing.ts）。
// 一次性付款，到期前需自行再次購買延續。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '你目前不屬於任何公司' }, { status: 403 })
  if (company.role !== 'owner' && company.role !== 'admin') {
    return NextResponse.json({ error: '方案升級需由公司負責人或管理員操作' }, { status: 403 })
  }

  const { cycle, returnUrl } = await req.json() as { cycle?: 'monthly' | 'yearly'; returnUrl?: string }
  if (cycle !== 'monthly' && cycle !== 'yearly') return NextResponse.json({ error: '無效的繳費週期' }, { status: 400 })

  // 價格一律在伺服器端依平台設定的開通內容計算（開通模組由 admin 設定，公司不能自行加選），
  // 公司方案只剩 'company' 一種，續購即延長、不存在降級問題。
  // 用 service role：company_subscriptions／company_plan_purchases 的 RLS 只讓同公司角色讀寫，
  // 這裡已經驗證過 company.role。
  const admin = createAdminClient()
  const [{ data: companyRow }, { data: currentSub }] = await Promise.all([
    admin.from('companies').select('enabled_modules').eq('id', company.companyId).single(),
    admin.from('company_subscriptions').select('erp_seats, retail_stores, custom_domain').eq('company_id', company.companyId).maybeSingle(),
  ])
  const pricingConfig = {
    modules: companyRow?.enabled_modules ?? [],
    erpSeats: currentSub?.erp_seats ?? 0,
    retailStores: currentSub?.retail_stores ?? 0,
    customDomain: currentSub?.custom_domain ?? false,
  }
  const { lines, totalUsd } = calcCompanyPrice(pricingConfig, cycle)
  const label = `公司方案（${cycle === 'yearly' ? '年繳' : '月繳'}）`

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(company.companyId)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { origin, path } = resolvePayReturn(returnUrl)
  const nextEnc = encodeURIComponent(path)
  const { twd: totalAmountTwd } = await usdToTwdInteger(totalUsd)

  // 先建立待處理訂單，ecpay-return 回調時依 trade_no 找到這筆並升級方案
  const { error: insertErr } = await admin.from('company_plan_purchases').insert({
    company_id: company.companyId,
    purchased_by: user.id,
    trade_no: tradeNo,
    plan: 'company',
    billing_cycle: cycle,
    twd_amount: totalAmountTwd,
    pricing_snapshot: { ...pricingConfig, lines, totalUsd },
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const params: Record<string, string> = {
    MerchantID:       config.merchantId,
    MerchantTradeNo:  tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType:      'aio',
    TotalAmount:      String(totalAmountTwd),
    TradeDesc:        encodeURIComponent(`AI GATE ${label}`),
    ItemName:         `AI GATE ${label}`,
    ReturnURL:        `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:   `${origin}/pay/result?status=done&type=plan&next=${nextEnc}`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${origin}/pay/result?status=cancel&type=plan&next=${nextEnc}`,
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: { label, totalUsd },
  })
}
