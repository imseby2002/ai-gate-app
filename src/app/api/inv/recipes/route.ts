import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

type ItemIn = { material_code?: string; material_name?: string; qty_per_cup?: number }
const cleanItems = (raw: unknown, ownerId: string, recipeId: string) =>
  (Array.isArray(raw) ? raw : []).map((r: ItemIn) => ({
    recipe_id: recipeId, owner_id: ownerId,
    material_code: String(r.material_code ?? '').trim(),
    material_name: String(r.material_name ?? '').trim(),
    qty_per_cup: Number(r.qty_per_cup) || 0,
  })).filter(i => i.material_code)

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: recipes }, { data: items }, { data: mats }] = await Promise.all([
    supabase.from('inv_recipes').select('id, name, note, created_at').eq('owner_id', user.id).order('name'),
    supabase.from('inv_recipe_items').select('id, recipe_id, material_code, material_name, qty_per_cup').eq('owner_id', user.id),
    supabase.from('inv_movements').select('material_code, material_name, unit').eq('owner_id', user.id),
  ])
  const byRecipe: Record<string, unknown[]> = {}
  for (const it of items ?? []) (byRecipe[it.recipe_id] ??= []).push(it)
  const withItems = (recipes ?? []).map(r => ({ ...r, items: byRecipe[r.id] ?? [] }))

  // 去重原料清單（供配方挑選）
  const matMap = new Map<string, { code: string; name: string; unit: string }>()
  for (const m of mats ?? []) if (!matMap.has(m.material_code)) matMap.set(m.material_code, { code: m.material_code, name: m.material_name, unit: m.unit })

  return NextResponse.json({ recipes: withItems, materials: [...matMap.values()].sort((a, b) => a.code.localeCompare(b.code)) })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: '配方名稱必填' }, { status: 400 })

  const { data: recipe, error } = await supabase.from('inv_recipes')
    .insert({ owner_id: user.id, name, note: String(body.note ?? '') }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = cleanItems(body.items, user.id, recipe.id)
  if (items.length) {
    const { error: e2 } = await supabase.from('inv_recipe_items').insert(items)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }
  return NextResponse.json({ id: recipe.id })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const upd: Record<string, unknown> = {}
  if (body.name !== undefined) upd.name = String(body.name).trim()
  if (body.note !== undefined) upd.note = String(body.note)
  if (Object.keys(upd).length) {
    const { error } = await supabase.from('inv_recipes').update(upd).eq('id', id).eq('owner_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (body.items !== undefined) {
    await supabase.from('inv_recipe_items').delete().eq('recipe_id', id).eq('owner_id', user.id)
    const items = cleanItems(body.items, user.id, id)
    if (items.length) {
      const { error } = await supabase.from('inv_recipe_items').insert(items)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('inv_recipes').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
