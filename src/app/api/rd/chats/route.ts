import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('rd')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}
const s = (v: unknown) => String(v ?? '').trim()

// ?id= 取單一對話訊息；否則對話清單
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const id = s(new URL(req.url).searchParams.get('id'))
  if (id) {
    const { data: chat } = await supabase.from('rd_chats').select('id, title, mode').eq('id', id).eq('owner_id', user.id).single()
    if (!chat) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const { data: messages } = await supabase.from('rd_messages').select('role, content, suggestion, created_at').eq('chat_id', id).eq('owner_id', user.id).order('created_at')
    return NextResponse.json({ chat, messages: messages ?? [] })
  }
  const { data } = await supabase.from('rd_chats').select('id, title, mode, updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(50)
  return NextResponse.json({ chats: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('rd_chats').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
