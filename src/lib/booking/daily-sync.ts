// 訂單管理（bookings）新增/修改/取消/刪除時，把結果同步寫回每日入住（bnb_daily_records），
// 讓兩邊不論從哪一邊輸入都會一致，不用等使用者重新整理每日入住頁面才觸發被動補填。

interface BookingLike {
  id: string
  property_id: string | null
  guest_name: string | null
  platform_booking_id: string | null
  total_price: number | null
  platform: string | null
  check_in: string
  check_out?: string | null
  status: string
  deposit_amount?: number | null
  is_paid?: boolean | null
}

function getStayDates(checkIn: string, checkOut?: string | null): string[] {
  if (!checkIn) return []
  if (!checkOut || checkOut <= checkIn) return [checkIn]
  const dates: string[] = []
  const cur = new Date(checkIn + 'T00:00:00')
  const end = new Date(checkOut + 'T00:00:00')
  while (cur < end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return dates.length > 0 ? dates : [checkIn]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveLatestPasswords(supabase: any, userId: string, roomName: string, targetDate: string) {
  const { data: latestRoom } = await supabase
    .from('bnb_daily_records')
    .select('room_password')
    .eq('user_id', userId)
    .eq('room_name', roomName)
    .lte('date', targetDate)
    .not('room_password', 'is', null)
    .neq('room_password', '')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: latestGate } = await supabase
    .from('bnb_daily_records')
    .select('gate_password')
    .eq('user_id', userId)
    .lte('date', targetDate)
    .not('gate_password', 'is', null)
    .neq('gate_password', '')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    roomPassword: latestRoom?.room_password?.trim() || null,
    gatePassword: latestGate?.gate_password?.trim() || null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function clearRecord(supabase: any, recordId: string) {
  await supabase.from('bnb_daily_records').update({
    order_number: null, guest_name: null, price_total: null, platform: null,
    deposit: null, paid: false, booking_id: null,
    source: 'manual', updated_at: new Date().toISOString(),
  }).eq('id', recordId)
}

// 建立/更新/取消訂單後呼叫。previous 只在「更新」時提供——若房型或入住日改變，
// 要先把舊房型/日期上屬於這筆訂單的每日入住資料清掉，否則會留著搬家前的舊資料。
export async function syncDailyRecordForBooking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, booking: BookingLike, previous?: BookingLike | null,
): Promise<void> {
  try {
    const currentDates = getStayDates(booking.check_in, booking.check_out)
    const currentDateSet = new Set(currentDates)

    // 1. 若有舊資料且房型或日期異動，清空原本屬於這筆訂單但在新範圍外的 daily records
    if (previous) {
      const prevDates = getStayDates(previous.check_in, previous.check_out)
      const needClear = prevDates.filter(d => !currentDateSet.has(d) || previous.property_id !== booking.property_id)
      for (const d of needClear) {
        const { data: oldRec } = await supabase
          .from('bnb_daily_records')
          .select('id')
          .eq('user_id', userId)
          .eq('date', d)
          .eq('booking_id', booking.id)
          .maybeSingle()
        if (oldRec) await clearRecord(supabase, oldRec.id)
      }
    }

    // 2. 若訂單被取消，清空所有屬於該訂單的 daily records
    if (booking.status === 'cancelled') {
      for (const d of currentDates) {
        const { data: rec } = await supabase
          .from('bnb_daily_records')
          .select('id')
          .eq('user_id', userId)
          .eq('date', d)
          .eq('booking_id', booking.id)
          .maybeSingle()
        if (rec) await clearRecord(supabase, rec.id)
      }
      return
    }

    if (!booking.property_id) return
    const { data: prop } = await supabase.from('properties').select('name').eq('id', booking.property_id).maybeSingle()
    if (!prop?.name) return

    // 3. 針對每個入住夜晚，更新或建立 daily record（直接取代舊資料，確保房型資料與訂單同步）
    for (const d of currentDates) {
      const { data: rec } = await supabase
        .from('bnb_daily_records')
        .select('id, booking_id, room_password, gate_password')
        .eq('user_id', userId)
        .eq('date', d)
        .eq('room_name', prop.name)
        .maybeSingle()

      if (rec) {
        // 已有記錄：不論之前是空的、舊名字還是舊單號，直接以新訂單取代
        await supabase.from('bnb_daily_records').update({
          order_number: booking.platform_booking_id ?? null,
          guest_name: booking.guest_name ?? null,
          price_total: booking.total_price ?? null,
          platform: booking.platform ?? null,
          deposit: booking.deposit_amount ?? null,
          paid: booking.is_paid ?? false,
          booking_id: booking.id,
          source: 'booking',
          updated_at: new Date().toISOString(),
        }).eq('id', rec.id)
      } else {
        // 尚未建立當天記錄：繼承密碼並自動建立，填入訂單資料
        const pw = await resolveLatestPasswords(supabase, userId, prop.name, d)
        await supabase.from('bnb_daily_records').upsert({
          user_id: userId,
          date: d,
          room_name: prop.name,
          room_password: pw.roomPassword,
          gate_password: pw.gatePassword,
          order_number: booking.platform_booking_id ?? null,
          guest_name: booking.guest_name ?? null,
          price_total: booking.total_price ?? null,
          platform: booking.platform ?? null,
          deposit: booking.deposit_amount ?? null,
          paid: booking.is_paid ?? false,
          booking_id: booking.id,
          source: 'booking',
          sort_order: 999,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date,room_name' })
      }
    }
  } catch { /* 同步失敗不影響訂單本身的建立/修改 */ }
}

// 刪除訂單後呼叫，清空該訂單關聯的所有每日入住記錄
export async function clearDailyRecordForDeletedBooking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, booking: BookingLike,
): Promise<void> {
  try {
    const dates = getStayDates(booking.check_in, booking.check_out)
    for (const d of dates) {
      const { data: rec } = await supabase
        .from('bnb_daily_records')
        .select('id')
        .eq('user_id', userId)
        .eq('date', d)
        .eq('booking_id', booking.id)
        .maybeSingle()
      if (rec) await clearRecord(supabase, rec.id)
    }
  } catch { /* 同步失敗不影響刪除本身 */ }
}
