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
} from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'
import { CS_PLAN_PACKAGES, type CsPlanPackageId } from '@/lib/ecpay/cs-plans'

// POST /api/billing/create-cs-plan-checkout
// 客戶自助升級 CS 方案：可勾選「自動於下一期扣款」走綠界定期定額，否則為一次性付款（到期前需自行再次購買延續）。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId, returnUrl, autoRenew } = await req.json() as { packageId: CsPlanPackageId; returnUrl?: string; autoRenew?: boolean }
  const pkg = CS_PLAN_PACKAGES.find(p => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: '無效的方案' }, { status: 400 })

  // 現有方案尚未到期時，禁止購買「較低」方案：付款回調會直接覆蓋訂閱，
  // 等於立刻降級且剩餘天數全部消失。同方案續購（延長）與升級不受限。
  const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 }
  const { data: currentSub } = await supabase
    .from('cs_subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle()
  const subActive = currentSub?.status === 'active'
    && (!currentSub.current_period_end || new Date(currentSub.current_period_end).getTime() > Date.now())
  if (subActive && (PLAN_RANK[pkg.plan] ?? 0) < (PLAN_RANK[currentSub!.plan] ?? 0)) {
    const endDate = currentSub!.current_period_end
      ? new Date(currentSub!.current_period_end).toLocaleDateString('zh-TW')
      : null
    return NextResponse.json({
      error: `目前的 ${String(currentSub!.plan).toUpperCase()} 方案尚未到期${endDate ? `（至 ${endDate}）` : ''}，購買較低方案會立即降級並喪失剩餘天數。請於到期後再購買，或聯繫客服協助變更。`,
    }, { status: 400 })
  }

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  // 付款完成導回客戶原本所在子域的公開結果頁（免登入，顯示成功並帶回原頁）
  const { origin, path } = resolvePayReturn(returnUrl)
  const nextEnc = encodeURIComponent(path)
  const { twd: totalAmountTwd, rate } = await usdToTwdInteger(pkg.usdPrice)

  // 先建立待處理訂單，ecpay-return 回調時依 trade_no 找到這筆並升級方案
  const { error: insertErr } = await supabase.from('cs_plan_purchases').insert({
    user_id: user.id,
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

  // 勾選「自動於下一期扣款」→ 走綠界定期定額（僅信用卡）
  if (autoRenew) {
    params.ChoosePayment = 'Credit'
    Object.assign(params, buildPeriodicFields(totalAmountTwd, `${appUrl}/api/billing/ecpay-period-return`))

    const admin = createAdminClient()
    await admin.from('ecpay_periodic_orders').insert({
      user_id: user.id,
      kind: 'cs_plan',
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
