import { NextRequest, NextResponse } from 'next/server'
import { getPosOwner } from '@/lib/pos/auth'
import { bumpMenuRevision } from '@/lib/pos/menu'
import { DEFAULT_MODIFIER_GROUPS } from '@/lib/pos/types'

export async function POST(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category_id, name, price_cents, store_id, barcode, modifiers, description } = await req.json()
  if (!category_id || !name?.trim()) return NextResponse.json({ error: 'category_id, name 必填' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('pos_items')
    .insert({
      owner_id: ctx.userId,
      category_id,
      name: name.trim(),
      description: description?.trim() ?? '',
      price_cents: price_cents ?? 0,
      store_id: store_id || null,
      barcode: barcode?.trim() || null,
      modifiers: modifiers ?? DEFAULT_MODIFIER_GROUPS,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const revision = await bumpMenuRevision(ctx.supabase, ctx.userId)
  return NextResponse.json({ item: data, revision })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...patch } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { data, error } = await ctx.supabase
    .from('pos_items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ctx.userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const revision = await bumpMenuRevision(ctx.supabase, ctx.userId)
  return NextResponse.json({ item: data, revision })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { error } = await ctx.supabase.from('pos_items').delete().eq('id', id).eq('owner_id', ctx.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const revision = await bumpMenuRevision(ctx.supabase, ctx.userId)
  return NextResponse.json({ ok: true, revision })
}
