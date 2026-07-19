import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildCancelPeriodicRequest } from '@/lib/ecpay/client'

// 列出客戶目前生效中／待生效的定期定額訂單（點數自動續購／訂房或客服方案自動續訂）
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()
  const { data } = await admin
    .from('ecpay_periodic_orders')
    .select('id, kind, reference_id, period_amount_twd, usd_value, status, total_success_times, next_expected_at, created_at')
    .eq('user_id', user.id)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })

  return NextResponse.json({ orders: data ?? [] })
}

// 客戶主動取消自動續訂／自動續購（定期定額）
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await req.json() as { orderId: string }
  if (!orderId) return NextResponse.json({ error: '缺少 orderId' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: order, error } = await admin
    .from('ecpay_periodic_orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })
  if (order.status !== 'active') return NextResponse.json({ error: '此訂單並非生效中' }, { status: 400 })
  if (!order.ecpay_trade_no) return NextResponse.json({ error: '訂單尚未取得綠界交易編號，請稍後再試' }, { status: 400 })

  const { url, params } = await buildCancelPeriodicRequest({
    merchantTradeNo: order.merchant_trade_no,
    tradeNo: order.ecpay_trade_no,
    totalAmountTwd: order.period_amount_twd,
  })

  try {
    const body = new URLSearchParams(params).toString()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    // 綠界回傳格式為查詢字串，例如 MerchantID=...&RtnCode=1&RtnMsg=Success
    const ok = /RtnCode=1(&|$)/.test(text)
    if (!ok) {
      console.error('[ECPay] 取消定期定額失敗', { orderId, response: text })
      return NextResponse.json({ error: '綠界取消失敗，請稍後再試或聯繫客服' }, { status: 502 })
    }
  } catch (err) {
    console.error('[ECPay] 取消定期定額連線失敗', err)
    return NextResponse.json({ error: '連線綠界失敗，請稍後再試' }, { status: 502 })
  }

  await admin.from('ecpay_periodic_orders').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', order.id)

  return NextResponse.json({ ok: true })
}
