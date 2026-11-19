import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeFetch } from '@/lib/ssrf'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('ical_settings')
    .select('*, properties(id, name, room_count)')
    .order('created_at')

  const results: any[] = []

  for (const s of settings ?? []) {
    let raw = ''
    let fetchErr: string | null = null
    try {
      const res = await safeFetch(s.ical_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-GATE/1.0 iCal Sync',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      raw = await res.text()
    } catch (e) {
      fetchErr = String(e)
    }

    let raw301 = ''
    const events22: string[] = []
    let allTripEvents: string[] = []
    if (raw) {
      if (s.platform === 'trip_com' && s.properties?.name?.includes('301')) {
        raw301 = raw
      }
      const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
      const lines = unfolded.split(/\r?\n/)
      let cur: string[] = []
      for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
          cur = [line]
        } else if (line === 'END:VEVENT') {
          cur.push(line)
          const text = cur.join('\n')
          if (s.platform === 'trip_com' && s.properties?.name?.includes('301')) {
            allTripEvents.push(text)
          }
          cur = []
        } else if (cur.length > 0) {
          cur.push(line)
        }
      }
    }

    results.push({
      id: s.id,
      platform: s.platform,
      platform_name: s.platform_name,
      property_name: s.properties?.name,
      last_synced_at: s.last_synced_at,
      last_sync_error: s.last_sync_error,
      fetchErr,
      events22,
      rawLength: raw.length,
      tripRaw: s.platform === 'trip_com' ? raw : undefined,
    })
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
    results,
    bookings22,
    blocked22,
  })
}
