// GET /api/connector/booking/rules — 回傳外掛的解析規則（公開、可快取）。
// 外掛啟動時抓取並快取；平台改版時只改伺服器端 booking-rules.ts 重新部署即可，使用者端免重載外掛。
import { NextResponse } from 'next/server'
import { BOOKING_PARSE_RULES } from '@/lib/connector/booking-rules'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json(BOOKING_PARSE_RULES, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
