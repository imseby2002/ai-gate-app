/**
 * R&D Lab 自動帶入 /rd 配方表（inv_recipes / inv_recipe_items / inv_material_prices）。
 * 直接讀取，不另存副本：/rd 新增或修改配方，Lab 立即同步。
 * 成本與 /rd 相同：每杯門市成本 = Σ 每杯用量 × 直營門市出貨價（export_price）。
 */
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

interface InvRecipe { id: string; name: string; note: string | null; kind: string | null; cup_size: string | null; created_at: string; hidden?: boolean }
interface InvItem { recipe_id: string; material_code: string; material_name: string; qty_per_cup: number; qty_display: number | null; unit_display: string | null; sort: number | null }
interface InvPrice { material_code: string; material_name: string; unit: string | null; export_price: number | null; category: string | null; updated_at: string | null }

// PostgREST 單次上限 1000 筆：先取總數，再平行抓各頁（配方明細上萬筆，逐頁抓太慢）
async function fetchAll<T>(admin: Admin, table: string, cols: string, ownerId: string, order: string): Promise<T[]> {
  const { count, error: countErr } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('owner_id', ownerId)
  if (countErr) throw new Error(`${table}: ${countErr.message}`)
  const pages = Math.ceil((count ?? 0) / 1000)
  const results = await Promise.all(Array.from({ length: pages }, (_, i) => {
    let q = admin.from(table).select(cols).eq('owner_id', ownerId).order(order)
    if (order !== 'id') q = q.order('id') // 排序需唯一，分頁才不會重複或漏筆
    return q.range(i * 1000, i * 1000 + 999)
  }))
  const out: T[] = []
  for (const { data, error } of results) {
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
  }
  return out
}

/** 「Cốc 700cc」「cốc 450cc」→ 700／450；無法解析回 null */
function cupMl(cup: string | null): number | null {
  const m = (cup ?? '').match(/(\d+(?:[.,]\d+)?)\s*(cc|ml)/i)
  return m ? Number(m[1].replace(',', '.')) : null
}

export async function loadInvRecipesForLab(admin: Admin, ownerId: string) {
  const [recipes, items, prices] = await Promise.all([
    fetchAll<InvRecipe>(admin, 'inv_recipes', 'id, name, note, kind, cup_size, created_at, hidden', ownerId, 'name'),
    fetchAll<InvItem>(admin, 'inv_recipe_items', 'recipe_id, material_code, material_name, qty_per_cup, qty_display, unit_display, sort', ownerId, 'id'),
    fetchAll<InvPrice>(admin, 'inv_material_prices', 'material_code, material_name, unit, export_price, category, updated_at', ownerId, 'material_code'),
  ])

  const priceMap = new Map(prices.map(p => [p.material_code, p]))
  const itemsByRecipe = new Map<string, InvItem[]>()
  for (const it of items) itemsByRecipe.set(it.recipe_id, [...(itemsByRecipe.get(it.recipe_id) ?? []), it])

  // 已隱藏的配方不帶入 R&D Lab
  const labRecipes = recipes.filter(r => !r.hidden).map(r => {
    const rows = (itemsByRecipe.get(r.id) ?? []).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    const ingredients = rows.map((it, i) => {
      const pr = priceMap.get(it.material_code)
      const unitPrice = Number(pr?.export_price) || 0
      const qty = Number(it.qty_per_cup) || 0
      return {
        id: `inv-${r.id}-${i}`,
        name: it.material_name || pr?.material_name || it.material_code,
        code: it.material_code,
        category: pr?.category || '原料',
        qty_g: it.qty_display ?? qty,
        unit: it.unit_display || pr?.unit || '',
        ratio_pct: null,
        brix: null,
        cost_per_unit: unitPrice,
        cost_raw: qty * unitPrice,
        cost_amount: Math.round(qty * unitPrice),
        sort_order: i,
      }
    })
    return {
      id: `inv-${r.id}`,
      source: 'inv' as const,
      name: r.name,
      code: (r.note ?? '').match(/GT#\d+/)?.[0] ?? '',
      note: r.note ?? '',
      category: r.kind || 'drink',
      cup_size_ml: cupMl(r.cup_size),
      cup_size_label: r.cup_size ?? '',
      version: null,
      is_current_active: false,
      status: 'production',
      total_weight_g: null,
      estimated_brix: null,
      sugar_per_100ml: null,
      cogs_amount: Math.round(ingredients.reduce((s, x) => s + x.cost_raw, 0)),
      target_price: null,
      gross_margin_pct: null,
      rd_recipe_ingredients: ingredients,
      updated_at: r.created_at,
    }
  })

  const labIngredients = prices.map(p => ({
    id: `inv-${p.material_code}`,
    source: 'inv' as const,
    code: p.material_code,
    name: p.material_name,
    category: p.category || '原料',
    unit: p.unit ?? '',
    supplier_name: '',
    cost_per_kg: Number(p.export_price) || 0,
    brix: null, ph: null, shelf_life_days: null,
    aroma: null, body: null, aftertaste: null, astringency: null, bitterness: null,
    sensory_notes: '',
  }))

  return { recipes: labRecipes, ingredients: labIngredients }
}
