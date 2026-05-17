import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const property_id = req.nextUrl.searchParams.get('property_id')
  let q = supabase.from('ical_settings').select('*, properties(name)').eq('user_id', user.id).order('created_at')
  if (property_id) q = q.eq('property_id', property_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { property_id, platform, platform_name, ical_url, sync_interval = 60 } = await req.json()
  if (!ical_url?.trim()) return NextResponse.json({ error: 'iCal URL 必填' }, { status: 400 })
  if (!platform)         return NextResponse.json({ error: '平台必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('ical_settings')
    .insert({ user_id: user.id, property_id, platform, platform_name, ical_url, sync_interval })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ setting: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('ical_settings')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ setting: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('ical_settings').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
