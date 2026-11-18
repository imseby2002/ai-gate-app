import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { deduplicateBookings } from '@/lib/booking/dedup'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { property_id, from, to } = body

  const result = await deduplicateBookings(supabase, {
    userId: ctx.ownerId,
    propertyId: property_id,
    from,
    to,
  })

  return NextResponse.json({ ok: true, ...result })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const property_id = sp.get('property_id') ?? undefined
  const from = sp.get('from') ?? undefined
  const to = sp.get('to') ?? undefined

  const result = await deduplicateBookings(supabase, {
    userId: ctx.ownerId,
    propertyId: property_id,
    from,
    to,
  })

  return NextResponse.json({ ok: true, ...result })
}
