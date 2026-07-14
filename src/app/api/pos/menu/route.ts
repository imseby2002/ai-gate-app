import { NextRequest, NextResponse } from 'next/server'
import { getPosOwner } from '@/lib/pos/auth'

/** 雲端編輯用：回傳全部菜單（含門市標記） */
export async function GET(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = new URL(req.url).searchParams.get('store_id')

  const [{ data: categories }, { data: items }, { data: meta }] = await Promise.all([
    ctx.supabase.from('pos_categories').select('*').eq('owner_id', ctx.userId).order('sort_order'),
    ctx.supabase.from('pos_items').select('*').eq('owner_id', ctx.userId).order('sort_order'),
    ctx.supabase.from('pos_menu_meta').select('revision').eq('owner_id', ctx.userId).maybeSingle(),
  ])

  const { data: stores } = await ctx.supabase
    .from('pos_stores')
    .select('id, name, slug')
    .eq('owner_id', ctx.userId)

  let filteredCategories = categories ?? []
  let filteredItems = items ?? []
  if (storeId) {
    filteredCategories = filteredCategories.filter(c => !c.store_id || c.store_id === storeId)
    const catIds = new Set(filteredCategories.map(c => c.id))
    filteredItems = filteredItems.filter(i => catIds.has(i.category_id) && (!i.store_id || i.store_id === storeId))
  }

  return NextResponse.json({
    revision: meta?.revision ?? 1,
    stores: stores ?? [],
    categories: filteredCategories,
    items: filteredItems,
  })
}
