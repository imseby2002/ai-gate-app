import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  getEcpayConfig,
  generateCheckMac,
  generateTradeNo,
  formatEcpayTradeDate,
  resolvePayReturn,
  buildMerchantMemberId,
  buildBindingCardFields,
} from '@/lib/ecpay/client'
import { usdToTwdInteger } from '@/lib/fx'

const MIN_RECHARGE_USD = 5

// 綁定信用卡（供「低於門檻自動儲值」背景扣款使用）。
// 首筆交易同時完成綁卡＋以客戶設定的自動儲值金額入帳一次點數。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rechargeUsd, returnUrl } = await req.json() as { rechargeUsd: number; returnUrl?: string }
  if (!Number.isFinite(rechargeUsd) || rechargeUsd < MIN_RECHARGE_USD) {
    return NextResponse.json({ error: `金額最低 $${MIN_RECHARGE_USD} 美金` }, { status: 400 })
  }

  const config = getEcpayConfig()
  const tradeNo = generateTradeNo(user.id)
  const merchantMemberId = buildMerchantMemberId(config.merchantId, user.id)
  const tradeDate = formatEcpayTradeDate()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { origin, path } = resolvePayReturn(returnUrl)
  const nextEnc = encodeURIComponent(path)
  const { twd: totalAmountTwd } = await usdToTwdInteger(rechargeUsd)

  const admin = await createAdminClient()
  await admin.from('ecpay_card_bindings').upsert({
    user_id: user.id,
    merchant_member_id: merchantMemberId,
    status: 'pending',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'merchant_member_id' })

  // 綁卡首筆交易同時視為一次點數儲值，讓 PENDING 記錄可被既有 ecpay-return 流程入帳
  await supabase.from('credit_transactions').insert({
    user_id: user.id,
    amount_usd: 0,
    type: 'purchase',
    description: `PENDING:${tradeNo}:auto_recharge_bind:${rechargeUsd}`,
    balance_after: 0,
  })

  const params: Record<string, string> = {
    MerchantID:        config.merchantId,
    MerchantTradeNo:   tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType:       'aio',
    TotalAmount:       String(totalAmountTwd),
    TradeDesc:         encodeURIComponent('AI GATE 自動儲值信用卡綁定'),
    ItemName:          'AI GATE 自動儲值信用卡綁定',
    ReturnURL:         `${appUrl}/api/billing/ecpay-return`,
    OrderResultURL:    `${origin}/pay/result?status=done&type=credit&next=${nextEnc}`,
    ChoosePayment:     'Credit',
    EncryptType:       '1',
    ClientBackURL:     `${origin}/pay/result?status=cancel&type=credit&next=${nextEnc}`,
    ...buildBindingCardFields(merchantMemberId),
  }
  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  return NextResponse.json({ paymentUrl: config.paymentUrl, params })
}
