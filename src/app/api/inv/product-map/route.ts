import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

// 列出所有 POS 成品（去重）＋目前對照的配方＋可選配方清單
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: pos }, { data: map }, { data: recipes }] = await Promise.all([
    supabase.from('inv_pos_sales').select('product_code, product_name').eq('owner_id', user.id),
    supabase.from('inv_product_map').select('product_code, recipe_id').eq('owner_id', user.id),
    supabase.from('inv_recipes').select('id, name').eq('owner_id', user.id).order('name'),
  ])
  const mapByCode: Record<string, string | null> = {}
  for (const m of map ?? []) mapByCode[m.product_code] = m.recipe_id
  const seen = new Map<string, string>()
  for (const p of pos ?? []) if (!seen.has(p.product_code)) seen.set(p.product_code, p.product_name)
  const products = [...seen.entries()].map(([code, name]) => ({ product_code: code, product_name: name, recipe_id: mapByCode[code] ?? null }))
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

  const { error } = await supabase.from('inv_product_map').upsert({
    owner_id: user.id, product_code,
    product_name: String(body.product_name ?? ''),
    recipe_id: body.recipe_id || null,
  }, { onConflict: 'owner_id,product_code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
