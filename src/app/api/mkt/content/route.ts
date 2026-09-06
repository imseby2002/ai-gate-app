import { getUnitContext } from '@/lib/auth/unit-access'
import { generateContentSet } from '@/lib/mkt/generate'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

async function ctx() { const c = await getUnitContext('mkt'); return c.ok ? c : null }
const s = (v: unknown) => String(v ?? '').trim()
const STATUS = ['review', 'approved', 'scheduled', 'published', 'rejected']

// 清單或單筆（?id=）
export async function GET(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = s(new URL(req.url).searchParams.get('id'))
  if (id) {
    const { data, error } = await c.admin.from('mkt_content').select('*').eq('id', id).eq('owner_id', c.ownerId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  }
  const { data, error } = await c.admin.from('mkt_content')
    .select('id, topic, channels, status, created_at').eq('owner_id', c.ownerId)
    .order('created_at', { ascending: false }).limit(80)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// 一鍵產出：{ topic, brief?, channels[] } → AI 生成整套 → 存為待審核
export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const topic = s(b.topic)
  if (!topic) return NextResponse.json({ error: '主題必填' }, { status: 400 })
  const channels = Array.isArray(b.channels) ? b.channels.map(s).filter(Boolean) : []
  try {
    const { outputs, model } = await generateContentSet(c.admin, c.ownerId, topic, s(b.brief), channels)
    const { data, error } = await c.admin.from('mkt_content').insert({
      owner_id: c.ownerId, topic, brief: s(b.brief), channels, outputs, status: 'review', model,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id, outputs })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// 編輯產出／改狀態（核准/退回）／審核備註。body: { id, outputs?, status?, review_note? }
export async function PATCH(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.outputs !== undefined && b.outputs && typeof b.outputs === 'object') upd.outputs = b.outputs
  if (b.status !== undefined && STATUS.includes(s(b.status))) upd.status = s(b.status)
  if (b.review_note !== undefined) upd.review_note = s(b.review_note)
  const { error } = await c.admin.from('mkt_content').update(upd).eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('mkt_content').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
