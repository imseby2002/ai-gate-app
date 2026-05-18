import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabase
    .from('email_settings')
    .select('id,email_address,imap_host,imap_port,imap_folder,sync_enabled,last_synced_at,last_sync_count,last_sync_error,property_id,properties(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ settings: settings ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data: setting, error } = await supabase
    .from('email_settings')
    .insert({ ...body, user_id: user.id })
    .select('id,email_address,imap_host,imap_port,imap_folder,sync_enabled,last_synced_at,last_sync_count,last_sync_error,property_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ setting })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const { data: setting, error } = await supabase
    .from('email_settings')
    .update(updates)
    .eq('id', id).eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ setting })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await supabase.from('email_settings').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
