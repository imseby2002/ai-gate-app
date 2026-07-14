import { NextRequest, NextResponse } from 'next/server'
import { getPosOwner } from '@/lib/pos/auth'

export async function GET() {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ctx.supabase
    .from('pos_stores')
    .select('*, pos_terminals(id, name, device_key, last_sync_at, last_menu_revision)')
    .eq('owner_id', ctx.userId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stores: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, slug } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name 必填' }, { status: 400 })

  const storeSlug = (slug || name).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const { data: store, error } = await ctx.supabase
    .from('pos_stores')
    .insert({ owner_id: ctx.userId, name: name.trim(), slug: storeSlug || 'store' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: terminal, error: termErr } = await ctx.supabase
    .from('pos_terminals')
    .insert({ store_id: store.id, owner_id: ctx.userId, name: '櫃台' })
    .select('id, name, device_key, last_sync_at')
    .single()

  if (termErr) return NextResponse.json({ error: termErr.message }, { status: 500 })

  await ctx.supabase.from('pos_menu_meta').upsert({ owner_id: ctx.userId, revision: 1 })

  return NextResponse.json({ store, terminal })
}
