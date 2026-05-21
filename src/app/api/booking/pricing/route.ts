import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const propertyId = searchParams.get('property_id')

  let query = supabase
    .from('room_date_settings')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  if (propertyId) query = query.eq('property_id', propertyId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { settings } = await req.json()
  if (!Array.isArray(settings) || settings.length === 0)
    return NextResponse.json({ error: 'settings 必填' }, { status: 400 })

  const rows = settings.map((s: {
    property_id: string; date: string; booking_status?: string
    price_override?: number | null; notes?: string
  }) => ({
    user_id: user.id,
    property_id: s.property_id,
    date: s.date,
    booking_status: s.booking_status ?? 'open',
    price_override: s.price_override ?? null,
    notes: s.notes ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('room_date_settings')
    .upsert(rows, { onConflict: 'user_id,property_id,date' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('property_id')
  const date = searchParams.get('date')

  if (!propertyId || !date)
    return NextResponse.json({ error: 'property_id and date required' }, { status: 400 })

  const { error } = await supabase
    .from('room_date_settings')
    .delete()
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .eq('date', date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
