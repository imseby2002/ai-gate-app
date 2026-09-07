import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() {
  const c = await getUnitContextAny(['audit', 'store', 'mkt'])
  return c.ok ? c : null
}

// 行銷活動與直播白名單登記 API
export async function GET(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const store = searchParams.get('store')?.trim()

  let q = c.admin.from('audit_marketing_events')
    .select('*')
    .eq('owner_id', c.ownerId)
    .order('created_at', { ascending: false })

  if (store) q = q.eq('store', store)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim()
  const event_title = String(b.event_title ?? '').trim()
  if (!store || !event_title) return NextResponse.json({ error: '門市與活動名稱為必填' }, { status: 400 })

  const id = b.id ? String(b.id) : undefined
  const payload = {
    owner_id: c.ownerId,
    store,
    event_title,
    platform: String(b.platform ?? 'zalo').trim(),
    host_account: String(b.host_account ?? '').trim(),
    start_time: b.start_time || null,
    end_time: b.end_time || null,
    approved: b.approved !== undefined ? !!b.approved : true,
    pos_reconciled: !!b.pos_reconciled,
    notes: String(b.notes ?? '').trim(),
  }

  if (id) {
    const { error } = await c.admin.from('audit_marketing_events').update(payload).eq('id', id).eq('owner_id', c.ownerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id })
  } else {
    const { data, error } = await c.admin.from('audit_marketing_events').insert(payload).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
  }
}

export async function DELETE(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await c.admin.from('audit_marketing_events').delete().eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
