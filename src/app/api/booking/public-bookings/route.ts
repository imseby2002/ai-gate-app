import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('public_bookings').select('*, properties(name)')
    .eq('host_user_id', user.id).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bookings: data ?? [] })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = await req.json()

  // Detect a first-time transition into 'confirmed' so we count the promo exactly once
  const { data: existing } = await supabase.from('public_bookings')
    .select('status, promo_code').eq('id', id).eq('host_user_id', user.id).single()

  const { data, error } = await supabase.from('public_bookings')
    .update({ status }).eq('id', id).eq('host_user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'confirmed' && existing && existing.status !== 'confirmed' && existing.promo_code) {
    await supabase.rpc('increment_promo_use', { p_user_id: user.id, p_code: existing.promo_code })
  }

  return NextResponse.json({ booking: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('public_bookings').delete().eq('id', id).eq('host_user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
