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
import { COMPANY_PLAN_PACKAGES, type CompanyPlanPackageId } from '@/lib/ecpay/company-plans'

// POST /api/billing/create-company-plan-checkout
// 公司負責人／IT 管理員自助升級公司會員方案。一次性付款（不像 CS／訂房方案
// 目前提供自動續訂勾選），到期前需自行再次購買延續，先求正確上線、日後再視
// 需要加開定期定額。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = await getUserCompany(user.id)
  if (!company) return NextResponse.json({ error: '你目前不屬於任何公司' }, { status: 403 })
  if (company.role !== 'owner' && company.role !== 'admin') {
    return NextResponse.json({ error: '方案升級需由公司負責人或管理員操作' }, { status: 403 })
  }

  const { packageId, returnUrl } = await req.json() as { packageId: CompanyPlanPackageId; returnUrl?: string }
  const pkg = COMPANY_PLAN_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  // 現有方案尚未到期時，禁止購買「較低」方案：付款回調會直接覆蓋訂閱，
  // 等於立刻降級且剩餘天數全部消失。同方案續購（延長）與升級不受限。
  // 用 service role：company_subscriptions／company_plan_purchases 的 RLS
  // 只讓同公司角色讀寫自己公司的資料，這裡已經驗證過 company.role，
  // 用 admin client 避免請求端 client 在某些邊界情況下讀不到剛建立的 row。
  const admin = createAdminClient()
  const PLAN_RANK: Record<string, number> = { free: 0, core: 1, pro: 2, max: 3 }
  const { data: currentSub } = await admin
    .from('company_subscriptions')
    .select('plan, status, current_period_end')
    .eq('company_id', company.companyId)
    .maybeSingle()
  const subActive = currentSub?.status === 'active'
    && (!currentSub.current_period_end || new Date(currentSub.current_period_end).getTime() > Date.now())
  if (subActive && (PLAN_RANK[pkg.plan] ?? 0) < (PLAN_RANK[currentSub!.plan] ?? 0)) {
    const endDate = currentSub!.current_period_end
      ? new Date(currentSub!.current_period_end).toLocaleDateString('zh-TW')
      : null
    return NextResponse.json({
      error: `目前的 ${String(currentSub!.plan).toUpperCase()} 方案尚未到期${endDate ? `（至 ${endDate}）` : ''}，購買較低方案會立即降級並喪失剩餘天數。請於到期後再購買，或聯繫管理員協助變更。`,
    }, { status: 400 })
  }

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(company.companyId)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { origin, path } = resolvePayReturn(returnUrl)
  const nextEnc = encodeURIComponent(path)
  const { twd: totalAmountTwd } = await usdToTwdInteger(pkg.usdPrice)

  // 先建立待處理訂單，ecpay-return 回調時依 trade_no 找到這筆並升級方案
  const { error: insertErr } = await admin.from('company_plan_purchases').insert({
    company_id: company.companyId,
    purchased_by: user.id,
    trade_no: tradeNo,
    plan: pkg.plan,
    billing_cycle: pkg.cycle,
    twd_amount: totalAmountTwd,
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
    OrderResultURL:   `${origin}/pay/result?status=done&type=plan&next=${nextEnc}`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${origin}/pay/result?status=cancel&type=plan&next=${nextEnc}`,
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: { label: pkg.label },
  })
}
