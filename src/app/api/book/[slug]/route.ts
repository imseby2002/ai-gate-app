import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

// Fixed-window rate check via the shared DB RPC. Fails open on error.
async function rateOk(admin: Admin, bucket: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('check_cs_rate_limit', {
      p_bucket: bucket, p_limit: limit, p_window_seconds: windowSec,
    })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}

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

  // Public, unauthenticated endpoint → rate limit per IP and per host (slug),
  // so it can't be used to flood pending bookings (inventory lockout) or abuse promos.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  const [okIp, okSlug] = await Promise.all([
    rateOk(admin, `book:ip:${ip}`, 10, 60),
    rateOk(admin, `book:slug:${slug}`, 60, 60),
  ])
  if (!okIp || !okSlug) {
    return NextResponse.json({ error: '請求過於頻繁，請稍後再試' }, { status: 429 })
  }

  const { data: profile } = await admin.from('bnb_profiles').select('user_id').eq('slug', slug).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { check_in, check_out, property_id, guest_name, guest_email, guest_phone,
          num_guests, promo_code, notes } = body

  if (!check_in || !check_out || !guest_name || !guest_email) {
    return NextResponse.json({ error: '請填寫必填欄位' }, { status: 400 })
  }
  if (new Date(check_out) <= new Date(check_in)) {
    return NextResponse.json({ error: '退房日期必須晚於入住日期' }, { status: 400 })
  }

  const guests = Number(num_guests) > 0 ? Number(num_guests) : 1
  const nights = Math.max(1, Math.round(
    (new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000
  ))

  // Pricing (server-side; never trust a client-supplied total)
  let totalPrice: number | null = null
  let promoDiscount: number | null = null
  if (property_id) {
    const { data: prop } = await admin.from('properties').select('base_price, extra_guest_fee, max_guests').eq('id', property_id).single()
    if (prop?.base_price) {
      const base = prop.base_price * nights
      const extra = (prop.extra_guest_fee ?? 0) * Math.max(0, guests - (prop.max_guests ?? 2)) * nights
      totalPrice = base + extra
    }
  }

  // Validate promo (server-side). used_count is incremented only when the host
  // CONFIRMS the booking (see public-bookings PUT), so spamming pending bookings
  // can no longer exhaust a promo code.
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
      }
    }
  }

  // Atomic availability-check + insert (advisory-locked per property → no double booking)
  const { data: booking, error } = await admin.rpc('create_public_booking', {
    p_host_user_id: profile.user_id,
    p_property_id: property_id || null,
    p_check_in: check_in,
    p_check_out: check_out,
    p_guest_name: guest_name,
    p_guest_email: guest_email,
    p_guest_phone: guest_phone || null,
    p_num_guests: guests,
    p_total_price: totalPrice,
    p_promo_code: promo_code?.toUpperCase() || null,
    p_promo_discount: promoDiscount,
    p_notes: notes || null,
  })

  if (error) {
    if (error.message?.includes('DATE_CONFLICT')) {
      return NextResponse.json({ error: '該房型在所選日期已被預訂' }, { status: 409 })
    }
    if (error.message?.includes('INVALID_DATES')) {
      return NextResponse.json({ error: '日期區間不正確' }, { status: 400 })
    }
    return NextResponse.json({ error: '訂房失敗，請稍後再試' }, { status: 500 })
  }

  return NextResponse.json({ booking })
}
