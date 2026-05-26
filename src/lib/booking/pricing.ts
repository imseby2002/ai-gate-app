import type { SupabaseClient } from '@supabase/supabase-js'

export interface StayQuote {
  nights: number
  total: number
  currency: string
  perNight: { date: string; amount: number }[]
  extraGuestFee: number
  warnings: string[]
}

function enumerateNights(checkIn: string, checkOut: string): string[] {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime()
  const end = new Date(`${checkOut}T00:00:00Z`).getTime()
  const out: string[] = []
  if (isNaN(start) || isNaN(end) || end <= start) return out
  for (let t = start; t < end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

// 今天（台灣時區）的 00:00 UTC 毫秒，用於計算「距入住天數」
function taipeiTodayMs(): number {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  return new Date(`${todayStr}T00:00:00Z`).getTime()
}

interface RuleRow {
  rule_type: string
  adjustment_type: 'percent' | 'fixed'
  adjustment_value: number
  conditions: Record<string, unknown>
  priority: number
  property_id: string | null
}

/**
 * 訂房模組的權威計價（Plan A）：每日價 = room_date_settings 覆蓋價 → 否則 property.base_price，
 * 再依 pricing_rules（週末/假日/季節/住房率/臨時訂/早鳥）逐日調整，最後加上超額人數費。
 * 公開訂房、客服 bot、後台預覽都應呼叫此函式，確保金額一致。
 */
export async function computeStayPrice(
  supabase: SupabaseClient,
  userId: string,
  propertyId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<StayQuote | null> {
  const { data: prop } = await supabase
    .from('properties')
    .select('base_price, max_guests, extra_guest_fee, room_count, currency, dynamic_pricing_enabled')
    .eq('id', propertyId).eq('user_id', userId).single()
  if (!prop) return null

  const nights = enumerateNights(checkIn, checkOut)
  if (!nights.length) return null
  const currency = prop.currency ?? 'TWD'
  const warnings: string[] = []

  // 每日覆蓋價
  const { data: dateSettings } = await supabase
    .from('room_date_settings').select('date, price_override')
    .eq('user_id', userId).eq('property_id', propertyId).in('date', nights)
  const overrideMap = new Map<string, number | null>((dateSettings ?? []).map(d => [d.date, d.price_override]))

  // 規則（此房型或全房型）
  const { data: rules } = await supabase
    .from('pricing_rules').select('rule_type, adjustment_type, adjustment_value, conditions, priority, property_id')
    .eq('user_id', userId).eq('enabled', true)
    .or(`property_id.eq.${propertyId},property_id.is.null`)
  const sortedRules = ((rules ?? []) as RuleRow[]).sort((a, b) => b.priority - a.priority)

  // 住房率（僅在有 occupancy 規則時計算）
  const occByDate = new Map<string, number>()
  if (sortedRules.some(r => r.rule_type === 'occupancy')) {
    const roomCount = Math.max(1, prop.room_count ?? 1)
    const [{ data: bk }, { data: pub }, { data: blk }] = await Promise.all([
      supabase.from('bookings').select('check_in, check_out')
        .eq('user_id', userId).eq('property_id', propertyId).in('status', ['pending', 'confirmed'])
        .lt('check_in', checkOut).gt('check_out', checkIn),
      supabase.from('public_bookings').select('check_in, check_out')
        .eq('host_user_id', userId).eq('property_id', propertyId).in('status', ['pending', 'confirmed'])
        .lt('check_in', checkOut).gt('check_out', checkIn),
      supabase.from('blocked_dates').select('date')
        .eq('user_id', userId).eq('property_id', propertyId).gte('date', checkIn).lt('date', checkOut),
    ])
    const occupied = new Map<string, number>()
    const addRange = (ci: string, co: string) => {
      for (const d of enumerateNights(ci, co)) occupied.set(d, (occupied.get(d) ?? 0) + 1)
    }
    for (const b of bk ?? []) addRange(b.check_in, b.check_out)
    for (const b of pub ?? []) addRange(b.check_in, b.check_out)
    for (const b of blk ?? []) occupied.set(b.date, (occupied.get(b.date) ?? 0) + 1)
    for (const d of nights) occByDate.set(d, Math.min(1, (occupied.get(d) ?? 0) / roomCount))
  }

  const todayMs = taipeiTodayMs()
  const perNight: { date: string; amount: number }[] = []
  let total = 0

  for (const date of nights) {
    const override = overrideMap.get(date)
    let price = (override != null ? override : prop.base_price)
    if (price == null) {
      warnings.push(`${date} 無定價，請於定價管理設定`)
      continue
    }
    if (prop.dynamic_pricing_enabled) {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
      const mmdd = date.slice(5)
      const daysUntil = Math.round((new Date(`${date}T00:00:00Z`).getTime() - todayMs) / 86400000)
      const occ = occByDate.get(date) ?? 0
      for (const rule of sortedRules) {
        const c = rule.conditions ?? {}
        let applies = false
        switch (rule.rule_type) {
          case 'weekend':         applies = dow === 0 || dow === 6; break
          case 'holiday':         applies = ((c.dates as string[]) ?? []).includes(date); break
          case 'seasonal': {
            const s = c.start_mmdd as string, e = c.end_mmdd as string
            applies = !!(s && e && mmdd >= s && mmdd <= e); break
          }
          case 'occupancy':       applies = occ >= ((c.threshold as number) ?? 0.8); break
          case 'advance_booking': applies = daysUntil <= ((c.days_before as number) ?? 0); break
          case 'early_bird':      applies = daysUntil >= ((c.days_before as number) ?? 90); break
        }
        if (applies) {
          price = rule.adjustment_type === 'percent'
            ? price * (1 + Number(rule.adjustment_value) / 100)
            : price + Number(rule.adjustment_value)
        }
      }
    }
    price = Math.max(0, Math.round(price))
    perNight.push({ date, amount: price })
    total += price
  }

  let extraGuestFee = 0
  const maxGuests = prop.max_guests ?? 2
  if (guests > maxGuests && prop.extra_guest_fee) {
    extraGuestFee = Math.round(Number(prop.extra_guest_fee) * (guests - maxGuests) * nights.length)
    total += extraGuestFee
  } else if (guests > maxGuests) {
    warnings.push(`入住人數 ${guests} 超過上限 ${maxGuests} 人，且未設定加人費，請洽民宿`)
  }

  return { nights: nights.length, total, currency, perNight, extraGuestFee, warnings }
}
