import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() { return await getUnitContextAny(['audit', 'store']) }
const s = (v: unknown) => String(v ?? '').trim()

// 硬性規定清單。?store= 可選（回傳該門市＋全門市通用）
export async function GET(req: NextRequest) {
  const c = await ctx(); if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })
  const store = s(new URL(req.url).searchParams.get('store'))
  let q = c.admin.from('audit_rules').select('id, store, rule, active, created_at').eq('owner_id', c.ownerId)
  if (store) q = q.or(`store.eq.${store},store.eq.`)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data ?? [] })
}

// 新增規則。body: { rule, store?, source_chat_id? }
export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })
  const b = await req.json().catch(() => ({}))
  const rule = s(b.rule)
  if (!rule) return NextResponse.json({ error: '規則內容必填' }, { status: 400 })
  const { data, error } = await c.admin.from('audit_rules').insert({
    owner_id: c.ownerId, store: s(b.store), rule, source_chat_id: s(b.source_chat_id) || null,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// 編輯（啟用/停用或改文字）。body: { id, active?, rule? }
export async function PATCH(req: NextRequest) {
  const c = await ctx(); if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.active !== undefined) upd.active = !!b.active
  if (b.rule !== undefined) upd.rule = s(b.rule)
  const { error } = await c.admin.from('audit_rules').update(upd).eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx(); if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('audit_rules').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
