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

export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await supabase.from('fin_stores')
    .select('id, code, name, region, active').eq('owner_id', user.id)
    .order('region').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stores: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim()
  if (!code) return NextResponse.json({ error: '門市編碼必填' }, { status: 400 })
  const { data, error } = await supabase.from('fin_stores').insert({
    owner_id: user.id, code, name: String(body.name ?? ''), region: String(body.region ?? ''),
    active: body.active !== false,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? '門市編碼重複' : error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = {}
  for (const f of ['code', 'name', 'region'] as const) if (body[f] !== undefined) upd[f] = String(body[f]).trim()
  if (body.active !== undefined) upd.active = !!body.active
  const { error } = await supabase.from('fin_stores').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('fin_stores').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
