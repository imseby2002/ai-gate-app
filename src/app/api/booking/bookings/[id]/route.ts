import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('bookings')
    .select('*, properties(id, name)')
    .eq('id', id)
    .eq('user_id', ctx.ownerId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // 訂單資料結構重整第三階段：訂單詳情頁改成真正的「一張訂單、多筆房型明細」，
  // 用 order_id 這個真正的外鍵去抓同一張訂單（booking_orders）跟底下全部房型
  // 明細，取代原本只靠 platform_booking_id 文字比對的軟性關聯。
  let order = null
  let rooms: unknown[] = []
  if (data.order_id) {
    const [{ data: ord }, { data: sib }] = await Promise.all([
      supabase.from('booking_orders').select('*').eq('id', data.order_id).eq('user_id', ctx.ownerId).maybeSingle(),
      supabase.from('bookings')
        .select('id, property_id, check_in, check_out, num_guests, total_price, currency, status, properties(id, name)')
        .eq('order_id', data.order_id).eq('user_id', ctx.ownerId)
        .order('check_in', { ascending: true }),
    ])
    order = ord
    rooms = sib ?? []
  }

  return NextResponse.json({ booking: data, order, rooms })
}
