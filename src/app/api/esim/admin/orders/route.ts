import { NextRequest, NextResponse } from 'next/server'
import { getAllEsimOrders } from '@/lib/esim/db'

export async function GET(req: NextRequest) {
  try {
    const orders = await getAllEsimOrders(100)
    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
