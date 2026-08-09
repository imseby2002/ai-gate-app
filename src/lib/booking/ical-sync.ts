import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateOrder } from './orders'

export const ICAL_PLATFORMS: Record<string, { name: string; color: string }> = {
  booking_com:  { name: 'Booking.com',  color: '#003580' },
  agoda:        { name: 'Agoda',        color: '#5C2D91' },
  airbnb:       { name: 'Airbnb',       color: '#FF5A5F' },
  trip_com:     { name: 'Trip.com',     color: '#007DFF' },
  asiayo:       { name: 'AsiaYo',       color: '#F26522' },
  easytravel:   { name: 'EasyTravel',   color: '#00AEEF' },
  other:        { name: '其他平台',      color: '#6B7280' },
}

interface ICalEvent {
  uid: string
  start: string
  end: string
  summary: string
  description: string
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

  // 已接通即時同步（Channex 等第三方）的民宿由第三方負責房況與訂單，
  // iCal 同步停用，避免三個資料來源互相打架。
  const { data: rtSub } = await supabase
    .from('booking_subscriptions')
    .select('realtime_sync_active')
    .eq('user_id', setting.user_id)
    .maybeSingle()
  if (rtSub?.realtime_sync_active) {
    result.errors.push('已啟用即時同步，iCal 同步已停用')
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

  let vevents: ICalEvent[]
  try {
    vevents = parseICalEvents(rawIcal)
  } catch (e) {
    const msg = `[${setting.platform_name}] 解析 iCal 失敗：${String(e)}`
    result.errors.push(msg)
    await supabase.from('ical_settings').update({
      last_sync_error: msg, last_synced_at: new Date().toISOString(),
    }).eq('id', settingId)
    return result
  }

  for (const ev of vevents) {
    const checkIn  = ev.start
    const checkOut = ev.end
    const guestName = extractGuestName(ev.summary, setting.platform)

    // Airbnb 等平台的「不可訂」佔位區塊（SUMMARY 為 "Not available" 之類，代表房主
    // 自行封鎖的可訂範圍，不是真實訂單）常常沒有穩定的 UID，或 UID 隨著區間每天往前
    // 滑動而跟著變——這種事件不能當成訂單 upsert（onConflict 對不上舊資料），會導致
    // 每天同步都插入一筆新的假訂單，長期累積成大量重複、把空房算成已被佔用。
    // 這種區塊本來就只代表「不可訂」，只需要寫 blocked_dates 阻擋房況，不必也不該
    // 建立 bookings 資料列。
    const isUnavailableBlock = /not\s*available/i.test(ev.summary) || /not\s*available/i.test(guestName)

    let bookingId: string | null = null
    if (!isUnavailableBlock) {
      const uid = ev.uid || `${settingId}_${ev.start}`
      // iCal 事件本來就是一個房型一個訂單，1:1 建一筆 booking_orders 即可，不像
      // email 那樣需要把多個房型併成同一張訂單。
      const orderId = await findOrCreateOrder(supabase, setting.user_id, setting.platform, uid, {
        guest_name: guestName, source: 'ical',
      })
      const { data: bk, error: bkErr } = await supabase
        .from('bookings')
        .upsert({
          user_id:             setting.user_id,
          order_id:            orderId,
          property_id:         setting.property_id,
          platform:            setting.platform,
          platform_booking_id: uid,
          guest_name:          guestName,
          check_in:            checkIn,
          check_out:           checkOut,
          status:              'confirmed',
          source:              'ical',
          raw_data:            { summary: ev.summary, uid, description: ev.description },
        }, { onConflict: 'user_id,platform,platform_booking_id,property_id' })
        .select('id')
        .single()

      if (bkErr) {
        result.errors.push(`訂單 upsert 失敗 ${uid}: ${bkErr.message}`)
        continue
      }

      bookingId = bk?.id ?? null
      if (bk && !bkErr) {
        result.added++
      } else {
        result.updated++
      }
    }

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

// ── Lightweight iCal parser ───────────────────────────────────

function parseICalEvents(raw: string): ICalEvent[] {
  const events: ICalEvent[] = []
  // Unfold continuation lines (lines starting with whitespace)
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  let inEvent = false
  let current: Partial<ICalEvent> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (current.start && current.end) {
        events.push({
          uid:         current.uid ?? '',
          start:       current.start,
          end:         current.end,
          summary:     current.summary ?? '',
          description: current.description ?? '',
        })
      }
      continue
    }
    if (!inEvent) continue

    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key   = line.slice(0, colon).toUpperCase()
    const value = line.slice(colon + 1).trim()

    if (key === 'UID')                                current.uid         = value
    else if (key === 'SUMMARY')                       current.summary     = decodeICalText(value)
    else if (key === 'DESCRIPTION')                   current.description = decodeICalText(value)
    else if (key.startsWith('DTSTART'))               current.start       = parseDateValue(key, value)
    else if (key.startsWith('DTEND'))                 current.end         = parseDateValue(key, value)
  }

  return events
}

function parseDateValue(key: string, value: string): string {
  // Key may be DTSTART;VALUE=DATE or DTSTART;TZID=...
  // Value may be 20240101 or 20240101T120000Z
  const cleaned = value.replace(/[^0-9TZ]/g, '')
  if (cleaned.length === 8) {
    // DATE: YYYYMMDD
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`
  }
  // DATETIME: parse as ISO
  const y = cleaned.slice(0, 4)
  const mo = cleaned.slice(4, 6)
  const d = cleaned.slice(6, 8)
  return `${y}-${mo}-${d}`
}

function decodeICalText(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

// ── Helpers ──────────────────────────────────────────────────

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
  const cleaned = summary
    .replace(/^CLOSED\s*-?\s*/i, '')
    .replace(new RegExp(`^${platform}\\s*-?\\s*`, 'i'), '')
    .trim()
  return cleaned || '(iCal 訂單)'
}
