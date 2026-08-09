import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { syncDailyRecordForBooking, clearDailyRecordForDeletedBooking } from '@/lib/booking/daily-sync'
import { findOrCreateOrder } from '@/lib/booking/orders'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const property_id = sp.get('property_id')
  const status      = sp.get('status')
  const from        = sp.get('from')  // YYYY-MM-DD
  const to          = sp.get('to')
  const limit       = Math.min(parseInt(sp.get('limit') ?? '100'), 500)

  let q = supabase
    .from('bookings')
    .select('*, properties(name)')
    .eq('user_id', ctx.ownerId)
    .order('check_in', { ascending: false })
    .limit(limit)

  if (property_id) q = q.eq('property_id', property_id)
  if (status)      q = q.eq('status', status)
  if (from)        q = q.gte('check_out', from)  // include bookings overlapping month start
  if (to)          q = q.lte('check_in', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    property_id, platform = 'manual', platform_booking_id,
    guest_name, guest_email, guest_phone,
    check_in, check_out, num_guests = 1,
    total_price, currency = 'TWD', status = 'confirmed',
    special_requests, notes, source = 'manual', extras = {},
  } = body

  if (!check_in || !check_out) return NextResponse.json({ error: '入住/退房日期必填' }, { status: 400 })

  // 同一 user_id+platform+platform_booking_id+property_id 有唯一限制（見 migration 090），
  // 取消過的訂單不會被刪除，只是 status 改 cancelled，所以「取消再重新輸入同一張訂單」
  // 會撞到這個唯一鍵。與其讓使用者看到原始的 DB 錯誤訊息，比對到既有的取消訂單就直接
  // 重新啟用；比對到「非取消」的既有訂單則視為真的重複，給清楚的錯誤訊息。
  let existingId: string | null = null
  if (platform_booking_id && property_id) {
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('user_id', ctx.ownerId)
      .eq('platform', platform)
      .eq('platform_booking_id', platform_booking_id)
      .eq('property_id', property_id)
      .maybeSingle()
    if (existing) {
      if (existing.status !== 'cancelled') {
        return NextResponse.json({ error: `訂單號碼 ${platform_booking_id} 已存在（此房型），請確認是否重複輸入` }, { status: 409 })
      }
      existingId = existing.id
    }
  }

  // 訂單資料結構重整第二階段：不管是不是多房型，每一筆房型明細都要掛在一張真正
  // 的訂單（booking_orders）下面，不能再只靠 platform_booking_id 軟性關聯。
  const orderId = await findOrCreateOrder(supabase, ctx.ownerId, platform, platform_booking_id || null, {
    guest_name, guest_email, guest_phone, currency, special_requests, notes, source,
  })

  const payload = {
    user_id: ctx.ownerId, order_id: orderId, property_id, platform, platform_booking_id,
    guest_name, guest_email, guest_phone,
    check_in, check_out, num_guests, total_price, currency,
    status, special_requests, notes, source, extras,
  }

  const { data, error } = existingId
    ? await supabase.from('bookings').update(payload).eq('id', existingId).select().single()
    : await supabase.from('bookings').insert(payload).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 新訂單當天的每日入住記錄若已存在且是空白，直接帶入，不用等使用者重新整理每日入住頁面
  if (data) await syncDailyRecordForBooking(supabase, ctx.ownerId, data)
  return NextResponse.json({ booking: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  // 修改前先取舊資料——若房型或入住日被改掉，才知道要清哪一筆舊的每日入住記錄
  const { data: before } = await supabase
    .from('bookings')
    .select('id, property_id, guest_name, platform_booking_id, total_price, platform, check_in, status, deposit_amount, is_paid')
    .eq('id', id).eq('user_id', ctx.ownerId).maybeSingle()

  const { data, error } = await supabase
    .from('bookings')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 訂單管理跟每日入住不論從哪一邊改，另一邊都要跟著同步
  if (data) await syncDailyRecordForBooking(supabase, ctx.ownerId, data, before)
  return NextResponse.json({ booking: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, property_id, guest_name, platform_booking_id, total_price, platform, check_in, status, deposit_amount, is_paid')
    .eq('id', id).eq('user_id', ctx.ownerId).maybeSingle()

  const { error } = await supabase.from('bookings').delete().eq('id', id).eq('user_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (booking) await clearDailyRecordForDeletedBooking(supabase, ctx.ownerId, booking)
  return NextResponse.json({ ok: true })
}
