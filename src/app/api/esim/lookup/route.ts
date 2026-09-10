import { NextRequest, NextResponse } from 'next/server'
import { getEsimOrderByNo, getEsimOrdersByEmail, EsimOrder } from '@/lib/esim/db'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: '請輸入電子信箱或訂單編號' }, { status: 400 })
    }

    const trimmed = query.trim()
    let orders: EsimOrder[] = []

    if (trimmed.includes('@')) {
      // 依信箱查詢
      orders = await getEsimOrdersByEmail(trimmed)
    } else {
      // 依訂單號查詢
      const single = await getEsimOrderByNo(trimmed)
      if (single) orders = [single]
    }

    // 移除成本等機敏欄位
    const safeOrders = orders.map(({ cost_hkd, ...rest }) => rest)

    return NextResponse.json({
      success: true,
      count: safeOrders.length,
      orders: safeOrders,
    })
  } catch (err: any) {
    console.error('[API esim/lookup] Error:', err)
    return NextResponse.json(
      { error: err.message || '查詢失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
