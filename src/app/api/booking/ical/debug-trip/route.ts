import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncICalForSetting } from '@/lib/booking/ical-sync'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()

  // 僅強制觸發同步 301 的 Trip.com（ID: 3f4d7133-44a1-46f8-af32-44e8c4f929d9）
  const syncOutputs: any[] = []
  const targetSettingId = req.nextUrl.searchParams.get('id') || '3f4d7133-44a1-46f8-af32-44e8c4f929d9'
  try {
    const out = await syncICalForSetting(targetSettingId, { force: true })
    syncOutputs.push({ id: targetSettingId, out })
  } catch (e) {
    syncOutputs.push({ id: targetSettingId, error: String(e) })
  }

  const { data: ownerBlocks } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('property_id', 'e6152875-453a-4afc-89e3-052fbbf66dab')
    .eq('reason', 'owner_block')

  const { data: allBookings301 } = await supabase
    .from('bookings')
    .select('id, platform, guest_name, check_in, check_out, status, source, platform_booking_id')
    .eq('property_id', 'e6152875-453a-4afc-89e3-052fbbf66dab')
    .gte('check_out', '2026-11-18')
    .lte('check_in', '2026-11-25')

  const { data: bookings22 } = await supabase
    .from('bookings')
    .select('id, property_id, platform, guest_name, check_in, check_out, status, source, total_price, properties(name)')
    .lte('check_in', '2026-11-22')
    .gte('check_out', '2026-11-22')

  const { data: blocked22 } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('date', '2026-11-22')

  return NextResponse.json({
    now: new Date().toISOString(),
    syncOutputs,
    ownerBlocks,
    allBookings301,
    bookings22,
    blocked22,
  })
}
