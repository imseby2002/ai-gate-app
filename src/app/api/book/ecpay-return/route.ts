import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCheckMac, getEcpayConfig } from '@/lib/ecpay/client'
import { confirmPublicBooking } from '@/lib/booking/public-booking-confirm'

// 綠界付款結果通知（官網訂房信用卡）。綠界規定成功處理需回 1|OK。
export async function POST(req: NextRequest) {
  try {
    const params: Record<string, string> = {}
    for (const [k, v] of new URLSearchParams(await req.text())) params[k] = v

    const config = getEcpayConfig()
    if (!(await verifyCheckMac(params, config.hashKey, config.hashIV))) {
      console.error('[ECPay booking] CheckMacValue validation failed', params.MerchantTradeNo)
      return new NextResponse('0|CheckMacValue Error', { status: 200 })
    }
    if (params.RtnCode !== '1') return new NextResponse('1|OK', { status: 200 })

    const admin = createAdminClient()
    const { data: pb } = await admin.from('public_bookings')
      .select('id, host_user_id, total_price, payment_status, status, converted_booking_id')
      .eq('ecpay_merchant_trade_no', params.MerchantTradeNo).maybeSingle()
    if (!pb) {
      console.error('[ECPay booking] booking not found', params.MerchantTradeNo)
      return new NextResponse('1|OK', { status: 200 })
    }
    if (pb.payment_status === 'paid') return new NextResponse('1|OK', { status: 200 })
    if (Number(params.TradeAmt) !== Math.round(Number(pb.total_price) || 0)) {
      console.error('[ECPay booking] amount mismatch', params.MerchantTradeNo, params.TradeAmt, pb.total_price)
      return new NextResponse('0|Amount Error', { status: 200 })
    }

    await admin.from('public_bookings').update({
      payment_status: 'paid', paid_at: new Date().toISOString(), ecpay_trade_no: params.TradeNo ?? null,
    }).eq('id', pb.id)

    let convertedId: string | null = pb.converted_booking_id
    if (!convertedId && pb.status === 'pending') {
      const { data: profile } = await admin.from('bnb_profiles')
        .select('auto_confirm_bookings').eq('user_id', pb.host_user_id).maybeSingle()
      if (profile?.auto_confirm_bookings) {
        const r = await confirmPublicBooking(admin, pb.host_user_id, pb.id)
        if (r.ok) convertedId = r.booking_id
      }
    }
    if (convertedId) {
      const { data: bk } = await admin.from('bookings').update({ is_paid: true })
        .eq('id', convertedId).eq('user_id', pb.host_user_id).select('order_id').maybeSingle()
      if (bk?.order_id) await admin.from('booking_orders').update({ is_paid: true }).eq('id', bk.order_id).eq('user_id', pb.host_user_id)
    }

    return new NextResponse('1|OK', { status: 200 })
  } catch (err) {
    console.error('[ECPay booking] callback error', err)
    return new NextResponse('0|Error', { status: 200 })
  }
}
