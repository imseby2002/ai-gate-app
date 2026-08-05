import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { syncDailyRecordForBooking, clearDailyRecordForDeletedBooking } from '@/lib/booking/daily-sync'

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

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: ctx.ownerId, property_id, platform, platform_booking_id,
      guest_name, guest_email, guest_phone,
      check_in, check_out, num_guests, total_price, currency,
      status, special_requests, notes, source, extras,
    })
    .select().single()

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
