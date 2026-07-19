import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyCheckMac, getEcpayConfig } from '@/lib/ecpay/client'

export async function POST(req: NextRequest) {
  // ECPay 送來的是 application/x-www-form-urlencoded。
  // 必須用 URLSearchParams 解析：form-urlencoded 的空白編碼成「+」，
  // decodeURIComponent 不會處理「+」。ECPay 回調必帶 PaymentDate
  // （yyyy/MM/dd HH:mm:ss，含空白），手動 split + decodeURIComponent
  // 會把它解析成「2026/07/12+10:00:00」，CheckMacValue 重算永遠對不上，
  // 所有回調都被當驗證失敗丟掉，點數／方案永遠不會入帳。
  const body = await req.text()
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(body)) {
    params[k] = v
  }

  const config = getEcpayConfig()

  // 驗證 CheckMacValue
  if (!await verifyCheckMac(params, config.hashKey, config.hashIV)) {
    console.error('[ECPay] CheckMacValue 驗證失敗', params)
    return new NextResponse('0|CheckMacValue Error', { status: 200 })
  }

  const { RtnCode, MerchantTradeNo, TradeNo, MerchantMemberID, card4no, card6no } = params

  // 只處理付款成功（RtnCode === '1'）
  if (RtnCode !== '1') {
    console.warn('[ECPay] 付款未成功', { RtnCode, MerchantTradeNo })
    return new NextResponse('1|OK', { status: 200 })
  }

  // ECPay 回調沒有使用者 session，一律用 service role（anon client 在 RLS 下讀不到任何人的待處理訂單）
  const supabase = await createAdminClient()

  // 定期定額訂單（自動於下一期扣款）的首筆扣款也會走這支 ReturnURL；找到對應 pending 記錄
  // 就啟用它，之後第 2 期起改由 ecpay-period-return 通知。下方既有的一次性入帳邏輯
  // （credit_transactions / cs_plan_purchases / booking_plan_purchases）不受影響，
  // 因為建立定期定額訂單時，同一個 MerchantTradeNo 也會照舊建立一筆一次性訂單記錄。
  const { data: periodicOrder } = await supabase
    .from('ecpay_periodic_orders')
    .select('id')
    .eq('merchant_trade_no', MerchantTradeNo)
    .eq('status', 'pending')
    .maybeSingle()

  if (periodicOrder) {
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    await supabase.from('ecpay_periodic_orders').update({
      status: 'active',
      ecpay_trade_no: TradeNo,
      total_success_times: 1,
      next_expected_at: nextMonth.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', periodicOrder.id)
  }

  // 信用卡綁定（低於門檻自動儲值）首筆交易同時完成綁卡
  if (MerchantMemberID) {
    await supabase.from('ecpay_card_bindings').update({
      status: 'active',
      card_last4: card4no ?? null,
      card6no: card6no ?? null,
      bound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('merchant_member_id', MerchantMemberID).eq('status', 'pending')
  }

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

    // 餘額真相來源是 credit_transactions 加總（get_credit_balance RPC）。
    // profiles 沒有 credit_balance 欄位，餘額不需要（也不能）寫回 profiles；
    // 只要把這筆 PENDING 的 amount_usd 補上，加總就會自動反映。
    // balance_after 僅供交易紀錄顯示用，取「入帳後」的加總值。
    const { data: currentBalance } = await supabase.rpc('get_credit_balance', { p_user_id: pending.user_id })
    const newBalance = (currentBalance ?? 0) + usdCredit

    // 更新 PENDING 記錄為正式交易（amount_usd 補上後即計入餘額加總）
    await supabase
      .from('credit_transactions')
      .update({
        amount_usd: usdCredit,
        balance_after: newBalance,
        description: `ECPay 購買點數 ${parts[2] ?? ''} (${MerchantTradeNo})`,
      })
      .eq('id', pending.id)

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

    // 同方案續購 → 從原到期日往後延（提前續約不吃掉剩餘天數）；
    // 不同方案（升級）→ 立即生效，從現在起算。
    const { data: existingSub } = await supabase
      .from('cs_subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', planPurchase.user_id)
      .maybeSingle()
    const now = Date.now()
    const remainingValid = existingSub?.status === 'active'
      && existingSub.plan === planPurchase.plan
      && !!existingSub.current_period_end
      && new Date(existingSub.current_period_end).getTime() > now
    const baseMs = remainingValid ? new Date(existingSub!.current_period_end!).getTime() : now
    const periodEnd = new Date(baseMs + days * 86400000).toISOString()

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

    // 推薦碼核銷：僅限被介紹人「第一次付費」使用，已經是付費客戶不能事後補用推薦碼賺天數
    if (bookingPurchase.referral_code_used) {
      const { data: alreadyRedeemed } = await supabase
        .from('booking_referral_redemptions')
        .select('id')
        .eq('referee_id', bookingPurchase.user_id)
        .maybeSingle()

      const { data: priorPaid } = await supabase
        .from('booking_plan_purchases')
        .select('id')
        .eq('user_id', bookingPurchase.user_id)
        .eq('status', 'paid')
        .limit(1)
        .maybeSingle()

      if (!alreadyRedeemed && !priorPaid) {
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
