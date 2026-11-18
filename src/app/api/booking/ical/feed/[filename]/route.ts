import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPropertyICal } from '@/lib/booking/ical-export'

export const dynamic = 'force-dynamic'

// 公開 iCal 匯出（OTA 訂閱用，相容 Agoda / Airbnb / Booking 等嚴格驗證以 .ics 結尾的格式）
// 例如：/api/booking/ical/feed/[token].ics
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const token = filename.replace(/\.ics$/i, '')
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const admin = createAdminClient()
  const { data: property } = await admin
    .from('properties')
    .select('id, user_id, name')
    .eq('ical_export_token', token)
    .maybeSingle()

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
