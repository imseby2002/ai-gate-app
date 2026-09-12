import { NextRequest, NextResponse } from 'next/server'
import { getEsimOrderByNo } from '@/lib/esim/db'
import { fulfillEsimOrder } from '@/lib/esim/fulfillment'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params
    if (!orderNo) {
      return NextResponse.json({ error: '缺少訂單編號' }, { status: 400 })
    }

    let order = await getEsimOrderByNo(orderNo)
    if (!order) {
      return NextResponse.json({ error: '找不到此訂單' }, { status: 404 })
    }

    // 若已付款但尚未完成發卡，自動嘗試補發
    if (order.payment_status === 'paid' && order.microesim_status !== 'delivered') {
      console.log(`[API esim/order] Auto-retrying fulfillment for order: ${orderNo}`)
      const fulfillRes = await fulfillEsimOrder(orderNo)
      if (fulfillRes.order) {
        order = fulfillRes.order
      }
    }

    // 遮蔽後台成本欄位
    const { cost_hkd, ...safeOrder } = order

    return NextResponse.json({
      success: true,
      order: safeOrder,
    })
  } catch (err: any) {
    console.error('[API esim/order] Error:', err)
    return NextResponse.json(
      { error: err.message || '無法取得訂單資訊' },
      { status: 500 }
    )
  }
}
