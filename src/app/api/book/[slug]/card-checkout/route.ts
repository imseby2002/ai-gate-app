import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEcpayConfig, generateCheckMac, formatEcpayTradeDate, resolvePayReturn } from '@/lib/ecpay/client'

// 官網訂房信用卡付款：產生 AI-GATE 平台綠界的刷卡表單參數（公開端點，以確認碼 + 訂房 Email 比對）。
// 每次呼叫都產生新的綠界訂單編號，旅客中途放棄後可重新付款。
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { code, email, return_url } = await req.json().catch(() => ({})) as { code?: string; email?: string; return_url?: string }
  if (!code || !email) return NextResponse.json({ error: '缺少訂房資料' }, { status: 400 })

  const { data: profile } = await admin.from('bnb_profiles').select('user_id, name').eq('slug', slug).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: pb } = await admin.from('public_bookings')
    .select('id, guest_email, payment_method, payment_status, total_price, status, check_in, check_out')
    .eq('host_user_id', profile.user_id).eq('confirmation_code', code).maybeSingle()
  if (!pb || (pb.guest_email ?? '').toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: '找不到這筆訂房' }, { status: 404 })
  }
  if (pb.payment_method !== 'card') return NextResponse.json({ error: '此訂房不是信用卡付款' }, { status: 400 })
  if (pb.payment_status === 'paid') return NextResponse.json({ error: '此訂房已完成付款' }, { status: 409 })
  if (pb.status === 'rejected' || pb.status === 'cancelled') return NextResponse.json({ error: '此訂房已取消' }, { status: 409 })
  const amount = Math.round(Number(pb.total_price) || 0)
  if (amount < 1) return NextResponse.json({ error: '此訂房金額無法線上刷卡，請聯絡民宿' }, { status: 400 })

  const config = getEcpayConfig()
  if (!config.merchantId || !config.hashKey || !config.hashIV) {
    return NextResponse.json({ error: '線上刷卡暫不可用，請選擇其他付款方式' }, { status: 503 })
  }

  // 綠界 MerchantTradeNo 限 20 碼英數且不可重複
  const tradeNo = `BK${code.replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`.slice(0, 20)
  const { error: upErr } = await admin.from('public_bookings').update({ ecpay_merchant_trade_no: tradeNo }).eq('id', pb.id)
  if (upErr) return NextResponse.json({ error: '建立付款失敗，請稍後再試' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { origin } = resolvePayReturn(return_url)
  const resultUrl = `${origin}/book/${encodeURIComponent(slug)}/payment?code=${encodeURIComponent(code)}`
  const itemName = `${profile.name || '民宿'} 住宿 ${pb.check_in}~${pb.check_out}`.replace(/[#&]/g, ' ').slice(0, 200)

  const ecpayParams: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: formatEcpayTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(amount),
    TradeDesc: encodeURIComponent('官網訂房'),
    ItemName: itemName,
    ReturnURL: `${appUrl}/api/book/ecpay-return`,
    OrderResultURL: resultUrl,
    ClientBackURL: resultUrl,
    ChoosePayment: 'Credit',
    EncryptType: '1',
  }
  ecpayParams.CheckMacValue = await generateCheckMac(ecpayParams, config.hashKey, config.hashIV)

  return NextResponse.json({ action: config.paymentUrl, params: ecpayParams })
}
