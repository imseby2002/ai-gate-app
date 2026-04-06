import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  if (!verifyCheckMac(params, config.hashKey, config.hashIV)) {
    console.error('[ECPay] CheckMacValue 驗證失敗', params)
    return new NextResponse('0|CheckMacValue Error', { status: 200 })
  }

  const { RtnCode, MerchantTradeNo } = params

  // 只處理付款成功（RtnCode === '1'）
  if (RtnCode !== '1') {
    console.warn('[ECPay] 付款未成功', { RtnCode, MerchantTradeNo })
    return new NextResponse('1|OK', { status: 200 })
  }

  const supabase = await createClient()

  // 找到對應的 PENDING 記錄（description 格式: PENDING:{tradeNo}:{pkgId}:{usdCredit}）
  const { data: pending, error: findErr } = await supabase
    .from('credit_transactions')
    .select('id, user_id, description')
    .like('description', `PENDING:${MerchantTradeNo}:%`)
    .single()

  if (findErr || !pending) {
    console.error('[ECPay] 找不到對應的 PENDING 記錄', { MerchantTradeNo, findErr })
    return new NextResponse('1|OK', { status: 200 })
  }

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

  // ECPay 要求回傳 1|OK
  return new NextResponse('1|OK', { status: 200 })
}
