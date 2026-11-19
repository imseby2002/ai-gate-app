import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncICalForSetting } from '@/lib/booking/ical-sync'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()

  // 逐步診斷 syncICalForSetting
  const { data: s } = await supabase
    .from('ical_settings')
    .select('*, properties(id, name, room_count)')
    .eq('id', '3f4d7133-44a1-46f8-af32-44e8c4f929d9')
    .single()

  const syncOutputs: any[] = []
  const targetSettingId = req.nextUrl.searchParams.get('id') || '3f4d7133-44a1-46f8-af32-44e8c4f929d9'
  try {
    const out = await syncICalForSetting(targetSettingId, { force: true })
    syncOutputs.push({ id: targetSettingId, out })
  } catch (e) {
    syncOutputs.push({ id: targetSettingId, error: String(e) })
  }

  // 檢查 301 在 bookings 的所有記錄（包含 cancelled）
  const { data: allRawBookings301 } = await supabase
    .from('bookings')
    .select('id, platform, guest_name, check_in, check_out, status, source, platform_booking_id, created_at, updated_at')
    .eq('property_id', 'e6152875-453a-4afc-89e3-052fbbf66dab')
    .ilike('platform_booking_id', '%a59cc8f0%')

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
    allRawBookings301,
    ownerBlocks,
    allBookings301,
    bookings22,
    blocked22,
  })
}
