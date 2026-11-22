// GET：列出本帳號已配對的讀後台連接器裝置；DELETE：撤銷指定裝置。
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBnbContext } from '@/lib/bnb/context'

export async function GET() {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await createAdminClient()
    .from('marketing_connector_devices')
    .select('id, name, last_seen_at, revoked_at, created_at')
    .eq('user_id', ctx.ownerId)
    .order('created_at', { ascending: false })
  return NextResponse.json({ devices: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const ctx = await getBnbContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canSettings) return NextResponse.json({ error: '只有擁有者或管理員可撤銷裝置' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('marketing_connector_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', ctx.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
