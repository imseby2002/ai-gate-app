import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  // 刪除 401 與 202 在 2026-11-23 的 Trip.com 假訂單
  // 401: 7237cf0f-bfe4-42bf-b1d0-f5e0e0e765cc
  // 202: a8d3be18-8ccd-4d2d-9c11-d6981937ef27
  const toDelete = [
    '7237cf0f-bfe4-42bf-b1d0-f5e0e0e765cc',
    'a8d3be18-8ccd-4d2d-9c11-d6981937ef27'
  ]

  // 先清 blocked_dates
  await supabase
    .from('blocked_dates')
    .delete()
    .in('booking_id', toDelete)

  // 再刪 bookings
  const { data, error } = await supabase
    .from('bookings')
    .delete()
    .in('id', toDelete)
    .select('id, guest_name, check_in, check_out, property_id')

  return NextResponse.json({
    deleted: data,
    error: error?.message,
  })
}

