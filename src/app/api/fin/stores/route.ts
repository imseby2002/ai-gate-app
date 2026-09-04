import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const UNIT_FIELDS = ['unit_type', 'short_name', 'electricity_no', 'water_no', 'address'] as const

export async function GET() {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { data, error } = await supabase.from('fin_stores')
    .select('id, code, name, region, active, unit_type, short_name, electricity_no, water_no, address, base_hourly_rate').eq('owner_id', user.id)
    .order('unit_type').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stores: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim()
  if (!code) return NextResponse.json({ error: '門市編碼必填' }, { status: 400 })
  const extra: Record<string, unknown> = {}
  for (const f of UNIT_FIELDS) if (body[f] !== undefined) extra[f] = String(body[f] ?? '').trim()
  if (body.base_hourly_rate !== undefined) extra.base_hourly_rate = Math.max(0, Number(body.base_hourly_rate) || 0)
  const { data, error } = await supabase.from('fin_stores').insert({
    owner_id: user.id, code, name: String(body.name ?? ''), region: String(body.region ?? ''),
    active: body.active !== false, ...extra,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? '門市編碼重複' : error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = {}
  for (const f of ['code', 'name', 'region', ...UNIT_FIELDS] as const) if (body[f] !== undefined) upd[f] = String(body[f]).trim()
  if (body.base_hourly_rate !== undefined) upd.base_hourly_rate = Math.max(0, Number(body.base_hourly_rate) || 0)
  if (body.active !== undefined) upd.active = !!body.active
  const { error } = await supabase.from('fin_stores').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('fin_stores').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
