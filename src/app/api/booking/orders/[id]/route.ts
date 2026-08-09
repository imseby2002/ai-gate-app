import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { clearDailyRecordForDeletedBooking } from '@/lib/booking/daily-sync'

// 訂單資料結構重整第三階段：訂單詳情頁改成「一張訂單、可整單處理」，旅客資訊、
// 付款方式等訂單層級欄位在這裡統一編輯。這些欄位在 bookings（房型明細）也各自
// 存了一份，是給還沒改成讀 booking_orders 的其他頁面（日曆、每日入住、報表…）
// 用的，所以編輯時要一併同步回同一張訂單下的每一筆房型明細，避免兩邊看到的資料兜不起來。
const ROOM_MIRROR_FIELDS = [
  'guest_name', 'guest_email', 'guest_phone', 'guest_gender', 'guest_birthday',
  'guest_id_number', 'guest_address', 'special_requests', 'notes',
  'deposit_amount', 'is_paid', 'payment_type', 'arrival_time',
] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patch = await req.json()

  const { data: order, error } = await supabase
    .from('booking_orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mirrorPatch: Record<string, unknown> = {}
  for (const key of ROOM_MIRROR_FIELDS) {
    if (key in patch) mirrorPatch[key] = patch[key]
  }
  if (Object.keys(mirrorPatch).length > 0) {
    await supabase.from('bookings').update(mirrorPatch).eq('order_id', id).eq('user_id', ctx.ownerId)
  }

  return NextResponse.json({ order })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: rooms } = await supabase
    .from('bookings')
    .select('id, property_id, guest_name, platform_booking_id, total_price, platform, check_in, status, deposit_amount, is_paid')
    .eq('order_id', id).eq('user_id', ctx.ownerId)

  // 刪除 booking_orders 這筆會 cascade 刪掉所有房型明細（見 migration 096），
  // 這裡另外把每一間房間佔用的每日入住記錄／房況清掉，跟單間刪除時的行為一致。
  const { error } = await supabase.from('booking_orders').delete().eq('id', id).eq('user_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const room of rooms ?? []) {
    await clearDailyRecordForDeletedBooking(supabase, ctx.ownerId, room)
  }

  return NextResponse.json({ ok: true })
}
