import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()

  const { data: bookings23 } = await supabase
    .from('bookings')
    .select('id, user_id, property_id, platform, guest_name, check_in, check_out, status, source, total_price, platform_booking_id, raw_data, properties(name)')
    .lte('check_in', '2026-11-24')
    .gte('check_out', '2026-11-23')

  const { data: blocked23 } = await supabase
    .from('blocked_dates')
    .select('id, user_id, property_id, booking_id, ical_setting_id, date, platform, reason, properties(name)')
    .in('date', ['2026-11-22', '2026-11-23', '2026-11-24'])

  return NextResponse.json({
    bookings23,
    blocked23,
  })
}

