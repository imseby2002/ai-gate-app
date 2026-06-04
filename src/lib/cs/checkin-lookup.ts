// 依訂單號碼從「訂單系統」(bnb_daily_records → bookings) 查今日入住資訊與門鎖密碼。
// cs-chat 沙盒與 cs-webhook 生產共用。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryBnbCheckin(supabase: any, userId: string, orderNum: string): Promise<string | null> {
  const todayDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })

  // 優先：直接從 daily_records 的 order_number 欄位比對
  const { data: rec } = await supabase
    .from('bnb_daily_records')
    .select('room_name, room_password, gate_password, guest_name')
    .eq('user_id', userId)
    .eq('date', todayDate)
    .eq('order_number', orderNum)
    .maybeSingle()

  if (rec) {
    const lines = [
      `【入住資訊查詢結果】`,
      `找到訂單「${orderNum}」的今日入住資訊：`,
      rec.guest_name ? `旅客姓名：${rec.guest_name}` : null,
      rec.room_name  ? `房間：${rec.room_name}` : null,
      rec.room_password ? `房門密碼：${rec.room_password}` : `房門密碼：（尚未設定，請聯繫工作人員）`,
      rec.gate_password ? `大門密碼：${rec.gate_password}` : `大門密碼：（尚未設定，請聯繫工作人員）`,
      `（以上為系統即時資料，請直接引用，禁止修改或捏造）`,
    ].filter(Boolean).join('\n')
    return lines
  }

  // 備用：從 bookings 查訂單，再交叉查 daily_records
  const { data: booking } = await supabase
    .from('bookings')
    .select('property_id, guest_name, check_in, check_out')
    .eq('user_id', userId)
    .eq('platform_booking_id', orderNum)
    .maybeSingle()

  if (!booking) return null

  const lines: string[] = [
    `【入住資訊查詢結果】`,
    `找到訂單「${orderNum}」：`,
    booking.guest_name ? `旅客姓名：${booking.guest_name}` : null,
    `入住：${booking.check_in}　退房：${booking.check_out}`,
  ].filter(Boolean) as string[]

  if (booking.property_id) {
    const { data: prop } = await supabase.from('properties').select('name').eq('id', booking.property_id).maybeSingle()
    if (prop?.name) {
      lines.push(`房間：${prop.name}`)
      const { data: daily } = await supabase
        .from('bnb_daily_records')
        .select('room_password, gate_password')
        .eq('user_id', userId)
        .eq('date', todayDate)
        .eq('room_name', prop.name)
        .maybeSingle()
      lines.push(daily?.room_password ? `房門密碼：${daily.room_password}` : `房門密碼：（尚未設定，請聯繫工作人員）`)
      lines.push(daily?.gate_password ? `大門密碼：${daily.gate_password}` : `大門密碼：（尚未設定，請聯繫工作人員）`)
    }
  } else {
    lines.push(`（房間密碼請聯繫工作人員確認，訂單尚未對應房型）`)
  }

  lines.push(`（以上為系統即時資料，請直接引用，禁止修改或捏造）`)
  return lines.join('\n')
}
