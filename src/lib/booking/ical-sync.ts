import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateOrder } from './orders'
import { safeFetch } from '@/lib/ssrf'
import { isBookingFilled, datesOverlap, deduplicateBookings, BookingRow } from './dedup'

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
  cancelled: number
  errors: string[]
}

const ICAL_HASH_VERSION = 'v5_owner_block_loop_20261119'

export async function syncICalForSetting(
  settingId: string,
  options?: { force?: boolean }
): Promise<SyncResult> {
  const supabase = createAdminClient()
  const result: SyncResult = { added: 0, updated: 0, blocked: 0, cancelled: 0, errors: [] }

  const { data: setting, error: se } = await supabase
    .from('ical_settings')
    .select('*, properties(id, name, room_count)')
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
    const res = await safeFetch(setting.ical_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-GATE/1.0 iCal Sync',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
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

  // 事件內容與上次成功同步時相同 → 房況沒變，不重寫訂單與 blocked_dates。
  // 強制同步 (force=true) 或雜湊版本升級時必跑完整流程。
  const icalHash = createHash('sha256')
    .update(ICAL_HASH_VERSION)
    .update(JSON.stringify(vevents.map(e => [e.uid, e.start, e.end, e.summary, e.description])))
    .digest('hex')
  if (!options?.force && setting.last_ical_hash === icalHash && !setting.last_sync_error) {
    await supabase.from('ical_settings').update({ last_synced_at: new Date().toISOString() }).eq('id', settingId)
    return result
  }

  const roomCount = (setting.properties as { room_count?: number } | null)?.room_count ?? 1
  const isSingleRoom = roomCount === 1

  // 抓取此房源既有的非取消訂單，用以比對「該房型是否已填寫」與避免重複建立
  const { data: propBookings } = await supabase
    .from('bookings')
    .select('id, guest_name, total_price, num_guests, source, platform, platform_booking_id, check_in, check_out, status, notes, raw_data, order_id')
    .eq('user_id', setting.user_id)
    .eq('property_id', setting.property_id)
    .neq('status', 'cancelled')

  const existingPropBookings: BookingRow[] = (propBookings ?? []) as BookingRow[]

  // 抓取此房源由房東在系統手動設定的「關房日期」（owner_block）
  // 核心保護：本系統手動關房後，iCal 匯出會帶給 Booking.com 等 OTA 關房；
  // 但 OTA 同步回傳的 CLOSED / 關房事件 UID 絕不可被當成新訂單「回溯」建立訂單！
  const { data: ownerBlocks } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('user_id', setting.user_id)
    .eq('property_id', setting.property_id)
    .eq('reason', 'owner_block')

  const ownerBlockedDateSet = new Set<string>((ownerBlocks ?? []).map((b: { date: string }) => b.date))

  // 同一天以後出現的事件為準（與逐筆 upsert 時的覆蓋順序一致）
  const wantedBlocks = new Map<string, string | null>()

  for (const ev of vevents) {
    const checkIn  = ev.start
    const checkOut = ev.end
    const guestName = extractGuestName(ev.summary, setting.platform)

    // Airbnb、Booking.com 等平台的「不可訂／關房」佔位區塊。
    // - SUMMARY 為 "Not available" 或 "CLOSED"（如 Booking.com 關房或外部同步）代表房況封鎖，非真實訂單。
    //   此類區塊會寫入 blocked_dates 阻擋房況，但 bookingId 設為 null，避免在訂單列表與行事曆中產生虛假訂單。
    // - 注意：Trip.com 的 iCal 協議因隱私規範，真實旅客預訂在摘要中皆顯示為 "RoomStatus Fully booked"，
    //   絕不能當成不可訂佔位略過，否則 Trip.com 訂單永遠無法建立！
    // - 若此日期區間已有房東手動關房（owner_block），且事件為佔位性質（或 Booking.com 回傳的關房狀態），
    //   絕不能被當作真實訂單重新寫入！
    const evDates = dateRange(checkIn, checkOut)
    const hasOwnerBlock = evDates.some(d => ownerBlockedDateSet.has(d))
    const isPlaceholderOrGeneric =
      !guestName ||
      guestName === '(iCal 訂單)' ||
      guestName === '(Trip.com 訂單)' ||
      /roomstatus/i.test(ev.summary) ||
      /fully\s*booked/i.test(ev.summary) ||
      /^closed/i.test(ev.summary.trim()) ||
      /^not\s*available$/i.test(ev.summary.trim())

    const rawSummary = (ev.summary ?? '').trim()
    const isUnavailableBlock =
      hasOwnerBlock && isPlaceholderOrGeneric
        ? true
        : setting.platform === 'airbnb'
          ? (/not\s*available/i.test(rawSummary) || /not\s*available/i.test(guestName))
          : setting.platform === 'booking_com'
            ? (/^closed(?:\s*-.*)?$/i.test(rawSummary) || /^not\s*available$/i.test(rawSummary) || /^not\s*available$/i.test(guestName.trim()))
            : (/^not\s*available$/i.test(rawSummary) || /^not\s*available$/i.test(guestName.trim()) || /^closed(?:\s*-.*)?$/i.test(rawSummary))

    let bookingId: string | null = null
    if (!isUnavailableBlock) {
      const uid = ev.uid || `${settingId}_${ev.start}`

      // 檢查是否已存在同一平台、同日期區間重疊的有效訂單
      const overlappingSamePlatform = existingPropBookings.filter(b =>
        b.platform === setting.platform &&
        datesOverlap(b.check_in, b.check_out, checkIn, checkOut)
      )

      // 跨平台檢查：若為單間房型（room_count === 1），且該房型已被其他平台（如 Agoda、直訂）訂走
      const filledBookingAnyPlatform = isSingleRoom
        ? existingPropBookings.find(b => isBookingFilled(b) && datesOverlap(b.check_in, b.check_out, checkIn, checkOut))
        : null

      // 規則 1：如果該房間已經填寫（無論是同平台，或是單間房型已被其他平台填寫），
      // 應該就不用再重複建立，直接沿用既有訂單 ID 阻擋房況！
      const filledBooking = isSingleRoom
        ? (filledBookingAnyPlatform || overlappingSamePlatform.find(b => isBookingFilled(b)))
        : overlappingSamePlatform.find(b => isBookingFilled(b) && b.check_in === checkIn && b.check_out === checkOut)

      if (filledBooking) {
        // 已有完整資料的訂單：不重複新增，沿用其 id
        bookingId = filledBooking.id
        result.updated++
      } else {
        // 規則 2：如果沒有填寫，以 iCal 為主（建立或更新 iCal 訂單）
        // 先尋找是否已有同 UID 或同日期的 iCal 佔位訂單，避免多餘 insert
        const existingIcal = overlappingSamePlatform.find(b => b.platform_booking_id === uid) ||
          (isSingleRoom ? overlappingSamePlatform.find(b => b.source === 'ical') : null)

        if (existingIcal) {
          bookingId = existingIcal.id
          // 若原本就有姓名（例如手動填入或 Email 補齊），不被佔位名稱覆蓋
          const isPlaceholderName = (n: string | null | undefined) =>
            !n || n === '(iCal 訂單)' || n === '(Trip.com 訂單)' || n === '(待補充)' || /roomstatus/i.test(n) || /fully\s*booked/i.test(n)

          const updatePatch: Record<string, unknown> = {
            check_in: checkIn,
            check_out: checkOut,
            raw_data: { summary: ev.summary, uid, description: ev.description },
          }
          if (guestName && !isPlaceholderName(guestName) && isPlaceholderName(existingIcal.guest_name)) {
            updatePatch.guest_name = guestName
          } else if (isPlaceholderName(existingIcal.guest_name) && guestName && guestName !== existingIcal.guest_name) {
            updatePatch.guest_name = guestName
          }
          await supabase.from('bookings').update(updatePatch).eq('id', existingIcal.id)
          result.updated++
        } else {
          // 真正全新的 iCal 訂單
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
            existingPropBookings.push({
              id: bk.id,
              user_id: setting.user_id,
              property_id: setting.property_id,
              platform: setting.platform,
              platform_booking_id: uid,
              guest_name: guestName,
              check_in: checkIn,
              check_out: checkOut,
              status: 'confirmed',
              source: 'ical',
            })
          } else {
            result.updated++
          }
        }
      }
    }

    for (const date of dateRange(checkIn, checkOut)) wantedBlocks.set(date, bookingId)
  }

  // 只寫入新增或 booking_id 有變的日期，已存在且相同的不重寫
  const { data: existingBlocks, error: exErr } = await supabase
    .from('blocked_dates')
    .select('date, booking_id')
    .eq('user_id', setting.user_id)
    .eq('property_id', setting.property_id)
    .eq('ical_setting_id', settingId)
  if (exErr) result.errors.push(`讀取既有房況失敗：${exErr.message}`)
  const existing = new Map((existingBlocks ?? []).map((b: { date: string; booking_id: string | null }) => [b.date, b.booking_id]))
  const toWrite = [...wantedBlocks]
    .filter(([date, bookingId]) => exErr || !existing.has(date) || existing.get(date) !== bookingId)
    .map(([date, bookingId]) => ({
      user_id:         setting.user_id,
      property_id:     setting.property_id,
      booking_id:      bookingId,
      ical_setting_id: settingId,
      date,
      platform:        setting.platform,
      reason:          'booking',
    }))
  for (let i = 0; i < toWrite.length; i += 500) {
    const { error: bdErr } = await supabase
      .from('blocked_dates')
      .upsert(toWrite.slice(i, i + 500), { onConflict: 'user_id,property_id,date,ical_setting_id' })
    if (bdErr) result.errors.push(`房況寫入失敗：${bdErr.message}`)
  }
  result.blocked = wantedBlocks.size

  // ── 取消處理 ──────────────────────────────────────────────
  // 客人在平台取消後，該事件會從 iCal feed 消失。把這個設定底下「原本有、這次已不在
  // feed」的房況日期釋出，並把事件整筆消失（原本有 block、現在完全沒有）的訂單標記取消。
  // 只有 feed 抓取/解析成功才會走到這裡（失敗會提早 return），不會因為一次抓取失敗就誤放房況。
  if (!exErr) {
    const staleDates = (existingBlocks ?? []).map(b => b.date).filter(d => !wantedBlocks.has(d))
    for (let i = 0; i < staleDates.length; i += 500) {
      const { error: delErr } = await supabase.from('blocked_dates').delete()
        .eq('user_id', setting.user_id).eq('property_id', setting.property_id)
        .eq('ical_setting_id', settingId).in('date', staleDates.slice(i, i + 500))
      if (delErr) result.errors.push(`釋出房況失敗：${delErr.message}`)
    }
    const wantedBookingIds = new Set([...wantedBlocks.values()].filter((v): v is string => !!v))
    const cancelledIds = [...new Set((existingBlocks ?? [])
      .map(b => b.booking_id).filter((v): v is string => !!v))]
      .filter(id => !wantedBookingIds.has(id))
    if (cancelledIds.length > 0) {
      const { error: cErr } = await supabase.from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', cancelledIds).eq('user_id', setting.user_id).eq('source', 'ical').neq('status', 'cancelled')
      if (cErr) result.errors.push(`標記取消失敗：${cErr.message}`)
      else result.cancelled = cancelledIds.length
    }
  }

  await supabase.from('ical_settings').update({
    last_synced_at:  new Date().toISOString(),
    last_sync_count: result.added + result.updated,
    last_sync_error: result.errors.length > 0 ? result.errors[0] : null,
    // 有錯誤時不記雜湊，下次照常完整同步
    last_ical_hash:  result.errors.length > 0 ? null : icalHash,
  }).eq('id', settingId)

  // 規則 3：同步後自動檢核並清理重複訂單
  try {
    await deduplicateBookings(supabase, {
      userId: setting.user_id,
      propertyId: setting.property_id,
    })
  } catch (err) {
    console.error('iCal post-sync deduplication error:', err)
  }

  return result
}

export async function syncAllICalForUser(userId: string, options?: { force?: boolean }) {
  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from('ical_settings')
    .select('id')
    .eq('user_id', userId)
    .eq('sync_enabled', true)

  if (!settings?.length) return []
  return Promise.all(settings.map((s: { id: string }) => syncICalForSetting(s.id, options)))
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
      if (current.start) {
        // 若缺少 DTEND 或結束日早於等於入住日，預設入住 1 晚
        if (!current.end || current.end <= current.start) {
          const nextDay = new Date(new Date(current.start + 'T00:00:00').getTime() + 86400000).toISOString().slice(0, 10)
          current.end = nextDay
        }
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
  // 若為 UTC 時間格式 (含 Z)，換算為台灣時間 (UTC+8) 日期，避免跨日時差導致日期偏移 1 天
  if (value.toUpperCase().includes('Z') && cleaned.length >= 15) {
    const y = parseInt(cleaned.slice(0, 4), 10)
    const mo = parseInt(cleaned.slice(4, 6), 10) - 1
    const d = parseInt(cleaned.slice(6, 8), 10)
    const h = parseInt(cleaned.slice(9, 11), 10)
    const mi = parseInt(cleaned.slice(11, 13), 10)
    const s = parseInt(cleaned.slice(13, 15), 10)
    const utcMs = Date.UTC(y, mo, d, h, mi, s)
    const twDate = new Date(utcMs + 8 * 3600 * 1000)
    return twDate.toISOString().slice(0, 10)
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

  const isTrip = platform === 'trip_com' || platform === 'ctrip'
  if (!cleaned || /^(?:roomstatus(?:\s+fully\s*booked)?|fully\s*booked|not\s*available|reserved)$/i.test(cleaned) || /roomstatus/i.test(cleaned)) {
    return isTrip ? '(Trip.com 訂單)' : '(iCal 訂單)'
  }
  return cleaned
}

