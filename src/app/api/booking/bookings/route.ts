import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const property_id = sp.get('property_id')
  const status      = sp.get('status')
  const from        = sp.get('from')  // YYYY-MM-DD
  const to          = sp.get('to')
  const limit       = Math.min(parseInt(sp.get('limit') ?? '100'), 500)

  let q = supabase
    .from('bookings')
    .select('*, properties(name)')
    .eq('user_id', user.id)
    .order('check_in', { ascending: false })
    .limit(limit)

  if (property_id) q = q.eq('property_id', property_id)
  if (status)      q = q.eq('status', status)
  if (from)        q = q.gte('check_in', from)
  if (to)          q = q.lte('check_in', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    property_id, platform = 'manual', platform_booking_id,
    guest_name, guest_email, guest_phone,
    check_in, check_out, num_guests = 1,
    total_price, currency = 'TWD', status = 'confirmed',
    special_requests, notes, source = 'manual',
  } = body

  if (!check_in || !check_out) return NextResponse.json({ error: '入住/退房日期必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: user.id, property_id, platform, platform_booking_id,
      guest_name, guest_email, guest_phone,
      check_in, check_out, num_guests, total_price, currency,
      status, special_requests, notes, source,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('bookings')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('bookings').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
