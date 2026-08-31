import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() { const c = await getUnitContextAny(['audit', 'store']); return c.ok ? c : null }
const s = (v: unknown) => String(v ?? '').trim()

// ?id= 取單一對話訊息；否則對話清單（可選 &store=）
export async function GET(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const id = s(sp.get('id'))
  if (id) {
    const { data: chat } = await c.admin.from('audit_chats').select('id, store, title').eq('id', id).eq('owner_id', c.ownerId).single()
    if (!chat) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const { data: msgs } = await c.admin.from('audit_messages').select('role, content, created_at').eq('chat_id', id).eq('owner_id', c.ownerId).order('created_at')
    return NextResponse.json({ chat, messages: msgs ?? [] })
  }
  let q = c.admin.from('audit_chats').select('id, store, title, updated_at').eq('owner_id', c.ownerId)
  const store = s(sp.get('store'))
  if (store) q = q.eq('store', store)
  const { data } = await q.order('updated_at', { ascending: false }).limit(50)
  return NextResponse.json({ chats: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('audit_chats').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
