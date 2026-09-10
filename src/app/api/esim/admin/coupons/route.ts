import { NextRequest, NextResponse } from 'next/server'
import { getCoupons, saveCoupons, EsimCoupon } from '@/lib/esim/coupons'

export async function GET() {
  try {
    const coupons = await getCoupons()
    return NextResponse.json({
      success: true,
      coupons,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, coupon, coupons } = body

    // 1. 若直接傳入整份清單更新
    if (Array.isArray(coupons)) {
      await saveCoupons(coupons)
      return NextResponse.json({
        success: true,
        coupons,
        message: '優惠券清單已成功儲存！',
      })
    }

    const currentCoupons = await getCoupons()

    // 2. 新增優惠券
    if (action === 'create' || action === 'add') {
      if (!coupon || !coupon.code) {
        return NextResponse.json({ success: false, error: '缺少優惠券代碼' }, { status: 400 })
      }
      const code = coupon.code.trim().toUpperCase()
      if (currentCoupons.some(c => c.code.toUpperCase() === code)) {
        return NextResponse.json({ success: false, error: `代碼「${code}」已存在，請使用其他代碼` }, { status: 400 })
      }

      const newCoupon: EsimCoupon = {
        id: `coupon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code,
        name: coupon.name?.trim() || `${code} 優惠`,
        discount_type: coupon.discount_type === 'percent' ? 'percent' : 'fixed',
        discount_value: parseFloat(coupon.discount_value) || 0,
        min_spend_twd: parseInt(coupon.min_spend_twd, 10) || 0,
        max_discount_twd: coupon.max_discount_twd ? parseInt(coupon.max_discount_twd, 10) : undefined,
        applicable_countries: Array.isArray(coupon.applicable_countries) && coupon.applicable_countries.length > 0 ? coupon.applicable_countries : undefined,
        is_active: coupon.is_active !== false,
        usage_count: 0,
        max_usage_count: coupon.max_usage_count ? parseInt(coupon.max_usage_count, 10) : undefined,
        expires_at: coupon.expires_at || undefined,
        created_at: new Date().toISOString(),
      }

      const updated = [newCoupon, ...currentCoupons]
      await saveCoupons(updated)

      return NextResponse.json({
        success: true,
        coupon: newCoupon,
        coupons: updated,
        message: `優惠券「${code}」已成功建立！`,
      })
    }

    // 3. 切換啟用狀態
    if (action === 'toggle' && coupon?.id) {
      const updated = currentCoupons.map(c => {
        if (c.id === coupon.id) {
          return { ...c, is_active: !c.is_active }
        }
        return c
      })
      await saveCoupons(updated)
      return NextResponse.json({
        success: true,
        coupons: updated,
        message: '狀態切換成功！',
      })
    }

    // 4. 刪除優惠券
    if (action === 'delete' && coupon?.id) {
      const updated = currentCoupons.filter(c => c.id !== coupon.id)
      await saveCoupons(updated)
      return NextResponse.json({
        success: true,
        coupons: updated,
        message: '優惠券已成功刪除！',
      })
    }

    return NextResponse.json({ success: false, error: '未知的操作指令' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
