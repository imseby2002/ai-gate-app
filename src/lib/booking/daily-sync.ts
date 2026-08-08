// 訂單管理（bookings）新增/修改/取消/刪除時，把結果同步寫回每日入住（bnb_daily_records），
// 讓兩邊不論從哪一邊輸入都會一致，不用等使用者重新整理每日入住頁面才觸發被動補填。
//
// 判斷「這筆 bookings 對應到哪一筆 bnb_daily_records」的規則，依序：
// 1. booking_id 直接對上（兩邊已經連結過，最準，跟單號/姓名有沒有被手動改過無關）。
// 2. 沒連結過時的軟比對（跟 daily/route.ts 的 PATCH 同步邏輯一致，避免猜錯房間）：
//    a. 有單號（platform_booking_id）：daily 記錄的 order_number 剛好等於這個單號才算。
//    b. daily 記錄本身是空白（沒單號也沒姓名）：可以安全帶入。
//    c. 沒單號、daily 記錄非空白：只有「這個房型當天」剛好只有這一筆有效訂單時才視為同一筆，
//       避免房型下有多間房、同天多筆訂單時誤連到別人的資料。
// 都不符合就完全不動（維持既有資料）；一旦透過軟比對連上，會順便補上 booking_id，
// 之後同一筆訂單的同步就會走第 1 條路徑，不用再猜。

interface BookingLike {
  id: string
  property_id: string | null
  guest_name: string | null
  platform_booking_id: string | null
  total_price: number | null
  platform: string | null
  check_in: string
  status: string
  deposit_amount?: number | null
  is_paid?: boolean | null
}

interface DailyRecordRow { id: string; order_number: string | null; guest_name: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findLinkedRecord(supabase: any, userId: string, booking: BookingLike): Promise<DailyRecordRow | null> {
  // 已經連結過：直接用 booking_id 精準對到當晚那一筆，不必再靠房型/單號猜。
  const { data: linked } = await supabase
    .from('bnb_daily_records')
    .select('id, order_number, guest_name')
    .eq('user_id', userId).eq('booking_id', booking.id).eq('date', booking.check_in)
    .maybeSingle()
  if (linked) return linked

  if (!booking.property_id) return null
  const { data: prop } = await supabase.from('properties').select('name').eq('id', booking.property_id).maybeSingle()
  if (!prop?.name) return null

  const { data: rec } = await supabase
    .from('bnb_daily_records')
    .select('id, order_number, guest_name')
    .eq('user_id', userId).eq('date', booking.check_in).eq('room_name', prop.name)
    .maybeSingle()
  if (!rec) return null

  if (booking.platform_booking_id) {
    return rec.order_number === booking.platform_booking_id ? rec : null
  }
  if (!rec.order_number && !rec.guest_name) return rec

  const { data: siblings } = await supabase
    .from('bookings').select('id')
    .eq('user_id', userId).eq('property_id', booking.property_id).eq('check_in', booking.check_in)
    .neq('status', 'cancelled')
    .limit(2)
  if (siblings?.length === 1 && siblings[0].id === booking.id) return rec
  return null
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
    if (previous && (previous.property_id !== booking.property_id || previous.check_in !== booking.check_in)) {
      const oldRec = await findLinkedRecord(supabase, userId, previous)
      if (oldRec) await clearRecord(supabase, oldRec.id)
    }

    const rec = await findLinkedRecord(supabase, userId, booking)
    if (!rec) return

    if (booking.status === 'cancelled') {
      await clearRecord(supabase, rec.id)
      return
    }

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
  } catch { /* 同步失敗不影響訂單本身的建立/修改 */ }
}

// 刪除訂單後呼叫，邏輯同取消。
export async function clearDailyRecordForDeletedBooking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, booking: BookingLike,
): Promise<void> {
  try {
    const rec = await findLinkedRecord(supabase, userId, booking)
    if (rec) await clearRecord(supabase, rec.id)
  } catch { /* 同步失敗不影響刪除本身 */ }
}
