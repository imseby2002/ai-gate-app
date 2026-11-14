import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { computeStayPrice } from '@/lib/booking/pricing'

// 後台試算：依 Plan A（每日價 + 定價規則 + 加人／加床費）算出住宿總價，
// 供日曆「快速加入訂單」自動帶入含週末／假日加價的實際金額。
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const propertyId = sp.get('property_id')
  const checkIn = sp.get('check_in')
  const checkOut = sp.get('check_out')
  const guests = Math.max(1, Number(sp.get('num_guests')) || 1)
  const extraBeds = Math.max(0, Number(sp.get('extra_beds')) || 0)
  if (!propertyId || !checkIn || !checkOut) return NextResponse.json({ quote: null })

  const quote = await computeStayPrice(supabase, ctx.ownerId, propertyId, checkIn, checkOut, guests, extraBeds)
  return NextResponse.json({ quote })
}
