import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing', 'rd'])
}

const s = (v: unknown) => String(v ?? '').trim()
const d = (v: unknown) => { const t = s(v); return t || null }
const STATUSES = ['rd_submitted', 'mkt_prep', 'vip_exclusive', 'public_released', 'archived']

export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const sp = new URL(req.url).searchParams
  const status = s(sp.get('status'))

  let q = c.admin
    .from('mkt_product_launches')
    .select(`
      *,
      product:mkt_product_profiles(*),
      recipe:rd_recipes(id, name, total_purchase, total_export)
    `)
    .eq('owner_id', c.ownerId)

  if (status && STATUSES.includes(status)) {
    q = q.eq('status', status)
  }

  const { data, error } = await q.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 自動檢查 VIP 專享期是否已到期，若已到期且狀態仍為 vip_exclusive，可標註自動提示可全面上市
  const nowStr = new Date().toISOString().split('T')[0]
  const enriched = (data ?? []).map((launch: any) => {
    const isVipExpired = launch.status === 'vip_exclusive' && launch.vip_end_date && launch.vip_end_date < nowStr
    return {
      ...launch,
      isVipExpired,
    }
  })

  return NextResponse.json({ items: enriched })
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const name = s(b.name)
  if (!name) return NextResponse.json({ error: '新品名稱必填' }, { status: 400 })

  const status = STATUSES.includes(s(b.status)) ? s(b.status) : 'mkt_prep'

  // 若提供了 recipe_id 或 pos_item_id，亦自動確保 mkt_product_profiles 有對應紀錄
  let productId = b.product_id || null
  if (!productId) {
    const { data: existingProd } = await c.admin
      .from('mkt_product_profiles')
      .select('id')
      .eq('owner_id', c.ownerId)
      .eq('name', name)
      .maybeSingle()

    if (existingProd) {
      productId = existingProd.id
    } else {
      const { data: newProd } = await c.admin
        .from('mkt_product_profiles')
        .insert({
          owner_id: c.ownerId,
          name,
          category: s(b.category || '新品特調'),
          price: Number(b.price) || 0,
          slogan: s(b.slogan || '研發全新力作'),
          recipe_id: b.recipe_id || null,
          pos_item_id: b.pos_item_id || null,
        })
        .select('id')
        .single()
      if (newProd) productId = newProd.id
    }
  }

  const { data, error } = await c.admin
    .from('mkt_product_launches')
    .insert({
      owner_id: c.ownerId,
      name,
      product_id: productId,
      recipe_id: b.recipe_id || null,
      pos_item_id: b.pos_item_id || null,
      status,
      vip_start_date: d(b.vip_start_date),
      vip_end_date: d(b.vip_end_date),
      vip_tiers: Array.isArray(b.vip_tiers) ? b.vip_tiers : ['vip', 'vvip'],
      vip_discount_type: s(b.vip_discount_type || 'early_bird'),
      vip_notes: s(b.vip_notes),
      public_release_date: d(b.public_release_date),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, launch: data })
}

export async function PATCH(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.name !== undefined) upd.name = s(b.name)
  if (b.status !== undefined && STATUSES.includes(s(b.status))) upd.status = s(b.status)
  if (b.vip_start_date !== undefined) upd.vip_start_date = d(b.vip_start_date)
  if (b.vip_end_date !== undefined) upd.vip_end_date = d(b.vip_end_date)
  if (b.vip_tiers !== undefined && Array.isArray(b.vip_tiers)) upd.vip_tiers = b.vip_tiers
  if (b.vip_discount_type !== undefined) upd.vip_discount_type = s(b.vip_discount_type)
  if (b.vip_notes !== undefined) upd.vip_notes = s(b.vip_notes)
  if (b.public_release_date !== undefined) upd.public_release_date = d(b.public_release_date)

  const { data, error } = await c.admin
    .from('mkt_product_launches')
    .update(upd)
    .eq('id', id)
    .eq('owner_id', c.ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, launch: data })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await c.admin.from('mkt_product_launches').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
