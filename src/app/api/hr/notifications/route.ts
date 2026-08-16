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

// 站內通知列表 + 未讀數
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('hr_notifications')
    .select('id, kind, title, body, candidate_id, is_read, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  const unread = (data ?? []).filter(n => !n.is_read).length
  return NextResponse.json({ notifications: data ?? [], unread })
}

// 標記已讀。body: { id } 或 { all: true }
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  let q = supabase.from('hr_notifications').update({ is_read: true }).eq('owner_id', user.id)
  if (!body.all) {
    if (!body.id) return NextResponse.json({ error: 'id 或 all 為必填' }, { status: 400 })
    q = q.eq('id', body.id)
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
