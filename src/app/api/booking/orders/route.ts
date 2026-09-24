import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { findOrCreateOrder } from '@/lib/booking/orders'
import { syncDailyRecordForBooking } from '@/lib/booking/daily-sync'

interface RoomInput { property_id: string; num_guests?: number; total_price?: number | null; extra_beds?: number }

// POST — 一次建立一張訂單（可能包含多個房型）。取代原本「日曆加入訂單」對每個
// 房型各自呼叫一次 /api/booking/bookings 的作法——那樣建出來的多筆 bookings 只靠
// 使用者自己填的單號軟性關聯，沒填單號就完全連不起來。這裡先建（或沿用）一筆
// booking_orders，再把每個房型明細的 order_id 指過去，保證同一次送出的房型一定
// 屬於同一張訂單。
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    platform = 'manual', platform_booking_id,
    guest_name, guest_email, guest_phone,
    check_in, check_out, currency = 'TWD', status = 'confirmed',
    special_requests, notes, source = 'manual',
    rooms,
  } = body as {
    platform?: string; platform_booking_id?: string | null
    guest_name?: string; guest_email?: string; guest_phone?: string
    check_in?: string; check_out?: string; currency?: string; status?: string
    special_requests?: string; notes?: string; source?: string
    rooms?: RoomInput[]
  }

  if (!check_in || !check_out) return NextResponse.json({ error: '入住/退房日期必填' }, { status: 400 })
  if (!Array.isArray(rooms) || rooms.length === 0) return NextResponse.json({ error: '至少要選一個房型' }, { status: 400 })

  // 空字串要當成沒填單號，不能直接存成 ''——bookings 的唯一鍵（migration 140）
  // 只排除 platform_booking_id 為 null 的情況，'' 仍算「有值」，兩筆都留空單號的
  // 手動訂單會撞到同一把唯一鍵，讓使用者看到看不懂的原始 DB 錯誤。
  const pbid = (platform_booking_id ?? '').trim() || null

  // 跟單間房 POST 同一套規則（見 bookings/route.ts）：同單號（含都沒填單號）同房型
  // 如果已經有未取消的訂單，視為重複輸入直接擋下；是取消過的則之後直接重新啟用。
  // 要嘛全部房型都先驗證過一輪，不要寫到一半才發現某個房型重複。
  const existingIds: Record<number, string> = {}
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]
    if (!r.property_id) continue
    let q = supabase
      .from('bookings')
      .select('id, status')
      .eq('user_id', ctx.ownerId).eq('platform', platform).eq('property_id', r.property_id)
    q = pbid ? q.eq('platform_booking_id', pbid) : q.is('platform_booking_id', null)
    const { data: existing } = await q.maybeSingle()
    if (existing) {
      if (existing.status !== 'cancelled') {
        return NextResponse.json({
          error: pbid
            ? `訂單號碼 ${pbid} 已存在，請確認是否重複輸入`
            : '這個房型已經有一筆沒填訂單號碼的手動訂單了，請確認是否重複輸入，或幫其中一筆補上訂單號碼以便區分',
        }, { status: 409 })
      }
      existingIds[i] = existing.id
    }
  }

  const orderId = await findOrCreateOrder(supabase, ctx.ownerId, platform, pbid, {
    guest_name, guest_email, guest_phone, currency, special_requests, notes, source,
  })

  const created: unknown[] = []
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]
    const payload = {
      user_id: ctx.ownerId, order_id: orderId, property_id: r.property_id, platform, platform_booking_id: pbid,
      guest_name, guest_email, guest_phone,
      check_in, check_out, num_guests: r.num_guests ?? 1, total_price: r.total_price ?? null, currency,
      status, special_requests, notes, source,
      extra_beds: r.extra_beds ?? 0,
    }
    const { data, error } = existingIds[i]
      ? await supabase.from('bookings').update(payload).eq('id', existingIds[i]).select().single()
      : await supabase.from('bookings').insert(payload).select().single()
    if (error) return NextResponse.json({ error: error.message, order_id: orderId, bookings: created }, { status: 500 })
    created.push(data)
    await syncDailyRecordForBooking(supabase, ctx.ownerId, data)
  }

  return NextResponse.json({ order_id: orderId, bookings: created })
}
