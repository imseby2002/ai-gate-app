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
    OrderResultURL:   `${appUrl}/cs/settings?upgrade=done`,
    ChoosePayment:    'ALL',
    EncryptType:      '1',
    ClientBackURL:    `${appUrl}/cs/settings?upgrade=cancel`,
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({
    paymentUrl: config.paymentUrl,
    params,
    packageInfo: { label: pkg.label },
  })
}
