import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeStayPrice } from '@/lib/booking/pricing'

// 公開報價：依 Plan A（每日價 + 定價規則 + 加人費）即時試算，供前台顯示與 bot 引用。
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sp = new URL(req.url).searchParams
  const propertyId = sp.get('property_id')
  const checkIn = sp.get('check_in')
  const checkOut = sp.get('check_out')
  const guests = Math.max(1, Number(sp.get('num_guests')) || 1)
  if (!propertyId || !checkIn || !checkOut) return NextResponse.json({ quote: null })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('bnb_profiles').select('user_id').eq('slug', slug).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quote = await computeStayPrice(admin, profile.user_id, propertyId, checkIn, checkOut, guests)
  return NextResponse.json({ quote })
}
