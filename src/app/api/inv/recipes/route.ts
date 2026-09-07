import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['rd', 'store', 'audit'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

type ItemIn = {
  material_code?: string
  material_name?: string
  qty_per_cup?: number
  unit?: string
  purchase_price?: number
  export_price?: number
}

const cleanItems = (raw: unknown, ownerId: string, recipeId: string) =>
  (Array.isArray(raw) ? raw : []).map((r: ItemIn) => ({
    recipe_id: recipeId,
    owner_id: ownerId,
    material_code: String(r.material_code ?? '').trim(),
    material_name: String(r.material_name ?? '').trim(),
    qty_per_cup: Number(r.qty_per_cup) || 0,
  })).filter(i => i.material_code)

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: recipes }, { data: items }, { data: mats }, { data: prices }] = await Promise.all([
    supabase.from('inv_recipes').select('id, name, note, created_at').eq('owner_id', user.id).order('name'),
    supabase.from('inv_recipe_items').select('id, recipe_id, material_code, material_name, qty_per_cup').eq('owner_id', user.id),
    supabase.from('inv_movements').select('material_code, material_name, unit').eq('owner_id', user.id),
    supabase.from('inv_material_prices').select('material_code, material_name, unit, export_price, purchase_price, updated_at').eq('owner_id', user.id),
  ])

  // 原料成本查找表（進價 ĐGN、出價 ĐGX）
  const priceMap = new Map<string, { material_name: string; unit: string; export_price: number; purchase_price: number }>()
  for (const p of prices ?? []) {
    priceMap.set(p.material_code, {
      material_name: p.material_name,
      unit: p.unit,
      export_price: Number(p.export_price) || 0,
      purchase_price: Number(p.purchase_price) || 0,
    })
  }

  // 整理原料去重清單（供配方挑選，結合進銷存與標準價表）
  const matMap = new Map<string, { code: string; name: string; unit: string; purchase_price: number; export_price: number }>()
  for (const m of mats ?? []) {
    const pr = priceMap.get(m.material_code)
    matMap.set(m.material_code, {
      code: m.material_code,
      name: m.material_name,
      unit: m.unit,
      purchase_price: pr?.purchase_price ?? 0,
      export_price: pr?.export_price ?? 0,
    })
  }
  for (const p of prices ?? []) {
    if (!matMap.has(p.material_code)) {
      matMap.set(p.material_code, {
        code: p.material_code,
        name: p.material_name,
        unit: p.unit,
        purchase_price: Number(p.purchase_price) || 0,
        export_price: Number(p.export_price) || 0,
      })
    }
  }

  // 彙整每道配方的原料明細與成本計算
  const byRecipe: Record<string, any[]> = {}
  for (const it of items ?? []) {
    const p = priceMap.get(it.material_code)
    const purchase_price = p?.purchase_price ?? 0
    const export_price = p?.export_price ?? 0
    const qty = Number(it.qty_per_cup) || 0
    const item_cost = Math.round(qty * purchase_price * 100) / 100
    const item_export = Math.round(qty * export_price * 100) / 100
    ;(byRecipe[it.recipe_id] ??= []).push({
      ...it,
      unit: p?.unit || '',
      purchase_price,
      export_price,
      item_cost,
      item_export,
    })
  }

  const withItems = (recipes ?? []).map(r => {
    const rItems = byRecipe[r.id] ?? []
    const total_cost = rItems.reduce((sum, i) => sum + (i.item_cost || 0), 0)
    const total_export = rItems.reduce((sum, i) => sum + (i.item_export || 0), 0)
    return {
      ...r,
      items: rItems,
      total_cost: Math.round(total_cost * 100) / 100,
      total_export: Math.round(total_export * 100) / 100,
    }
  })

  return NextResponse.json({
    recipes: withItems,
    materials: [...matMap.values()].sort((a, b) => a.code.localeCompare(b.code)),
    prices: prices ?? [],
  })
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

  // 同步更新自訂原料單價至原料成本庫
  if (Array.isArray(body.items)) {
    const priceUpserts = body.items
      .filter((it: any) => it.material_code && (Number(it.purchase_price) > 0 || Number(it.export_price) > 0))
      .map((it: any) => ({
        owner_id: user.id,
        material_code: String(it.material_code).trim(),
        material_name: String(it.material_name ?? it.material_code).trim(),
        unit: String(it.unit ?? '').trim(),
        purchase_price: Number(it.purchase_price) || 0,
        export_price: Number(it.export_price) || 0,
        updated_at: new Date().toISOString(),
      }))
    if (priceUpserts.length) {
      await supabase.from('inv_material_prices').upsert(priceUpserts, { onConflict: 'owner_id,material_code' })
    }
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

    // 同步更新自訂原料單價至原料成本庫
    if (Array.isArray(body.items)) {
      const priceUpserts = body.items
        .filter((it: any) => it.material_code && (Number(it.purchase_price) > 0 || Number(it.export_price) > 0))
        .map((it: any) => ({
          owner_id: user.id,
          material_code: String(it.material_code).trim(),
          material_name: String(it.material_name ?? it.material_code).trim(),
          unit: String(it.unit ?? '').trim(),
          purchase_price: Number(it.purchase_price) || 0,
          export_price: Number(it.export_price) || 0,
          updated_at: new Date().toISOString(),
        }))
      if (priceUpserts.length) {
        await supabase.from('inv_material_prices').upsert(priceUpserts, { onConflict: 'owner_id,material_code' })
      }
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
