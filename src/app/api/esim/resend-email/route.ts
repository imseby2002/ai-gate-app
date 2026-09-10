import { NextRequest, NextResponse } from 'next/server'
import { getEsimOrderByNo } from '@/lib/esim/db'
import { sendEsimDeliveryEmail } from '@/lib/esim/fulfillment'

export async function POST(req: NextRequest) {
  try {
    const { order_no, email } = await req.json()
    if (!order_no) {
      return NextResponse.json({ error: '缺少訂單編號' }, { status: 400 })
    }

    const order = await getEsimOrderByNo(order_no)
    if (!order) {
      return NextResponse.json({ error: '找不到此訂單' }, { status: 404 })
    }

    // 若顧客提供更新的信箱
    if (email && email.includes('@')) {
      order.customer_email = email.trim()
    }

    const sent = await sendEsimDeliveryEmail(order)
    if (!sent) {
      return NextResponse.json({
        success: false,
        error: '郵件發送服務未設定或發送失敗，請直接在線上頁面截圖或儲存 QR Code。'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `已重新發送開通憑證至 ${order.customer_email}`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || '補寄失敗' },
      { status: 500 }
    )
  }
}
