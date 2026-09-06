import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() { const c = await getUnitContext('mkt'); return c.ok ? c : null }
const s = (v: unknown) => String(v ?? '').trim()
const d = (v: unknown) => { const t = s(v); return t || null }
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
const TYPES = ['material', 'event', 'outdoor', 'partner']
const STATUS = ['planned', 'active', 'installed', 'done', 'cancelled']

// 實體行銷清單。?type= ?status= 篩選
export async function GET(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  let q = c.admin.from('mkt_offline')
    .select('id, type, title, store, status, start_date, end_date, budget, counterparty, photo_url, note, created_at')
    .eq('owner_id', c.ownerId)
  const type = s(sp.get('type')); if (type) q = q.eq('type', type)
  const status = s(sp.get('status')); if (status) q = q.eq('status', status)
  const { data, error } = await q.order('start_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const title = s(b.title)
  if (!title) return NextResponse.json({ error: '標題必填' }, { status: 400 })
  const { data, error } = await c.admin.from('mkt_offline').insert({
    owner_id: c.ownerId,
    type: TYPES.includes(s(b.type)) ? s(b.type) : 'material',
    title, store: s(b.store),
    status: STATUS.includes(s(b.status)) ? s(b.status) : 'planned',
    start_date: d(b.start_date), end_date: d(b.end_date),
    budget: num(b.budget), counterparty: s(b.counterparty), photo_url: s(b.photo_url), note: s(b.note),
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
  if (b.type !== undefined && TYPES.includes(s(b.type))) upd.type = s(b.type)
  if (b.title !== undefined) { if (!s(b.title)) return NextResponse.json({ error: '標題必填' }, { status: 400 }); upd.title = s(b.title) }
  if (b.store !== undefined) upd.store = s(b.store)
  if (b.status !== undefined && STATUS.includes(s(b.status))) upd.status = s(b.status)
  if (b.start_date !== undefined) upd.start_date = d(b.start_date)
  if (b.end_date !== undefined) upd.end_date = d(b.end_date)
  if (b.budget !== undefined) upd.budget = num(b.budget)
  if (b.counterparty !== undefined) upd.counterparty = s(b.counterparty)
  if (b.photo_url !== undefined) upd.photo_url = s(b.photo_url)
  if (b.note !== undefined) upd.note = s(b.note)
  const { error } = await c.admin.from('mkt_offline').update(upd).eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('mkt_offline').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
