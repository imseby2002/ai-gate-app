import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabase
    .from('email_settings')
    .select('id,email_address,imap_host,imap_port,imap_folder,cancel_folder,sync_enabled,last_synced_at,last_sync_count,last_sync_error,property_id,properties(name)')
    .eq('user_id', ctx.ownerId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ settings: settings ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.property_id) body.property_id = null
  const { data: setting, error } = await supabase
    .from('email_settings')
    .insert({ ...body, user_id: ctx.ownerId })
    .select('id,email_address,imap_host,imap_port,imap_folder,cancel_folder,sync_enabled,last_synced_at,last_sync_count,last_sync_error,property_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ setting })
}

export async function PUT(req: Request) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  if (!updates.property_id) updates.property_id = null
  const { data: setting, error } = await supabase
    .from('email_settings')
    .update(updates)
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ setting })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await supabase.from('email_settings').delete().eq('id', id).eq('user_id', ctx.ownerId)
  return NextResponse.json({ ok: true })
}
