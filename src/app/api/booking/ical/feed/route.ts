import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPropertyICal } from '@/lib/booking/ical-export'

export const dynamic = 'force-dynamic'

// 公開 iCal 匯出（OTA 訂閱用）：以不可猜的 token 對應房型，輸出該房「已佔用日期」的 .ics。
// 無需登入——平台伺服器會定時來讀，看到被佔用就自動關那幾天。token 外洩僅會曝光「哪幾天滿房」，不含個資。
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const admin = createAdminClient()
  const { data: property } = await admin
    .from('properties').select('id, user_id, name')
    .eq('ical_export_token', token).maybeSingle()
  if (!property) return new NextResponse('Not found', { status: 404 })

  const ics = await buildPropertyICal(admin, property)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="room-${property.id}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
