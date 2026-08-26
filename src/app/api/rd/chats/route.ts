import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}
const s = (v: unknown) => String(v ?? '').trim()

// ?id= 取單一對話訊息；否則對話清單
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('rd_chats').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
