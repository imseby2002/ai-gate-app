import { NextRequest, NextResponse } from 'next/server'
import { marketingCompany } from '@/lib/marketing/company'

export async function GET() {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 1. 查詢已建立之產品行銷圖文庫
  const { data: products, error: prodErr } = await c.admin
    .from('mkt_product_profiles')
    .select('*')
    .eq('owner_id', c.ownerId)
    .order('created_at', { ascending: false })

  if (prodErr) {
    console.warn('mkt_product_profiles query warning:', prodErr.message)
  }

  // 2. 跨模組撈取研發配方 (inv_recipes) 與門市點單品項 (pos_items)，供行銷人員「一鍵匯入 / 補圖」
  const [recipesRes, posRes] = await Promise.all([
    c.admin.from('inv_recipes').select('id, name, note').eq('owner_id', c.ownerId).limit(200),
    c.admin.from('pos_items').select('id, name, price_cents, barcode, description, image_url').eq('owner_id', c.ownerId).limit(200),
  ])

  const existingNames = new Set((products ?? []).map(p => p.name.trim().toLowerCase()))

  const candidates: { source: 'pos' | 'recipe'; id: string; name: string; price: number; note: string; image_url?: string }[] = []

  for (const item of posRes.data ?? []) {
    if (!existingNames.has(item.name.trim().toLowerCase())) {
      candidates.push({
        source: 'pos',
        id: item.id,
        name: item.name,
        price: (item.price_cents || 0) / 100,
        note: item.description || '',
        image_url: item.image_url || '',
      })
      existingNames.add(item.name.trim().toLowerCase()) // 避免同名重複
    }
  }

  for (const r of recipesRes.data ?? []) {
    if (!existingNames.has(r.name.trim().toLowerCase())) {
      candidates.push({
        source: 'recipe',
        id: r.id,
        name: r.name,
        price: 0,
        note: r.note || '',
      })
      existingNames.add(r.name.trim().toLowerCase())
    }
  }

  return NextResponse.json({
    products: products ?? [],
    candidates,
  })
}

export async function POST(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim()
  if (!name) return NextResponse.json({ error: '商品名稱必填' }, { status: 400 })

  const images = Array.isArray(b.images) ? b.images.map(String).filter(Boolean) : []
  const tags = Array.isArray(b.tags) ? b.tags.map(String).filter(Boolean) : []

  const { data, error } = await c.admin
    .from('mkt_product_profiles')
    .insert({
      owner_id: c.ownerId,
      product_code: String(b.product_code ?? '').trim(),
      name,
      category: String(b.category ?? '一般').trim(),
      price: Number(b.price) || 0,
      images,
      slogan: String(b.slogan ?? '').trim(),
      description: String(b.description ?? '').trim(),
      flavor_notes: String(b.flavor_notes ?? '').trim(),
      tags,
      recipe_id: b.recipe_id || null,
      pos_item_id: b.pos_item_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, product: data })
}

export async function PUT(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const upd: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (b.name !== undefined) upd.name = String(b.name).trim()
  if (b.product_code !== undefined) upd.product_code = String(b.product_code).trim()
  if (b.category !== undefined) upd.category = String(b.category).trim()
  if (b.price !== undefined) upd.price = Number(b.price) || 0
  if (b.slogan !== undefined) upd.slogan = String(b.slogan).trim()
  if (b.description !== undefined) upd.description = String(b.description).trim()
  if (b.flavor_notes !== undefined) upd.flavor_notes = String(b.flavor_notes).trim()
  if (b.images !== undefined) upd.images = Array.isArray(b.images) ? b.images.map(String).filter(Boolean) : []
  if (b.tags !== undefined) upd.tags = Array.isArray(b.tags) ? b.tags.map(String).filter(Boolean) : []
  if (b.recipe_id !== undefined) upd.recipe_id = b.recipe_id || null
  if (b.pos_item_id !== undefined) upd.pos_item_id = b.pos_item_id || null

  const { data, error } = await c.admin
    .from('mkt_product_profiles')
    .update(upd)
    .eq('id', id)
    .eq('owner_id', c.ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, product: data })
}

export async function DELETE(req: NextRequest) {
  const c = await marketingCompany()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })

  const { error } = await c.admin
    .from('mkt_product_profiles')
    .delete()
    .eq('id', id)
    .eq('owner_id', c.ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
