import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyCheckMac, getEcpayConfig } from '@/lib/ecpay/client'

// 綠界「定期定額」第 2 期起的執行結果通知（PeriodReturnURL）。
// 每期只會收到一次通知；若未收到，需靠信用卡定期定額訂單查詢 API 補查（未在此實作，先以 log 觀察）。
export async function POST(req: NextRequest) {
  const body = await req.text()
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(body)) {
    params[k] = v
  }

  const config = getEcpayConfig()
  if (!await verifyCheckMac(params, config.hashKey, config.hashIV)) {
    console.error('[ECPay Period] CheckMacValue 驗證失敗', params)
    return new NextResponse('0|CheckMacValue Error', { status: 200 })
  }

  const { RtnCode, MerchantTradeNo, gwsr, TotalSuccessTimes } = params
  const supabase = await createAdminClient()

  const { data: order } = await supabase
    .from('ecpay_periodic_orders')
    .select('*')
    .eq('merchant_trade_no', MerchantTradeNo)
    .eq('status', 'active')
    .maybeSingle()

  if (!order) {
    console.warn('[ECPay Period] 找不到對應的 active 定期定額訂單', { MerchantTradeNo })
    return new NextResponse('1|OK', { status: 200 })
  }

  if (RtnCode !== '1') {
    console.warn('[ECPay Period] 本期扣款失敗', { MerchantTradeNo, RtnCode })
    await supabase.from('ecpay_periodic_orders').update({ updated_at: new Date().toISOString() }).eq('id', order.id)
    return new NextResponse('1|OK', { status: 200 })
  }

  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  await supabase.from('ecpay_periodic_orders').update({
    ecpay_trade_no: gwsr || order.ecpay_trade_no,
    total_success_times: Number(TotalSuccessTimes) || order.total_success_times + 1,
    next_expected_at: nextMonth.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', order.id)

  if (order.kind === 'credit_topup') {
    // 餘額真相來源是 credit_transactions 加總（get_credit_balance RPC）
    const { data: currentBalance } = await supabase.rpc('get_credit_balance', { p_user_id: order.user_id })
    const newBalance = (currentBalance ?? 0) + Number(order.usd_value)

    await supabase.from('credit_transactions').insert({
      user_id: order.user_id,
      amount_usd: order.usd_value,
      type: 'purchase',
      ecpay_trade_no: gwsr || null,
      description: `ECPay 定期定額自動續購 ${order.reference_id}（第 ${TotalSuccessTimes || ''} 期）`,
      balance_after: newBalance,
    })
  } else if (order.kind === 'booking_plan') {
    const isYearly = String(order.reference_id).endsWith('_yearly')
    const days = isYearly ? 365 : 30
    const plan = String(order.reference_id).split('_')[0]

    const { data: existingSub } = await supabase
      .from('booking_subscriptions')
      .select('current_period_end')
      .eq('user_id', order.user_id)
      .maybeSingle()
    const baseMs = existingSub?.current_period_end && new Date(existingSub.current_period_end).getTime() > Date.now()
      ? new Date(existingSub.current_period_end).getTime()
      : Date.now()
    const periodEnd = new Date(baseMs + days * 86400000).toISOString()

    await supabase.from('booking_subscriptions').upsert({
      user_id: order.user_id,
      plan,
      billing_cycle: isYearly ? 'yearly' : 'monthly',
      status: 'active',
      current_period_end: periodEnd,
    }, { onConflict: 'user_id' })
  } else if (order.kind === 'cs_plan') {
    const isYearly = String(order.reference_id).endsWith('_yearly')
    const days = isYearly ? 365 : 30
    const plan = String(order.reference_id).split('_')[0]

    const { data: existingSub } = await supabase
      .from('cs_subscriptions')
      .select('current_period_end')
      .eq('user_id', order.user_id)
      .maybeSingle()
    const baseMs = existingSub?.current_period_end && new Date(existingSub.current_period_end).getTime() > Date.now()
      ? new Date(existingSub.current_period_end).getTime()
      : Date.now()
    const periodEnd = new Date(baseMs + days * 86400000).toISOString()

    await supabase.from('cs_subscriptions').upsert({
      user_id: order.user_id,
      plan,
      billing_cycle: isYearly ? 'yearly' : 'monthly',
      status: 'active',
      current_period_end: periodEnd,
    }, { onConflict: 'user_id' })
  }

  console.log('[ECPay Period] 本期扣款成功', { userId: order.user_id, kind: order.kind, reference_id: order.reference_id })
  return new NextResponse('1|OK', { status: 200 })
}
