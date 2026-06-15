import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBnbContext } from '@/lib/bnb/context'
import { encryptSecret } from '@/lib/crypto/secret'

const SAFE_COLS = 'id,email_address,imap_host,imap_port,imap_folder,cancel_folder,sync_enabled,last_synced_at,last_sync_count,last_sync_error,property_id'

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
  // 密碼存前加密；沒填就不寫入
  if (body.imap_password) body.imap_password = encryptSecret(body.imap_password)
  else delete body.imap_password
  const { data: setting, error } = await supabase
    .from('email_settings')
    .insert({ ...body, user_id: ctx.ownerId })
    .select(SAFE_COLS)
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
  // 密碼有填才更新並加密；留空＝沿用原密碼
  if (updates.imap_password) updates.imap_password = encryptSecret(updates.imap_password)
  else delete updates.imap_password
  const { data: setting, error } = await supabase
    .from('email_settings')
    .update(updates)
    .eq('id', id).eq('user_id', ctx.ownerId)
    .select(SAFE_COLS).single()

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
