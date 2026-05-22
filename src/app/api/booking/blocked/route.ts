import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const from = sp.get('from')
  const to   = sp.get('to')
  const property_id = sp.get('property_id')

  let q = supabase
    .from('blocked_dates')
    .select('*')
    .eq('user_id', user.id)
    .eq('reason', 'owner_block')

  if (from)        q = q.gte('date', from)
  if (to)          q = q.lte('date', to)
  if (property_id) q = q.eq('property_id', property_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blocked: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { property_id, dates } = await req.json()
  if (!property_id || !Array.isArray(dates) || dates.length === 0)
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const rows = dates.map((d: string) => ({
    user_id: user.id,
    property_id,
    date: d,
    reason: 'owner_block',
    platform: 'manual',
    ical_setting_id: null,
    booking_id: null,
  }))

  const { error } = await supabase
    .from('blocked_dates')
    .upsert(rows, { onConflict: 'user_id,property_id,date', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { property_id, dates } = await req.json()
  if (!property_id || !Array.isArray(dates) || dates.length === 0)
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })

  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('user_id', user.id)
    .eq('property_id', property_id)
    .eq('reason', 'owner_block')
    .in('date', dates)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
