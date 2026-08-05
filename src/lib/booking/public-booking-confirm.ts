import { sendBookingNotification } from '@/lib/booking/notify'

// 把一筆待確認的官網訂房申請轉成正式訂單：admin 手動點「確認」與自動確認模式共用同一套邏輯，
// 確保不論哪個入口觸發，行為（建訂單／連結／優惠碼計次／寄信）完全一致。
export async function confirmPublicBooking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, hostUserId: string, publicBookingId: string,
): Promise<{ ok: true; booking_id: string; emailed: boolean; alreadyConverted?: boolean } | { ok: false; error: string }> {
  const { data: pb } = await supabase
    .from('public_bookings').select('*').eq('id', publicBookingId).eq('host_user_id', hostUserId).single()
  if (!pb) return { ok: false, error: '訂單不存在' }

  // 已轉過 → 冪等，不重複建立
  if (pb.converted_booking_id) {
    return { ok: true, booking_id: pb.converted_booking_id, emailed: false, alreadyConverted: true }
  }

  const { data: newBooking, error: insErr } = await supabase.from('bookings').insert({
    user_id: hostUserId,
    property_id: pb.property_id ?? null,
    platform: 'direct',
    guest_name: pb.guest_name,
    guest_email: pb.guest_email,
    guest_phone: pb.guest_phone ?? null,
    check_in: pb.check_in,
    check_out: pb.check_out,
    num_guests: pb.num_guests ?? 1,
    total_price: pb.total_price ?? null,
    status: 'confirmed',
    source: 'form',
    notes: pb.notes ?? null,
  }).select('id').single()

  if (insErr || !newBooking) return { ok: false, error: insErr?.message ?? '建立正式訂單失敗' }

  await supabase.from('public_bookings')
    .update({ status: 'confirmed', converted_booking_id: newBooking.id })
    .eq('id', publicBookingId).eq('host_user_id', hostUserId)

  if (pb.promo_code) {
    await supabase.rpc('increment_promo_use', { p_user_id: hostUserId, p_code: pb.promo_code })
  }

  const mail = await sendBookingNotification(supabase, hostUserId, newBooking.id, 'confirmation')

  return { ok: true, booking_id: newBooking.id, emailed: mail.ok }
}
