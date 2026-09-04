import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }

// 清單（?id= 取單一含明細）
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const id = s(new URL(req.url).searchParams.get('id'))
  if (id) {
    const { data: recipe } = await supabase.from('rd_recipes').select('*').eq('id', id).eq('owner_id', user.id).single()
    if (!recipe) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const { data: items } = await supabase.from('rd_recipe_items').select('*').eq('recipe_id', id).eq('owner_id', user.id).order('sort')
    return NextResponse.json({ recipe, items: items ?? [] })
  }
  const { data } = await supabase.from('rd_recipes')
    .select('id, name, cup_size, category, total_export, total_purchase, unit_cost_export, unit_cost_purchase, source')
    .eq('owner_id', user.id).order('name')
  return NextResponse.json({ recipes: data ?? [] })
}

// 單一配方輸入／編輯。body: { id?, name, cup_size?, category?, note?, items:[{material_name,unit,qty,price_export,price_purchase}] }
export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const b = await req.json().catch(() => ({}))
  const name = s(b.name)
  if (!name) return NextResponse.json({ error: '配方名稱必填' }, { status: 400 })
  const items = (Array.isArray(b.items) ? b.items : []).map((it: Record<string, unknown>, i: number) => {
    const qty = num(it.qty), px = num(it.price_export), pn = num(it.price_purchase)
    return {
      owner_id: user.id, sort: i, material_name: s(it.material_name), unit: s(it.unit), qty,
      price_export: px, price_purchase: pn, amount_export: qty * px, amount_purchase: qty * pn,
    }
  }).filter((it: { material_name: string }) => it.material_name)
  const total_export = items.reduce((sum: number, it: { amount_export: number }) => sum + it.amount_export, 0)
  const total_purchase = items.reduce((sum: number, it: { amount_purchase: number }) => sum + it.amount_purchase, 0)

  const head = {
    owner_id: user.id, name, cup_size: s(b.cup_size), category: s(b.category), note: s(b.note),
    total_export, total_purchase, source: 'manual', updated_at: new Date().toISOString(),
  }
  const id = s(b.id)
  let recipeId = id
  if (id) {
    const { error } = await supabase.from('rd_recipes').update(head).eq('id', id).eq('owner_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await supabase.from('rd_recipe_items').delete().eq('recipe_id', id).eq('owner_id', user.id)
  } else {
    const { data, error } = await supabase.from('rd_recipes').upsert(head, { onConflict: 'owner_id,name' }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    recipeId = data.id
    await supabase.from('rd_recipe_items').delete().eq('recipe_id', recipeId).eq('owner_id', user.id)
  }
  if (items.length) await supabase.from('rd_recipe_items').insert(items.map((it: object) => ({ ...it, recipe_id: recipeId })))
  return NextResponse.json({ id: recipeId })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('rd_recipes').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
