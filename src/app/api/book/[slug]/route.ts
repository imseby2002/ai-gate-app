import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin.from('bnb_profiles').select('*').eq('slug', slug).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: properties } = await admin
    .from('properties').select('*')
    .eq('user_id', profile.user_id).eq('status', 'active')

  return NextResponse.json({ profile, properties: properties ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin.from('bnb_profiles').select('user_id').eq('slug', slug).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { check_in, check_out, property_id, guest_name, guest_email, guest_phone,
          num_guests, promo_code, notes } = body

  if (!check_in || !check_out || !guest_name || !guest_email) {
    return NextResponse.json({ error: '請填寫必填欄位' }, { status: 400 })
  }

  // Check availability
  if (property_id) {
    const { data: conflicts } = await admin.from('public_bookings')
      .select('id').eq('property_id', property_id)
      .in('status', ['pending', 'confirmed'])
      .lt('check_in', check_out).gt('check_out', check_in)
    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: '該房型在所選日期已被預訂' }, { status: 409 })
    }
    // Also check main bookings table
    const { data: mainConflicts } = await admin.from('bookings')
      .select('id').eq('property_id', property_id)
      .in('status', ['pending', 'confirmed'])
      .lt('check_in', check_out).gt('check_out', check_in)
    if (mainConflicts && mainConflicts.length > 0) {
      return NextResponse.json({ error: '該房型在所選日期已被預訂' }, { status: 409 })
    }
  }

  // Calculate nights
  const nights = Math.max(1, Math.round(
    (new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000
  ))

  // Get pricing
  let totalPrice: number | null = null
  let promoDiscount: number | null = null
  if (property_id) {
    const { data: prop } = await admin.from('properties').select('base_price, extra_guest_fee, max_guests').eq('id', property_id).single()
    if (prop?.base_price) {
      const base = prop.base_price * nights
      const extra = (prop.extra_guest_fee ?? 0) * Math.max(0, num_guests - (prop.max_guests ?? 2)) * nights
      totalPrice = base + extra
    }
  }

  // Validate promo code
  if (promo_code && totalPrice) {
    const { data: promo } = await admin.from('promo_codes')
      .select('*').eq('user_id', profile.user_id).eq('code', promo_code.toUpperCase()).eq('enabled', true).single()
    if (promo) {
      const now = new Date().toISOString().slice(0, 10)
      const valid = (!promo.valid_from || promo.valid_from <= now)
        && (!promo.valid_to || promo.valid_to >= now)
        && (!promo.max_uses || promo.used_count < promo.max_uses)
        && nights >= (promo.min_nights ?? 1)
        && (!promo.min_amount || totalPrice >= promo.min_amount)
      if (valid) {
        promoDiscount = promo.type === 'percent'
          ? Math.round(totalPrice * promo.value / 100)
          : Math.min(promo.value, totalPrice)
        totalPrice = Math.max(0, totalPrice - promoDiscount)
        await admin.from('promo_codes').update({ used_count: promo.used_count + 1 }).eq('id', promo.id)
      }
    }
  }

  const { data: booking, error } = await admin.from('public_bookings').insert({
    host_user_id: profile.user_id,
    property_id: property_id || null,
    guest_name, guest_email,
    guest_phone: guest_phone || null,
    num_guests: num_guests ?? 1,
    check_in, check_out,
    total_price: totalPrice,
    promo_code: promo_code?.toUpperCase() || null,
    promo_discount: promoDiscount,
    notes: notes || null,
    status: 'pending',
    payment_method: 'on_arrival',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking })
}
