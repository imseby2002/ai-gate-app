import { NextRequest, NextResponse } from 'next/server'
import { getPaidCouponOrders } from '@/lib/esim/db'
import { getCoupons } from '@/lib/esim/coupons'
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 台灣時間日期 (YYYY-MM-DD)
function twDate(iso: string) {
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  try {
    const sp = new URL(req.url).searchParams
    const from = sp.get('from') || ''
    const to = sp.get('to') || ''
    const fromIso = DATE_RE.test(from) ? new Date(`${from}T00:00:00+08:00`).toISOString() : undefined
    const toIso = DATE_RE.test(to) ? new Date(`${to}T23:59:59.999+08:00`).toISOString() : undefined

    const [orders, coupons] = await Promise.all([getPaidCouponOrders(fromIso, toIso), getCoupons()])
    const couponMap = new Map(coupons.map(c => [c.code.toUpperCase(), c]))

    type Row = {
      code: string
      name: string
      discount_type: string
      orders: number
      customers: Set<string>
      discount_twd: number
      subtotal_twd: number
      revenue_twd: number
      last_used_at: string
    }
    const byCode = new Map<string, Row>()
    const byDay = new Map<string, { date: string; orders: number; discount_twd: number; revenue_twd: number }>()

    for (const o of orders) {
      const code = String(o.metadata?.coupon_code || '').toUpperCase()
      if (!code) continue
      const c = couponMap.get(code)
      const discount = Number(o.metadata?.coupon_discount_twd) || 0
      const subtotal = Number(o.metadata?.subtotal_price_twd ?? o.total_price_twd) || 0
      const revenue = Number(o.total_price_twd) || 0
      const paidAt = o.paid_at || o.created_at

      let r = byCode.get(code)
      if (!r) {
        r = {
          code,
          name: c?.name || o.metadata?.coupon_name || '（已刪除）',
          discount_type: c?.discount_type || '',
          orders: 0,
          customers: new Set(),
          discount_twd: 0,
          subtotal_twd: 0,
          revenue_twd: 0,
          last_used_at: paidAt,
        }
        byCode.set(code, r)
      }
      r.orders++
      r.customers.add((o.customer_email || '').trim().toLowerCase())
      r.discount_twd += discount
      r.subtotal_twd += subtotal
      r.revenue_twd += revenue
      if (new Date(paidAt) > new Date(r.last_used_at)) r.last_used_at = paidAt

      const day = twDate(paidAt)
      const d = byDay.get(day) || { date: day, orders: 0, discount_twd: 0, revenue_twd: 0 }
      d.orders++
      d.discount_twd += discount
      d.revenue_twd += revenue
      byDay.set(day, d)
    }

    const rows = Array.from(byCode.values())
      .map(r => ({ ...r, customers: r.customers.size }))
      .sort((a, b) => b.orders - a.orders || b.discount_twd - a.discount_twd)
    const daily = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
    const allCustomers = new Set(orders.map(o => (o.customer_email || '').trim().toLowerCase()))

    return NextResponse.json({
      success: true,
      range: { from: from || null, to: to || null },
      totals: {
        orders: orders.length,
        coupons_used: rows.length,
        customers: allCustomers.size,
        discount_twd: rows.reduce((s, r) => s + r.discount_twd, 0),
        subtotal_twd: rows.reduce((s, r) => s + r.subtotal_twd, 0),
        revenue_twd: rows.reduce((s, r) => s + r.revenue_twd, 0),
      },
      rows,
      daily,
      truncated: orders.length >= 5000,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
