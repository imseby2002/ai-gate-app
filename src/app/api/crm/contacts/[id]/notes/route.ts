import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCrmUser } from '@/lib/crm/auth'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/crm/contacts/:id/notes { text } → 在客人時間軸新增一筆手動紀錄
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : ''
  if (!text) return NextResponse.json({ error: '內容不可空白' }, { status: 400 })
  const { data: contact } = await supabase.from('crm_contacts').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle()
  if (!contact) return NextResponse.json({ error: '找不到客人' }, { status: 404 })
  const now = new Date().toISOString()
  const { error } = await supabase.from('crm_activities').insert({
    owner_id: user.id, contact_id: id, source: 'manual', source_id: randomUUID(),
    kind: 'note', title: text, occurred_at: now,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('crm_contacts').update({ last_activity_at: now, updated_at: now }).eq('id', id)
  return NextResponse.json({ ok: true })
}

// DELETE /api/crm/contacts/:id/notes?activity_id= → 只能刪手動紀錄
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await getCrmUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params
  const actId = req.nextUrl.searchParams.get('activity_id')
  if (!actId) return NextResponse.json({ error: '缺少 activity_id' }, { status: 400 })
  const { error } = await supabase.from('crm_activities').delete().eq('id', actId).eq('contact_id', id).eq('owner_id', user.id).eq('source', 'manual')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
