import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyCheckMac, getEcpayConfig } from '@/lib/ecpay/client'

export async function POST(req: NextRequest) {
  // ECPay 送來的是 application/x-www-form-urlencoded
  const body = await req.text()
  const params: Record<string, string> = {}
  for (const pair of body.split('&')) {
    const [k, v] = pair.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
  }

  const config = getEcpayConfig()

  // 驗證 CheckMacValue
  if (!await verifyCheckMac(params, config.hashKey, config.hashIV)) {
    console.error('[ECPay] CheckMacValue 驗證失敗', params)
    return new NextResponse('0|CheckMacValue Error', { status: 200 })
  }

  const { RtnCode, MerchantTradeNo } = params

  // 只處理付款成功（RtnCode === '1'）
  if (RtnCode !== '1') {
    console.warn('[ECPay] 付款未成功', { RtnCode, MerchantTradeNo })
    return new NextResponse('1|OK', { status: 200 })
  }

  // ECPay 回調沒有使用者 session，一律用 service role（anon client 在 RLS 下讀不到任何人的待處理訂單）
  const supabase = await createAdminClient()

  // 找到對應的 PENDING 記錄（description 格式: PENDING:{tradeNo}:{pkgId}:{usdCredit}）
  const { data: pending } = await supabase
    .from('credit_transactions')
    .select('id, user_id, description')
    .like('description', `PENDING:${MerchantTradeNo}:%`)
    .maybeSingle()

  if (pending) {
    // 解析 description 取得 usdCredit
    const parts = pending.description.split(':')
    // 格式: PENDING:{tradeNo}:{pkgId}:{usdCredit}
    const usdCredit = parseFloat(parts[3] ?? '0')
    if (!usdCredit || usdCredit <= 0) {
      console.error('[ECPay] description 解析失敗', pending.description)
      return new NextResponse('1|OK', { status: 200 })
    }

    // 取得用戶當前餘額
    const { data: profile } = await supabase
      .from('profiles')
      .select('credit_balance')
      .eq('id', pending.user_id)
      .single()

    const currentBalance = profile?.credit_balance ?? 0
    const newBalance = currentBalance + usdCredit

    // 更新 PENDING 記錄為正式交易
    await supabase
      .from('credit_transactions')
      .update({
        amount_usd: usdCredit,
        balance_after: newBalance,
        description: `ECPay 購買點數 ${parts[2] ?? ''} (${MerchantTradeNo})`,
      })
      .eq('id', pending.id)

    // 更新用戶點數餘額
    await supabase
      .from('profiles')
      .update({ credit_balance: newBalance })
      .eq('id', pending.user_id)

    console.log('[ECPay] 付款成功', { userId: pending.user_id, usdCredit, newBalance })
    return new NextResponse('1|OK', { status: 200 })
  }

  // 找不到點數訂單 → 檢查是否為 CS 方案升級訂單
  const { data: planPurchase } = await supabase
    .from('cs_plan_purchases')
    .select('id, user_id, plan, billing_cycle')
    .eq('trade_no', MerchantTradeNo)
    .eq('status', 'pending')
    .maybeSingle()

  if (planPurchase) {
    const days = planPurchase.billing_cycle === 'yearly' ? 365 : 30
    const periodEnd = new Date(Date.now() + days * 86400000).toISOString()

    await supabase
      .from('cs_plan_purchases')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', planPurchase.id)

    await supabase
      .from('cs_subscriptions')
      .upsert({
        user_id: planPurchase.user_id,
        plan: planPurchase.plan,
        billing_cycle: planPurchase.billing_cycle,
        status: 'active',
        current_period_end: periodEnd,
      }, { onConflict: 'user_id' })

    console.log('[ECPay] CS 方案升級成功', { userId: planPurchase.user_id, plan: planPurchase.plan })
    return new NextResponse('1|OK', { status: 200 })
  }

  // 找不到 CS 方案訂單 → 檢查是否為訂房方案升級訂單
  const { data: bookingPurchase } = await supabase
    .from('booking_plan_purchases')
    .select('id, user_id, plan, billing_cycle, referral_code_used')
    .eq('trade_no', MerchantTradeNo)
    .eq('status', 'pending')
    .maybeSingle()

  if (bookingPurchase) {
    const days = bookingPurchase.billing_cycle === 'yearly' ? 365 : 30
    let bonusDays = 0

    // 先前累積的推薦贈送天數（介紹人在免費方案時暫存），這次付款一併加上
    const { data: existingSub } = await supabase
      .from('booking_subscriptions')
      .select('bonus_days')
      .eq('user_id', bookingPurchase.user_id)
      .maybeSingle()
    bonusDays += existingSub?.bonus_days ?? 0

    // 推薦碼核銷：被介紹人第一次用推薦碼付款成功，雙方各贈送 30 天
    if (bookingPurchase.referral_code_used) {
      const { data: alreadyRedeemed } = await supabase
        .from('booking_referral_redemptions')
        .select('id')
        .eq('referee_id', bookingPurchase.user_id)
        .maybeSingle()

      if (!alreadyRedeemed) {
        const { data: referrerSub } = await supabase
          .from('booking_subscriptions')
          .select('user_id, status, current_period_end, bonus_days')
          .eq('referral_code', bookingPurchase.referral_code_used)
          .maybeSingle()

        if (referrerSub && referrerSub.user_id !== bookingPurchase.user_id) {
          bonusDays += 30 // 被介紹人贈送 30 天

          await supabase.from('booking_referral_redemptions').insert({
            purchase_id: bookingPurchase.id,
            referrer_id: referrerSub.user_id,
            referee_id: bookingPurchase.user_id,
          })

          const referrerActive = referrerSub.status === 'active'
            && !!referrerSub.current_period_end
            && new Date(referrerSub.current_period_end) > new Date()

          if (referrerActive) {
            const newEnd = new Date(new Date(referrerSub.current_period_end!).getTime() + 30 * 86400000).toISOString()
            await supabase.from('booking_subscriptions')
              .update({ current_period_end: newEnd })
              .eq('user_id', referrerSub.user_id)
          } else {
            await supabase.from('booking_subscriptions')
              .update({ bonus_days: (referrerSub.bonus_days ?? 0) + 30 })
              .eq('user_id', referrerSub.user_id)
          }

          console.log('[ECPay] 推薦碼核銷成功', { referrerId: referrerSub.user_id, refereeId: bookingPurchase.user_id })
        }
      }
    }

    const periodEnd = new Date(Date.now() + (days + bonusDays) * 86400000).toISOString()

    await supabase
      .from('booking_plan_purchases')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', bookingPurchase.id)

    await supabase
      .from('booking_subscriptions')
      .upsert({
        user_id: bookingPurchase.user_id,
        plan: bookingPurchase.plan,
        billing_cycle: bookingPurchase.billing_cycle,
        status: 'active',
        current_period_end: periodEnd,
        bonus_days: 0,
      }, { onConflict: 'user_id' })

    console.log('[ECPay] 訂房方案升級成功', { userId: bookingPurchase.user_id, plan: bookingPurchase.plan })
    return new NextResponse('1|OK', { status: 200 })
  }

  console.error('[ECPay] 找不到對應的訂單記錄', { MerchantTradeNo })
  return new NextResponse('1|OK', { status: 200 })
}
