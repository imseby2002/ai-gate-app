import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing'])
}

const s = (v: unknown) => String(v ?? '').trim()
const d = (v: unknown) => { const t = s(v); return t || null }
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0 }

const CHANNELS = ['offline', 'online', 'hybrid']
const STATUSES = ['draft', 'planned', 'active', 'ended', 'cancelled']
const CATEGORIES = ['material', 'event', 'outdoor', 'partner', 'social_promo', 'delivery_promo', 'member_exclusive']

export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const sp = new URL(req.url).searchParams
  let q = c.admin.from('mkt_campaigns')
    .select('*')
    .eq('owner_id', c.ownerId)

  const channel = s(sp.get('channel_type'))
  if (channel && CHANNELS.includes(channel)) q = q.eq('channel_type', channel)

  const category = s(sp.get('category'))
  if (category) q = q.eq('category', category)

  const status = s(sp.get('status'))
  if (status && STATUSES.includes(status)) q = q.eq('status', status)

  const store = s(sp.get('store'))
  if (store) q = q.eq('store', store)

  const { data, error } = await q
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const title = s(b.title)
  if (!title) return NextResponse.json({ error: '活動名稱必填' }, { status: 400 })

  const channel_type = CHANNELS.includes(s(b.channel_type)) ? s(b.channel_type) : 'offline'
  const category = CATEGORIES.includes(s(b.category)) ? s(b.category) : 'event'
  const status = STATUSES.includes(s(b.status)) ? s(b.status) : 'planned'

  const { data, error } = await c.admin.from('mkt_campaigns').insert({
    owner_id: c.ownerId,
    title,
    channel_type,
    category,
    store: s(b.store),
    status,
    start_date: d(b.start_date),
    end_date: d(b.end_date),
    budget: num(b.budget),
    actual_spend: num(b.actual_spend || b.budget),
    counterparty: s(b.counterparty),
    photo_url: s(b.photo_url),
    photo_urls: Array.isArray(b.photo_urls) ? b.photo_urls : (b.photo_url ? [s(b.photo_url)] : []),
    note: s(b.note),
    ai_brief: s(b.ai_brief),
    ai_proposal: typeof b.ai_proposal === 'object' && b.ai_proposal !== null ? b.ai_proposal : {},
    target_products: Array.isArray(b.target_products) ? b.target_products : [],
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, campaign: data })
}

export async function PATCH(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.title !== undefined) {
    if (!s(b.title)) return NextResponse.json({ error: '活動名稱必填' }, { status: 400 })
    upd.title = s(b.title)
  }
  if (b.channel_type !== undefined && CHANNELS.includes(s(b.channel_type))) upd.channel_type = s(b.channel_type)
  if (b.category !== undefined && CATEGORIES.includes(s(b.category))) upd.category = s(b.category)
  if (b.store !== undefined) upd.store = s(b.store)
  if (b.status !== undefined && STATUSES.includes(s(b.status))) upd.status = s(b.status)
  if (b.start_date !== undefined) upd.start_date = d(b.start_date)
  if (b.end_date !== undefined) upd.end_date = d(b.end_date)
  if (b.budget !== undefined) upd.budget = num(b.budget)
  if (b.actual_spend !== undefined) upd.actual_spend = num(b.actual_spend)
  if (b.counterparty !== undefined) upd.counterparty = s(b.counterparty)
  if (b.photo_url !== undefined) upd.photo_url = s(b.photo_url)
  if (b.photo_urls !== undefined && Array.isArray(b.photo_urls)) upd.photo_urls = b.photo_urls
  if (b.note !== undefined) upd.note = s(b.note)
  if (b.ai_brief !== undefined) upd.ai_brief = s(b.ai_brief)
  if (b.ai_proposal !== undefined && typeof b.ai_proposal === 'object') upd.ai_proposal = b.ai_proposal
  if (b.target_products !== undefined && Array.isArray(b.target_products)) upd.target_products = b.target_products

  const { data, error } = await c.admin.from('mkt_campaigns')
    .update(upd)
    .eq('id', id)
    .eq('owner_id', c.ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, campaign: data })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await c.admin.from('mkt_campaigns').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
