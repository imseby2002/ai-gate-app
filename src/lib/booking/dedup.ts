import { SupabaseClient } from '@supabase/supabase-js'
import { syncDailyRecordForBooking } from './daily-sync'

export interface BookingRow {
  id: string
  user_id: string
  order_id?: string | null
  property_id: string | null
  platform: string
  platform_booking_id?: string | null
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  check_in: string
  check_out: string
  num_guests?: number
  total_price?: number | null
  currency?: string
  status: string
  source?: string | null
  notes?: string | null
  raw_data?: Record<string, unknown> | null
  created_at?: string
  properties?: { id?: string; name?: string; room_count?: number } | null
}

const PLACEHOLDER_NAME_REGEX = /^(?:\(iCal\s*訂單\)|\(待補充\)|not\s*available|fully\s*booked|roomstatus.*|closed.*)$/i

/**
 * 判斷該訂單是否已有旅客或訂購資訊填寫（非單純的 iCal 佔位）。
 * 滿足以下任一條件即視為「已填寫」：
 * 1. 來源不是 ical（如 email、manual、form、direct）
 * 2. 總金額大於 0（iCal 協議通常不含訂單金額）
 * 3. 旅客姓名非空且非佔位字串（如 "(iCal 訂單)"、"RoomStatus Fully booked" 等）
 * 4. 有填寫電話或 Email
 */
export function isBookingFilled(bk: Partial<BookingRow>): boolean {
  if (bk.source && bk.source !== 'ical') return true
  if (bk.total_price != null && Number(bk.total_price) > 0) return true
  if (bk.guest_phone?.trim() || bk.guest_email?.trim()) return true

  const name = (bk.guest_name ?? '').trim()
  if (!name) return false
  if (PLACEHOLDER_NAME_REGEX.test(name)) return false
  return true
}

/**
 * 判斷兩個住宿時段是否重疊（前開後閉區間，退房日當天不佔用過夜）
 */
export function datesOverlap(ci1: string, co1: string, ci2: string, co2: string): boolean {
  return ci1 < co2 && co1 > ci2
}

/**
 * 計算訂單資訊豐富度評分，越高代表資料越完整，應優先保留。
 */
export function scoreBooking(bk: BookingRow): number {
  let score = 0
  if (isBookingFilled(bk)) score += 100
  if (bk.total_price != null && Number(bk.total_price) > 0) score += 50
  if (bk.source && bk.source !== 'ical') score += 30
  if (bk.guest_phone?.trim()) score += 20
  if (bk.guest_email?.trim()) score += 10
  if (bk.platform_booking_id && !bk.platform_booking_id.startsWith('ical_')) score += 10
  // 建立時間早的微幅加分，作為 tie-breaker
  if (bk.created_at) {
    const ts = new Date(bk.created_at).getTime()
    if (!isNaN(ts)) score += (ts % 1000) / 1000
  }
  return score
}

export interface DuplicateCluster {
  keeper: BookingRow
  duplicatesToRemove: BookingRow[]
}

/**
 * 偵測訂單列表中的重複訂單群組。
 * 規則：
 * 1. 同一房源、同一平台、非取消狀態，且日期區間重疊。
 * 2. 若房型為單間（room_count === 1），同房源重疊必為同一間房，不可有多筆訂單；
 * 3. 若為多間房型，但一筆為「已填寫」且另一筆為「iCal 佔位」，且入住退房日完全相同，亦視為同筆重複。
 */
export function findDuplicateClusters(
  bookings: BookingRow[],
  roomCountMap: Map<string, number> = new Map()
): DuplicateCluster[] {
  // 排除已取消訂單與未指派房源的訂單
  const active = bookings.filter(b => b.status !== 'cancelled' && b.property_id)

  // 依 (user_id, property_id, platform) 分組
  const groups = new Map<string, BookingRow[]>()
  for (const b of active) {
    const key = `${b.user_id}|${b.property_id}|${b.platform}`
    const list = groups.get(key) ?? []
    list.push(b)
    groups.set(key, list)
  }

  const clusters: DuplicateCluster[] = []

  for (const [, group] of groups.entries()) {
    if (group.length < 2) continue

    const propertyId = group[0].property_id!
    const roomCount = roomCountMap.get(propertyId) ?? group[0].properties?.room_count ?? 1
    const isSingleRoom = roomCount === 1

    // 依入住日排序
    const sorted = [...group].sort((a, b) => a.check_in.localeCompare(b.check_in))
    const visited = new Set<string>()

    for (let i = 0; i < sorted.length; i++) {
      const b1 = sorted[i]
      if (visited.has(b1.id)) continue

      const clusterItems: BookingRow[] = [b1]

      for (let j = i + 1; j < sorted.length; j++) {
        const b2 = sorted[j]
        if (visited.has(b2.id)) continue

        const overlap = datesOverlap(b1.check_in, b1.check_out, b2.check_in, b2.check_out)
        if (!overlap) continue

        if (isSingleRoom) {
          // 單間房型：同平台重疊必然重複
          clusterItems.push(b2)
          visited.add(b2.id)
        } else {
          // 多間房型：若起訖日期相同且其中一筆為 iCal 佔位、另一筆為已填寫訂單，視為重複
          const sameDates = b1.check_in === b2.check_in && b1.check_out === b2.check_out
          const oneFilledOnePlaceholder =
            (isBookingFilled(b1) && !isBookingFilled(b2)) ||
            (isBookingFilled(b2) && !isBookingFilled(b1))
          if (sameDates && oneFilledOnePlaceholder) {
            clusterItems.push(b2)
            visited.add(b2.id)
          }
        }
      }

      if (clusterItems.length > 1) {
        visited.add(b1.id)
        // 依評分挑選最完整的作為 keeper
        clusterItems.sort((a, b) => scoreBooking(b) - scoreBooking(a))
        const keeper = clusterItems[0]
        const duplicatesToRemove = clusterItems.slice(1)
        clusters.push({ keeper, duplicatesToRemove })
      }
    }
  }

  return clusters
}

export interface DedupResult {
  examined: number
  deleted: number
  details: Array<{
    propertyId: string
    platform: string
    keeperId: string
    keeperName: string | null
    removedId: string
    removedName: string | null
    checkIn: string
    checkOut: string
  }>
}

/**
 * 執行重複訂單檢核與清理刪除
 */
export async function deduplicateBookings(
  supabase: SupabaseClient,
  options: {
    userId?: string
    propertyId?: string
    from?: string
    to?: string
  } = {}
): Promise<DedupResult> {
  const result: DedupResult = { examined: 0, deleted: 0, details: [] }

  // 1. 讀取房源 room_count
  let propQ = supabase.from('properties').select('id, name, room_count')
  if (options.userId) propQ = propQ.eq('user_id', options.userId)
  if (options.propertyId) propQ = propQ.eq('id', options.propertyId)
  const { data: props } = await propQ

  const roomCountMap = new Map<string, number>()
  for (const p of props ?? []) {
    roomCountMap.set(p.id, p.room_count ?? 1)
  }

  // 2. 讀取待比對的有效訂單
  let bkQ = supabase
    .from('bookings')
    .select(`
      id, user_id, order_id, property_id, platform, platform_booking_id,
      guest_name, guest_email, guest_phone,
      check_in, check_out, num_guests, total_price, currency,
      status, source, notes, raw_data, created_at,
      properties(id, name, room_count)
    `)
    .neq('status', 'cancelled')

  if (options.userId) bkQ = bkQ.eq('user_id', options.userId)
  if (options.propertyId) bkQ = bkQ.eq('property_id', options.propertyId)
  if (options.from) bkQ = bkQ.gte('check_out', options.from)
  if (options.to) bkQ = bkQ.lte('check_in', options.to)

  const { data: bookings, error } = await bkQ
  if (error || !bookings?.length) return result

  result.examined = bookings.length

  // 3. 找出重複群組
  const clusters = findDuplicateClusters(bookings as BookingRow[], roomCountMap)
  if (!clusters.length) return result

  for (const { keeper, duplicatesToRemove } of clusters) {
    for (const dup of duplicatesToRemove) {
      // a. 將 blocked_dates 關聯切換至 keeper
      // 避免唯一約束衝突：先刪除 duplicate 產生的 blocked_dates 中已有 keeper 存在的日期
      const { data: dupBlocks } = await supabase
        .from('blocked_dates')
        .select('id, date, ical_setting_id')
        .eq('booking_id', dup.id)

      if (dupBlocks?.length) {
        for (const blk of dupBlocks) {
          // 檢查 keeper 是否已在該日有 blocked_date
          const { data: existingKeeperBlk } = await supabase
            .from('blocked_dates')
            .select('id')
            .eq('user_id', keeper.user_id)
            .eq('property_id', keeper.property_id!)
            .eq('date', blk.date)
            .eq('ical_setting_id', blk.ical_setting_id)
            .maybeSingle()

          if (existingKeeperBlk) {
            // 已存在，直接刪除 duplicate 的舊 blocked_date 即可
            await supabase.from('blocked_dates').delete().eq('id', blk.id)
          } else {
            // 不存在，將 booking_id 改為 keeper.id
            await supabase.from('blocked_dates').update({ booking_id: keeper.id }).eq('id', blk.id)
          }
        }
      }

      // b. 將 bnb_daily_records 關聯改至 keeper
      await supabase
        .from('bnb_daily_records')
        .update({ booking_id: keeper.id })
        .eq('booking_id', dup.id)

      // c. 刪除重複的 booking
      const { error: delErr } = await supabase.from('bookings').delete().eq('id', dup.id)
      if (!delErr) {
        result.deleted++
        result.details.push({
          propertyId: keeper.property_id!,
          platform: keeper.platform,
          keeperId: keeper.id,
          keeperName: keeper.guest_name ?? null,
          removedId: dup.id,
          removedName: dup.guest_name ?? null,
          checkIn: dup.check_in,
          checkOut: dup.check_out,
        })
      }

      // d. 若該 duplicate 的 order_id 沒有其他房型明細，清理孤兒 order
      if (dup.order_id && dup.order_id !== keeper.order_id) {
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', dup.order_id)
        if ((count ?? 0) === 0) {
          await supabase.from('booking_orders').delete().eq('id', dup.order_id)
        }
      }
    }

    // e. 確保 keeper 的每日入住同步更新
    try {
      await syncDailyRecordForBooking(supabase, keeper.user_id, keeper)
    } catch {
      // 容錯處理
    }
  }

  return result
}
