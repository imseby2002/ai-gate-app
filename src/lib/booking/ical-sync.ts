import ical, { VEvent } from 'node-ical'
import { createAdminClient } from '@/lib/supabase/admin'

export const ICAL_PLATFORMS: Record<string, { name: string; color: string }> = {
  booking_com:  { name: 'Booking.com',  color: '#003580' },
  agoda:        { name: 'Agoda',        color: '#5C2D91' },
  airbnb:       { name: 'Airbnb',       color: '#FF5A5F' },
  trip_com:     { name: 'Trip.com',     color: '#007DFF' },
  asiayo:       { name: 'AsiaYo',       color: '#F26522' },
  easytravel:   { name: 'EasyTravel',   color: '#00AEEF' },
  other:        { name: '其他平台',      color: '#6B7280' },
}

interface SyncResult {
  added: number
  updated: number
  blocked: number
  errors: string[]
}

export async function syncICalForSetting(settingId: string): Promise<SyncResult> {
  const supabase = createAdminClient()
  const result: SyncResult = { added: 0, updated: 0, blocked: 0, errors: [] }

  const { data: setting, error: se } = await supabase
    .from('ical_settings')
    .select('*, properties(id, name)')
    .eq('id', settingId)
    .single()

  if (se || !setting) {
    result.errors.push(`找不到設定：${settingId}`)
    return result
  }

  let rawIcal: string
  try {
    const res = await fetch(setting.ical_url, {
      headers: { 'User-Agent': 'AI-GATE/1.0 iCal Sync' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    rawIcal = await res.text()
  } catch (e) {
    const msg = `[${setting.platform_name}] 抓取 iCal 失敗：${String(e)}`
    result.errors.push(msg)
    await supabase.from('ical_settings').update({
      last_sync_error: msg,
      last_synced_at: new Date().toISOString(),
    }).eq('id', settingId)
    return result
  }

  let events: ReturnType<typeof ical.parseICS>
  try {
    events = ical.parseICS(rawIcal)
  } catch (e) {
    const msg = `[${setting.platform_name}] 解析 iCal 失敗：${String(e)}`
    result.errors.push(msg)
    await supabase.from('ical_settings').update({
      last_sync_error: msg, last_synced_at: new Date().toISOString(),
    }).eq('id', settingId)
    return result
  }

  const vevents = Object.values(events).filter(e => e?.type === 'VEVENT') as VEvent[]

  for (const ev of vevents) {
    if (!ev.start || !ev.end) continue
    const uid = ev.uid ?? `${settingId}_${String(ev.start)}`
    const checkIn  = toDateStr(ev.start)
    const checkOut = toDateStr(ev.end)
    const guestName = extractGuestName(String(ev.summary ?? ''), setting.platform)

    // Upsert booking
    const { data: bk, error: bkErr } = await supabase
      .from('bookings')
      .upsert({
        user_id:             setting.user_id,
        property_id:         setting.property_id,
        platform:            setting.platform,
        platform_booking_id: uid,
        guest_name:          guestName,
        check_in:            checkIn,
        check_out:           checkOut,
        status:              'confirmed',
        source:              'ical',
        raw_data:            { summary: ev.summary, uid, description: ev.description },
      }, { onConflict: 'user_id,platform,platform_booking_id' })
      .select('id')
      .single()

    if (bkErr) {
      result.errors.push(`訂單 upsert 失敗 ${uid}: ${bkErr.message}`)
      continue
    }

    const bookingId = bk?.id
    if (bk && !bkErr) {
      result.added++
    } else {
      result.updated++
    }

    // Blocked dates: every day from check_in to check_out (exclusive)
    const dates = dateRange(checkIn, checkOut)
    for (const date of dates) {
      const { error: bdErr } = await supabase
        .from('blocked_dates')
        .upsert({
          user_id:         setting.user_id,
          property_id:     setting.property_id,
          booking_id:      bookingId,
          ical_setting_id: settingId,
          date,
          platform:        setting.platform,
          reason:          'booking',
        }, { onConflict: 'user_id,property_id,date,ical_setting_id' })

      if (!bdErr) result.blocked++
    }
  }

  await supabase.from('ical_settings').update({
    last_synced_at:  new Date().toISOString(),
    last_sync_count: result.added + result.updated,
    last_sync_error: result.errors.length > 0 ? result.errors[0] : null,
  }).eq('id', settingId)

  return result
}

export async function syncAllICalForUser(userId: string) {
  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('ical_settings')
    .select('id')
    .eq('user_id', userId)
    .eq('sync_enabled', true)

  if (!settings?.length) return []
  return Promise.all(settings.map((s: { id: string }) => syncICalForSetting(s.id)))
}

// ── Helpers ──────────────────────────────────────────────────

function toDateStr(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toISOString().slice(0, 10)
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  const endDt = new Date(end)
  while (cur < endDt) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function extractGuestName(summary: string, platform: string): string {
  // Booking.com: "CLOSED - John Smith"
  // Airbnb: "Reserved"
  // Agoda: "Agoda - John Smith"
  const cleaned = summary
    .replace(/^CLOSED\s*-?\s*/i, '')
    .replace(new RegExp(`^${platform}\\s*-?\\s*`, 'i'), '')
    .trim()
  return cleaned || '(iCal 訂單)'
}
