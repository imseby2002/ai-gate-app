import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('hr')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

// 站內通知列表 + 未讀數
export async function GET() {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

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
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })

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
