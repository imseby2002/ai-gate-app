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
    bookings22,
    blocked22,
  })
}
