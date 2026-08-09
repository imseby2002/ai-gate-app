// 訂單資料結構重整第二階段：所有會建立/更新 bookings 資料列的地方，都要透過這個
// helper 先找到或建立對應的 booking_orders 父層，再把 order_id 掛到每一筆房型明細上。

interface OrderInfo {
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  guest_gender?: string | null
  guest_birthday?: string | null
  guest_id_number?: string | null
  guest_address?: string | null
  payment_type?: string | null
  arrival_time?: string | null
  currency?: string | null
  deposit_amount?: number | null
  is_paid?: boolean | null
  special_requests?: string | null
  notes?: string | null
  source?: string | null
  promo_code?: string | null
  promo_discount?: number | null
}

// 有單號時，先找同一位房東、同一平台、同一單號的既有訂單沿用（缺的欄位才補上，
// 已經有值的不覆蓋——多間房型明細各自分次寫入時，才不會互相蓋掉彼此帶來的細節）；
// 找不到、或本來就沒單號（如手動輸入），就新建一筆訂單。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findOrCreateOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, userId: string, platform: string, platformBookingId: string | null,
  info: OrderInfo,
): Promise<string> {
  if (platformBookingId) {
    const { data: existing } = await supabase
      .from('booking_orders')
      .select('*')
      .eq('user_id', userId).eq('platform', platform).eq('platform_booking_id', platformBookingId)
      .maybeSingle()
    if (existing) {
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(info)) {
        if (value != null && (existing as Record<string, unknown>)[key] == null) patch[key] = value
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from('booking_orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id)
      }
      return existing.id as string
    }
  }

  const { data: created, error } = await supabase
    .from('booking_orders')
    .insert({ user_id: userId, platform, platform_booking_id: platformBookingId, ...info })
    .select('id')
    .single()
  if (error) throw error
  return created.id as string
}
