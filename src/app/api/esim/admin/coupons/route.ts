import { NextRequest, NextResponse } from 'next/server'
import { getCoupons, saveCoupons, EsimCoupon } from '@/lib/esim/coupons'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return null
  return supabase
}

function buildCouponFields(coupon: any, code: string) {
  return {
    code,
    name: coupon.name?.trim() || `${code} 優惠`,
    discount_type: (coupon.discount_type === 'percent' ? 'percent' : coupon.discount_type === 'free' ? 'free' : 'fixed') as EsimCoupon['discount_type'],
    discount_value: coupon.discount_type === 'free' ? 0 : parseFloat(coupon.discount_value) || 0,
    min_spend_twd: parseInt(coupon.min_spend_twd, 10) || 0,
    max_discount_twd: coupon.max_discount_twd ? parseInt(coupon.max_discount_twd, 10) : undefined,
    applicable_countries: Array.isArray(coupon.applicable_countries) && coupon.applicable_countries.length > 0 ? coupon.applicable_countries : undefined,
    applicable_plan_ids: Array.isArray(coupon.applicable_plan_ids) && coupon.applicable_plan_ids.length > 0
      ? coupon.applicable_plan_ids.filter((id: unknown) => typeof id === 'string')
      : undefined,
    applicable_plan_names: coupon.applicable_plan_names && typeof coupon.applicable_plan_names === 'object'
      ? coupon.applicable_plan_names
      : undefined,
    is_active: coupon.is_active !== false,
    max_usage_count: coupon.max_usage_count ? parseInt(coupon.max_usage_count, 10) : undefined,
    expires_at: coupon.expires_at || undefined,
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去除易混淆的 I O 0 1

function randomCode(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
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
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
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
        ...buildCouponFields(coupon, code),
        usage_count: 0,
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

    // 2.1 批次產生優惠券（每張代碼不同、設定相同）
    if (action === 'batch_create') {
      const count = parseInt(body.count, 10)
      if (!Number.isFinite(count) || count < 1 || count > 500) {
        return NextResponse.json({ success: false, error: '批次數量需介於 1～500' }, { status: 400 })
      }
      const prefix = String(body.prefix || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
      if (prefix.length > 12) {
        return NextResponse.json({ success: false, error: '前綴最多 12 個字元' }, { status: 400 })
      }
      const existingCodes = new Set(currentCoupons.map(c => c.code.toUpperCase()))
      const now = Date.now()
      const created: EsimCoupon[] = []
      let attempts = 0
      while (created.length < count && attempts < count * 20) {
        attempts++
        const code = `${prefix}${randomCode(8)}`
        if (existingCodes.has(code)) continue
        existingCodes.add(code)
        created.push({
          id: `coupon_${now}_${created.length}_${Math.random().toString(36).substring(2, 6)}`,
          ...buildCouponFields({ ...(coupon || {}), name: coupon?.name?.trim() || `${prefix || '批次'} 優惠券` }, code),
          usage_count: 0,
          created_at: new Date(now).toISOString(),
        })
      }
      const updated = [...created, ...currentCoupons]
      await saveCoupons(updated)
      return NextResponse.json({
        success: true,
        codes: created.map(c => c.code),
        coupons: updated,
        message: `已批次產生 ${created.length} 張優惠券`,
      })
    }

    // 2.5 編輯優惠券
    if (action === 'update' && coupon?.id) {
      const existing = currentCoupons.find(c => c.id === coupon.id)
      if (!existing) {
        return NextResponse.json({ success: false, error: '找不到此優惠券' }, { status: 404 })
      }
      const code = String(coupon.code || '').trim().toUpperCase()
      if (!code) {
        return NextResponse.json({ success: false, error: '缺少優惠券代碼' }, { status: 400 })
      }
      if (currentCoupons.some(c => c.id !== coupon.id && c.code.toUpperCase() === code)) {
        return NextResponse.json({ success: false, error: `代碼「${code}」已存在，請使用其他代碼` }, { status: 400 })
      }
      const updatedCoupon: EsimCoupon = {
        ...buildCouponFields(coupon, code),
        id: existing.id,
        usage_count: existing.usage_count || 0,
        created_at: existing.created_at,
      }
      const updated = currentCoupons.map(c => (c.id === existing.id ? updatedCoupon : c))
      await saveCoupons(updated)
      return NextResponse.json({
        success: true,
        coupon: updatedCoupon,
        coupons: updated,
        message: `優惠券「${code}」已更新！`,
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
