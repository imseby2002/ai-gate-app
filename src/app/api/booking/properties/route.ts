import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { getBookingEntitlements } from '@/lib/booking/entitlements'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', ctx.ownerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ properties: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, room_count = 1, max_guests = 2, base_price, extra_guest_fee, currency = 'TWD', amenities = [], images = [], name_aliases = [] } = body
  if (!name?.trim()) return NextResponse.json({ error: '房源名稱必填' }, { status: 400 })

  const [{ count: existingCount }, { propertyLimit }] = await Promise.all([
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('user_id', ctx.ownerId),
    getBookingEntitlements(supabase, ctx.ownerId),
  ])
  if ((existingCount ?? 0) >= propertyLimit) {
    return NextResponse.json({ error: `目前方案最多可建立 ${propertyLimit} 個房源，請升級方案或加購房源額度。` }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('properties')
    .insert({ user_id: ctx.ownerId, name, description, room_count, max_guests, base_price, extra_guest_fee: extra_guest_fee ?? null, currency, amenities, images, name_aliases, sort_order: existingCount ?? 0 })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ property: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('properties')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ property: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { error } = await supabase.from('properties').delete().eq('id', id).eq('user_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
