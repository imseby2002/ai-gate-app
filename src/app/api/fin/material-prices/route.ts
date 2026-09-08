// 出納物料定價 API：原料、設備、道具、耗材 之三層定價管理
// 1. purchase_price: 工廠進貨價 (Factory Cost)
// 2. export_price: 賣給直營門市價格 (Direct Store Price —— 配方表門市每杯成本核心來源！)
// 3. dealer_price: 賣給非直營門市/經銷商價格 (Distributor Price)
import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function getAdminUser() {
  const ctx = await getUnitContextAny(['finance', 'rd', 'store', 'audit'])
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// GET /api/fin/material-prices?category=all&q=
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const category = s(searchParams.get('category'))
  const q = s(searchParams.get('q')).toLowerCase()

  let query = supabase
    .from('inv_material_prices')
    .select('*')
    .eq('owner_id', user.id)
    .order('category')
    .order('material_code')

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let items = data ?? []
  if (q) {
    items = items.filter(
      (it: any) => it.material_code.toLowerCase().includes(q) || (it.material_name && it.material_name.toLowerCase().includes(q))
    )
  }

  // 統計各分類筆數
  const { data: allItems } = await supabase
    .from('inv_material_prices')
    .select('category')
    .eq('owner_id', user.id)

  const counts: Record<string, number> = {
    all: allItems?.length ?? 0,
    raw: 0,        // 原料
    equipment: 0,  // 設備
    consumable: 0, // 耗材
    tool: 0,       // 道具
    other: 0,
  }

  for (const it of allItems ?? []) {
    const c = it.category || '原料'
    if (c === '原料') counts.raw++
    else if (c === '設備') counts.equipment++
    else if (c === '耗材') counts.consumable++
    else if (c === '道具') counts.tool++
    else counts.other++
  }

  return NextResponse.json({ items, counts })
}

// POST /api/fin/material-prices (新增品項定價)
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const code = s(body.material_code)
  const name = s(body.material_name)

  if (!code) {
    return NextResponse.json({ error: '品項代碼必填' }, { status: 400 })
  }

  const row = {
    owner_id: user.id,
    material_code: code,
    material_name: name || code,
    unit: s(body.unit) || '個',
    category: s(body.category) || '原料',
    purchase_price: num(body.purchase_price),
    export_price: num(body.export_price),
    dealer_price: num(body.dealer_price),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('inv_material_prices')
    .upsert(row, { onConflict: 'owner_id,material_code' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

// PATCH /api/fin/material-prices (編輯品項定價)
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const id = s(body.id)
  const code = s(body.material_code)

  if (!id && !code) {
    return NextResponse.json({ error: 'id or material_code required' }, { status: 400 })
  }

  const upd: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }
  if (body.material_name !== undefined) upd.material_name = s(body.material_name)
  if (body.unit !== undefined) upd.unit = s(body.unit)
  if (body.category !== undefined) upd.category = s(body.category)
  if (body.purchase_price !== undefined) upd.purchase_price = num(body.purchase_price)
  if (body.export_price !== undefined) upd.export_price = num(body.export_price)
  if (body.dealer_price !== undefined) upd.dealer_price = num(body.dealer_price)

  let query = supabase.from('inv_material_prices').update(upd).eq('owner_id', user.id)
  if (id) query = query.eq('id', id)
  else if (code) query = query.eq('material_code', code)

  const { data, error } = await query.select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

// DELETE /api/fin/material-prices (刪除品項)
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const id = s(body.id)
  const code = s(body.material_code)

  if (!id && !code) {
    return NextResponse.json({ error: 'id or material_code required' }, { status: 400 })
  }

  let query = supabase.from('inv_material_prices').delete().eq('owner_id', user.id)
  if (id) query = query.eq('id', id)
  else if (code) query = query.eq('material_code', code)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
