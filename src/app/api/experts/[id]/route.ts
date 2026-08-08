import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/experts/[id] — 取得單一專家（含知識內容）
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: expert, error } = await supabase
    .from('experts')
    .select('*, expert_knowledge(id, structured, status, error, created_at)')
    .eq('id', id)
    .single()

  if (error || !expert) return NextResponse.json({ error: '找不到專家' }, { status: 404 })
  return NextResponse.json({ expert })
}

// DELETE /api/experts/[id] — 刪除自己建立的專家（系統專家一律禁止）
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: expert } = await supabase
    .from('experts')
    .select('created_by, is_system')
    .eq('id', id)
    .single()

  if (!expert) return NextResponse.json({ error: '找不到專家' }, { status: 404 })
  if (expert.is_system) return NextResponse.json({ error: '無法刪除系統專家' }, { status: 403 })
  if (expert.created_by !== user.id) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const admin = createAdminClient()
  await admin.from('experts').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
