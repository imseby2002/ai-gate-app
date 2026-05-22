import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  let q = supabase.from('reviews').select('*, properties(name)').eq('user_id', user.id).order('review_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })

  const platform = sp.get('platform')
  const propertyId = sp.get('property_id')
  if (platform) q = q.eq('platform', platform)
  if (propertyId) q = q.eq('property_id', propertyId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviews: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('reviews').insert({
    user_id: user.id,
    booking_id:   body.booking_id   || null,
    property_id:  body.property_id  || null,
    platform:     body.platform     ?? 'manual',
    guest_name:   body.guest_name   ?? '',
    rating:       body.rating       ?? null,
    title:        body.title        || null,
    comment:      body.comment      || null,
    review_date:  body.review_date  || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['platform','guest_name','rating','title','comment','review_date','booking_id','property_id']) {
    if (k in fields) update[k] = fields[k] || (typeof fields[k] === 'number' ? fields[k] : null)
  }
  if ('reply' in fields) {
    update.reply = fields.reply || null
    update.replied_at = fields.reply ? new Date().toISOString() : null
  }

  const { data, error } = await supabase.from('reviews').update(update).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('reviews').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
