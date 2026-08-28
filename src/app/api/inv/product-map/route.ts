import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 列出所有 POS 成品（去重）＋目前對照的配方＋可選配方清單
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: pos }, { data: map }, { data: recipes }] = await Promise.all([
    supabase.from('inv_pos_sales').select('product_code, product_name').eq('owner_id', user.id),
    supabase.from('inv_product_map').select('product_code, recipe_id, kind').eq('owner_id', user.id),
    supabase.from('inv_recipes').select('id, name').eq('owner_id', user.id).order('name'),
  ])
  const mapByCode: Record<string, { recipe_id: string | null; kind: string }> = {}
  for (const m of map ?? []) mapByCode[m.product_code] = { recipe_id: m.recipe_id, kind: m.kind ?? '' }
  const seen = new Map<string, string>()
  for (const p of pos ?? []) if (!seen.has(p.product_code)) seen.set(p.product_code, p.product_name)
  const products = [...seen.entries()].map(([code, name]) => ({ product_code: code, product_name: name, recipe_id: mapByCode[code]?.recipe_id ?? null, kind: mapByCode[code]?.kind ?? '' }))
    .sort((a, b) => a.product_code.localeCompare(b.product_code))

  return NextResponse.json({ products, recipes: recipes ?? [] })
}

// 設定單一成品對照。body: { product_code, product_name, recipe_id|null }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const product_code = String(body.product_code ?? '').trim()
  if (!product_code) return NextResponse.json({ error: 'product_code required' }, { status: 400 })

  const KINDS = new Set(['', 'drink', 'topping', 'other'])
  const row: Record<string, unknown> = {
    owner_id: user.id, product_code,
    product_name: String(body.product_name ?? ''),
    recipe_id: body.recipe_id || null,
  }
  if (body.kind !== undefined) row.kind = KINDS.has(body.kind) ? body.kind : ''
  const { error } = await supabase.from('inv_product_map').upsert(row, { onConflict: 'owner_id,product_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
