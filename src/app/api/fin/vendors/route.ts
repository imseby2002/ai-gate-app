import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
  if (profile?.user_type !== 'admin') return { user: null, supabase }
  return { user, supabase }
}

const cleanRegions = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(x => String(x).trim()).filter(Boolean))] : []

// 廠商清單 ＋ 可選區域
export async function GET() {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const [{ data: vendors }, { data: stores }] = await Promise.all([
    supabase.from('fin_vendors').select('id, name, service, regions, fill_token, active').eq('owner_id', user.id).order('service').order('name'),
    supabase.from('fin_stores').select('region').eq('owner_id', user.id).eq('active', true),
  ])
  const regions = [...new Set((stores ?? []).map(s => s.region).filter(Boolean))].sort()
  return NextResponse.json({ vendors: vendors ?? [], regions })
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim()
  if (!name) return NextResponse.json({ error: '廠商名稱必填' }, { status: 400 })
  const service = b.service === 'gas' ? 'gas' : 'ice'
  const { data, error } = await supabase.from('fin_vendors').insert({
    owner_id: user.id, name, service,
    regions: service === 'ice' ? cleanRegions(b.regions) : [],
    fill_token: randomBytes(24).toString('base64url'), active: b.active !== false,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = {}
  if (b.name !== undefined) upd.name = String(b.name).trim()
  if (b.service !== undefined) upd.service = b.service === 'gas' ? 'gas' : 'ice'
  if (b.regions !== undefined) upd.regions = cleanRegions(b.regions)
  if (b.active !== undefined) upd.active = !!b.active
  if (upd.service === 'gas') upd.regions = []
  const { error } = await supabase.from('fin_vendors').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('fin_vendors').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
