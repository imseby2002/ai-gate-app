import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp   = req.nextUrl.searchParams
  const from = sp.get('from') ?? new Date().toISOString().slice(0, 10)
  const days = Math.min(parseInt(sp.get('days') ?? '21'), 60)

  const toDate = new Date(from)
  toDate.setDate(toDate.getDate() + days - 1)
  const to = toDate.toISOString().slice(0, 10)

  const [propsRes, bookingsRes, blockedRes] = await Promise.all([
    supabase.from('properties').select('id,name,room_count,base_price').eq('user_id', user.id).order('name'),
    supabase.from('bookings')
      .select('id,property_id,guest_name,guest_phone,check_in,check_out,status,total_price,platform')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .lte('check_in', to)
      .gte('check_out', from),
    supabase.from('blocked_dates')
      .select('property_id,date,reason')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to),
  ])

  if (propsRes.error)   return NextResponse.json({ error: propsRes.error.message },   { status: 500 })
  if (bookingsRes.error) return NextResponse.json({ error: bookingsRes.error.message }, { status: 500 })

  return NextResponse.json({
    from,
    days,
    properties: propsRes.data  ?? [],
    bookings:   bookingsRes.data ?? [],
    blocked:    blockedRes.data  ?? [],
  })
}
