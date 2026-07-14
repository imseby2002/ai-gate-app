import { NextRequest, NextResponse } from 'next/server'
import { getPosOwner } from '@/lib/pos/auth'
import { bumpMenuRevision } from '@/lib/pos/menu'

export async function POST(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, store_id, sort_order } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name 必填' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('pos_categories')
    .insert({
      owner_id: ctx.userId,
      name: name.trim(),
      store_id: store_id || null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const revision = await bumpMenuRevision(ctx.supabase, ctx.userId)
  return NextResponse.json({ category: data, revision })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...patch } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('pos_categories')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ctx.userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const revision = await bumpMenuRevision(ctx.supabase, ctx.userId)
  return NextResponse.json({ category: data, revision })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { error } = await ctx.supabase.from('pos_categories').delete().eq('id', id).eq('owner_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const revision = await bumpMenuRevision(ctx.supabase, ctx.userId)
  return NextResponse.json({ ok: true, revision })
}
