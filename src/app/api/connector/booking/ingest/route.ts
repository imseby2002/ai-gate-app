// POST /api/connector/booking/ingest — Booking.com 讀後台外掛推送「已登入後台看到的訂單」。
// 外掛讀的是民宿主自己已登入的 Booking.com extranet 頁面（非爬蟲登入），把每筆訂單的
// 單號／姓名／房型／日期／金額送來；此端點比對房源、去重後寫入 bookings。
// 以裝置 Bearer token 驗證（requireBookingDevice），不做無人值守的自動發文或操作平台。
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBookingDevice } from '@/lib/connector/booking-auth'
import { findOrCreateOrder } from '@/lib/booking/orders'
import { syncDailyRecordForBooking } from '@/lib/booking/daily-sync'
import { isBookingFilled } from '@/lib/booking/dedup'
import { matchPropertyByName } from '@/lib/booking/email-sync'

// 連接器支援的平台（讀各家後台）。別名正規化：ctrip→trip_com、expedia 保留。
const PLATFORM_ALIASES: Record<string, string> = {
  booking_com: 'booking_com', 'booking.com': 'booking_com', booking: 'booking_com',
  agoda: 'agoda', 'agoda.com': 'agoda',
  trip_com: 'trip_com', 'trip.com': 'trip_com', ctrip: 'trip_com', 'ctrip.com': 'trip_com',
  asiayo: 'asiayo', 'asiayo.com': 'asiayo',
  expedia: 'expedia', 'expedia.com': 'expedia',
  airbnb: 'airbnb', easytravel: 'easytravel',
}
function normalizePlatform(p: unknown): string | null {
  const key = String(p ?? '').trim().toLowerCase()
  return PLATFORM_ALIASES[key] ?? null
}
const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

interface IncomingReservation {
  platform?: string // booking_com / agoda / trip_com(ctrip) / asiayo / expedia …
  confirmation_id?: string
  guest_name?: string
  room_name?: string
  check_in?: string
  check_out?: string
  total_price?: number | null
  num_guests?: number | null
  status?: string // 'cancelled' | 'confirmed'（外掛自行判斷後台列表狀態）
}

// 清理各平台房名尾端的括號 ID（如 Agoda roomTypeName「山景雙人房 (6804244)」→「山景雙人房」），
// 避免括號內 ID 干擾房號比對，並讓房名對應更乾淨一致。
function cleanRoomName(roomName: string | undefined): string | null {
  const n = (roomName ?? '').trim()
  if (!n) return null
  return n.replace(/\s*[（(]\s*\d{3,}\s*[)）]\s*$/, '').trim() || n
}

type PropRow = { id: string; name: string; name_aliases: string[] }

// 把後台房型名稱比對到系統房源：
// 1) 房型管理的名稱/別名比對（與 Email 同步共用同一套 name_aliases）
// 2) 房號數字後援（如房名含 "302"）
function matchProperty(roomName: string | undefined, props: PropRow[]): string | null {
  const n = (roomName ?? '').trim()
  if (!n) return null
  const byAlias = matchPropertyByName(n, props)
  if (byAlias) return byAlias
  const num = n.match(/\d{2,4}/)?.[0]
  if (num) {
    const byNum = props.find(p => p.name.includes(num))
    if (byNum) return byNum.id
  }
  return null
}

export async function POST(req: NextRequest) {
  const auth = await requireBookingDevice(req)
  if (auth.res) return auth.res
  const userId = auth.device.userId

  const body = await req.json().catch(() => ({}))
  const reservations: IncomingReservation[] = Array.isArray(body?.reservations) ? body.reservations : []
  if (reservations.length === 0) return NextResponse.json({ error: '沒有訂單資料' }, { status: 400 })
  if (reservations.length > 200) return NextResponse.json({ error: '單次最多 200 筆' }, { status: 400 })

  const admin = createAdminClient()
  const { data: propRows } = await admin.from('properties').select('id, name, name_aliases').eq('user_id', userId)
  const props: PropRow[] = (propRows ?? []).map(p => ({
    id: p.id as string, name: p.name as string, name_aliases: (p.name_aliases as string[] | null) ?? [],
  }))


  // 整批可帶一個預設平台（body.platform），個別訂單也可自帶 platform 覆蓋
  const defaultPlatform = normalizePlatform(body?.platform)

  const result = { received: reservations.length, created: 0, updated: 0, cancelled: 0, skipped: 0, errors: [] as string[] }

  for (const r of reservations) {
    const platform = normalizePlatform(r.platform) ?? defaultPlatform
    if (!platform) { result.skipped++; continue }
    const confId = (r.confirmation_id ?? '').trim()
    if (!confId) { result.skipped++; continue }
    const checkIn = isYmd(r.check_in) ? r.check_in : null
    const isCancel = (r.status ?? '').toLowerCase() === 'cancelled'

    // 找同單號既有訂單（任一房型，排除已取消）
    const { data: existingRows } = await admin.from('bookings')
      .select('id, property_id, guest_name, guest_email, guest_phone, total_price, num_guests, check_in, check_out, status, platform, source')
      .eq('user_id', userId).eq('platform', platform).eq('platform_booking_id', confId)
      .neq('status', 'cancelled')
    const existing = (existingRows ?? [])[0]

    // 取消：後台顯示已取消 → 把系統這筆也標取消並釋出房況
    if (isCancel) {
      if (existing && existing.status !== 'cancelled') {
        await admin.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', existing.id)
        await admin.from('blocked_dates').delete().eq('booking_id', existing.id)
        await syncDailyRecordForBooking(admin, userId, { ...existing, status: 'cancelled' }).catch(() => {})
        result.cancelled++
      } else {
        result.skipped++
      }
      continue
    }

    if (!checkIn) { result.skipped++; continue }
    const checkOut = isYmd(r.check_out) && r.check_out > checkIn
      ? r.check_out
      : new Date(new Date(checkIn).getTime() + 86400000).toISOString().slice(0, 10)
    const roomName = cleanRoomName(r.room_name)
    const propertyId = matchProperty(roomName ?? undefined, props)
    const guestName = (r.guest_name ?? '').trim() || null
    const price = typeof r.total_price === 'number' && r.total_price > 0 ? r.total_price : null
    const guests = typeof r.num_guests === 'number' && r.num_guests > 0 ? r.num_guests : null

    // 既有訂單 → 補齊（姓名、房型、金額、人數），不覆蓋人工已填的真實資料
    if (existing) {
      const patch: Record<string, unknown> = {}
      if (guestName && !isBookingFilled(existing)) patch.guest_name = guestName
      if (propertyId && !existing.property_id) patch.property_id = propertyId
      if (price != null && existing.total_price == null) patch.total_price = price
      if (guests != null && (existing.num_guests == null || existing.num_guests <= 1)) patch.num_guests = guests
      if (Object.keys(patch).length > 0) {
        const { data: updated } = await admin.from('bookings')
          .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id)
          .select('id, property_id, guest_name, total_price, num_guests, check_in, check_out, status, platform').single()
        if (updated) await syncDailyRecordForBooking(admin, userId, updated, existing).catch(() => {})
        result.updated++
      } else {
        result.skipped++
      }
      continue
    }

    // 全新訂單 → 建立（房型配不到就留 null「房型未定」，待人工指派或 iCal 對應）
    try {
      const orderId = await findOrCreateOrder(admin, userId, platform, confId, {
        guest_name: guestName, source: 'connector',
      })
      const { data: inserted, error: insErr } = await admin.from('bookings').upsert({
        user_id: userId,
        order_id: orderId,
        property_id: propertyId,
        platform,
        platform_booking_id: confId,
        guest_name: guestName ?? '(待補充)',
        check_in: checkIn,
        check_out: checkOut,
        num_guests: guests ?? 1,
        total_price: price,
        status: 'confirmed',
        source: 'connector',
        raw_data: { source: 'extranet', platform, confirmation_id: confId, room_name: roomName },
      }, { onConflict: 'user_id,platform,platform_booking_id,property_id' })
        .select('id, property_id, guest_name, total_price, num_guests, check_in, check_out, status, platform').single()
      if (insErr) { result.errors.push(`${confId}: ${insErr.message}`); continue }
      if (inserted) await syncDailyRecordForBooking(admin, userId, inserted).catch(() => {})
      result.created++
    } catch (e) {
      result.errors.push(`${confId}: ${String(e)}`)
    }
  }

  return NextResponse.json(result)
}
