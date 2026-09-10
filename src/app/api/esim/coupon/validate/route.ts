import { NextRequest, NextResponse } from 'next/server'
import { validateCoupon } from '@/lib/esim/coupons'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, subtotal, country_code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: '請輸入優惠券代碼' }, { status: 400 })
    }

    const subtotalTwd = parseFloat(String(subtotal)) || 0
    if (subtotalTwd <= 0) {
      return NextResponse.json({ success: false, error: '訂單金額不正確' }, { status: 400 })
    }

    const result = await validateCoupon(code, subtotalTwd, country_code)

    if (!result.valid || !result.coupon) {
      return NextResponse.json({
        success: false,
        error: result.error || '優惠券無效',
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      coupon: {
        code: result.coupon.code,
        name: result.coupon.name,
        discount_type: result.coupon.discount_type,
        discount_value: result.coupon.discount_value,
      },
      discount_twd: result.discountTwd,
      final_price_twd: result.finalPriceTwd,
      message: `已成功套用優惠券「${result.coupon.code}」！現折 NT$ ${result.discountTwd}`,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || '驗證優惠券失敗',
    }, { status: 500 })
  }
}
