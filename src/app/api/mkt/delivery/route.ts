import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() { const c = await getUnitContext('mkt'); return c.ok ? c : null }
const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
const int = (v: unknown) => { const t = s(v); if (!t) return null; const n = parseInt(t, 10); return Number.isFinite(n) ? n : null }
const PLATFORMS = ['grab', 'shopee', 'baemin', 'other']
const STATUS = ['online', 'offline', 'pending', 'suspended']

export async function GET(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  let q = c.admin.from('mkt_delivery')
    .select('id, platform, store, status, url, commission_rate, rating, ranking, period, monthly_orders, monthly_revenue, promo, note')
    .eq('owner_id', c.ownerId)
  const platform = s(sp.get('platform')); if (platform) q = q.eq('platform', platform)
  const status = s(sp.get('status')); if (status) q = q.eq('status', status)
  const { data, error } = await q.order('platform').order('store')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!s(b.store)) return NextResponse.json({ error: '門市必填' }, { status: 400 })
  const { data, error } = await c.admin.from('mkt_delivery').insert({
    owner_id: c.ownerId,
    platform: PLATFORMS.includes(s(b.platform)) ? s(b.platform) : 'grab',
    store: s(b.store),
    status: STATUS.includes(s(b.status)) ? s(b.status) : 'online',
    url: s(b.url), commission_rate: num(b.commission_rate), rating: num(b.rating), ranking: int(b.ranking),
    period: s(b.period), monthly_orders: num(b.monthly_orders), monthly_revenue: num(b.monthly_revenue),
    promo: s(b.promo), note: s(b.note),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.platform !== undefined && PLATFORMS.includes(s(b.platform))) upd.platform = s(b.platform)
  if (b.store !== undefined) { if (!s(b.store)) return NextResponse.json({ error: '門市必填' }, { status: 400 }); upd.store = s(b.store) }
  if (b.status !== undefined && STATUS.includes(s(b.status))) upd.status = s(b.status)
  if (b.url !== undefined) upd.url = s(b.url)
  if (b.commission_rate !== undefined) upd.commission_rate = num(b.commission_rate)
  if (b.rating !== undefined) upd.rating = num(b.rating)
  if (b.ranking !== undefined) upd.ranking = int(b.ranking)
  if (b.period !== undefined) upd.period = s(b.period)
  if (b.monthly_orders !== undefined) upd.monthly_orders = num(b.monthly_orders)
  if (b.monthly_revenue !== undefined) upd.monthly_revenue = num(b.monthly_revenue)
  if (b.promo !== undefined) upd.promo = s(b.promo)
  if (b.note !== undefined) upd.note = s(b.note)
  const { error } = await c.admin.from('mkt_delivery').update(upd).eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('mkt_delivery').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
