import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() { const c = await getUnitContext('mkt'); return c.ok ? c : null }
const s = (v: unknown) => String(v ?? '').trim()
const d = (v: unknown) => { const t = s(v); return t || null }
const CHANNELS = ['fb', 'ig', 'tiktok', 'zalo', 'line', 'store', 'other']
const STATUS = ['idea', 'draft', 'review', 'scheduled', 'published']

// 內容行事曆。?status= ?channel= ?from= ?to= 篩選
export async function GET(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  let q = c.admin.from('mkt_calendar')
    .select('id, title, channel, scheduled_date, status, note, created_at')
    .eq('owner_id', c.ownerId)
  const status = s(sp.get('status')); if (status) q = q.eq('status', status)
  const channel = s(sp.get('channel')); if (channel) q = q.eq('channel', channel)
  const from = s(sp.get('from')); if (from) q = q.gte('scheduled_date', from)
  const to = s(sp.get('to')); if (to) q = q.lte('scheduled_date', to)
  const { data, error } = await q.order('scheduled_date', { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const title = s(b.title)
  if (!title) return NextResponse.json({ error: '標題必填' }, { status: 400 })
  const { data, error } = await c.admin.from('mkt_calendar').insert({
    owner_id: c.ownerId, title,
    channel: CHANNELS.includes(s(b.channel)) ? s(b.channel) : 'other',
    scheduled_date: d(b.scheduled_date),
    status: STATUS.includes(s(b.status)) ? s(b.status) : 'idea',
    note: s(b.note),
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
  if (b.title !== undefined) { if (!s(b.title)) return NextResponse.json({ error: '標題必填' }, { status: 400 }); upd.title = s(b.title) }
  if (b.channel !== undefined && CHANNELS.includes(s(b.channel))) upd.channel = s(b.channel)
  if (b.scheduled_date !== undefined) upd.scheduled_date = d(b.scheduled_date)
  if (b.status !== undefined && STATUS.includes(s(b.status))) upd.status = s(b.status)
  if (b.note !== undefined) upd.note = s(b.note)
  const { error } = await c.admin.from('mkt_calendar').update(upd).eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('mkt_calendar').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
