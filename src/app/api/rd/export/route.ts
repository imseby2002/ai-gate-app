import { getUnitContext } from '@/lib/auth/unit-access'
import { NextResponse } from 'next/server'
import { buildXlsx, type XlsxCell } from '@/lib/hr/xlsx'

async function getAdminUser() {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 所有配方一起匯出（.xlsx）：每個配方一段（表頭＋原料＋合計）。
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const [{ data: recipes }, { data: items }] = await Promise.all([
    supabase.from('rd_recipes').select('id, name, cup_size, total_export, total_purchase, unit_cost_export, unit_cost_purchase, unit_label').eq('owner_id', user.id).order('name'),
    supabase.from('rd_recipe_items').select('recipe_id, sort, material_name, unit, qty, price_export, price_purchase, amount_export, amount_purchase').eq('owner_id', user.id).order('sort'),
  ])
  const byRecipe = new Map<string, typeof items>()
  for (const it of items ?? []) (byRecipe.get(it.recipe_id) ?? byRecipe.set(it.recipe_id, []).get(it.recipe_id)!).push(it)

  const rows: XlsxCell[][] = []
  for (const r of recipes ?? []) {
    rows.push([r.name, r.cup_size])
    rows.push(['原料', '單位', '用量', '出價', '進價', '出額', '進額'])
    for (const it of byRecipe.get(r.id) ?? []) rows.push([it.material_name, it.unit, it.qty, it.price_export, it.price_purchase, it.amount_export, it.amount_purchase])
    rows.push(['合計', '', '', '', '', r.total_export, r.total_purchase])
    if (r.unit_cost_export || r.unit_cost_purchase) rows.push([r.unit_label || '單位成本', '', '', '', '', r.unit_cost_export, r.unit_cost_purchase])
    rows.push([])
  }
  const buf = buildXlsx('研發配方', rows.length ? rows : [['尚無配方']])
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent('研發配方總表.xlsx')}"`,
    },
  })
}
