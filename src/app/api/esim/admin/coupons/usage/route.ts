import { NextRequest, NextResponse } from 'next/server'
import { getEsimOrdersByCouponCode } from '@/lib/esim/db'
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

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  const code = new URL(req.url).searchParams.get('code')?.trim()
  if (!code) {
    return NextResponse.json({ success: false, error: '缺少優惠券代碼' }, { status: 400 })
  }
  try {
    const orders = await getEsimOrdersByCouponCode(code)
    const records = orders.map(o => ({
      order_no: o.order_no,
      created_at: o.created_at,
      paid_at: o.paid_at,
      customer_email: o.customer_email,
      customer_name: o.customer_name,
      plan: `${o.country_name} ${o.data_amount} ${o.day}天 x${o.quantity}`,
      subtotal_twd: o.metadata?.subtotal_price_twd ?? o.total_price_twd,
      discount_twd: o.metadata?.coupon_discount_twd ?? 0,
      total_twd: o.total_price_twd,
      payment_status: o.payment_status,
    }))
    const paid = records.filter(r => r.payment_status === 'paid')
    return NextResponse.json({
      success: true,
      records,
      summary: {
        total_orders: records.length,
        paid_orders: paid.length,
        total_discount_twd: paid.reduce((sum, r) => sum + (Number(r.discount_twd) || 0), 0),
        total_revenue_twd: paid.reduce((sum, r) => sum + (Number(r.total_twd) || 0), 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
