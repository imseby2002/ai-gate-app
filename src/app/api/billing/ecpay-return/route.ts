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

  console.error('[ECPay] 找不到對應的訂單記錄', { MerchantTradeNo })
  return new NextResponse('1|OK', { status: 200 })
}
