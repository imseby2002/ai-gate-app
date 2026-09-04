import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const cleanRegions = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(x => String(x).trim()).filter(Boolean))] : []
const svc = (v: unknown) => (v === 'gas' ? 'gas' : v === 'ice' ? 'ice' : '')
const dayOrNull = (v: unknown) => { const n = parseInt(String(v ?? '')); return n >= 1 && n <= 31 ? n : null }

// 基本資料欄位（廠商主檔）
function baseFields(b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of ['tax_id', 'address', 'phone', 'contact', 'products', 'pay_terms', 'billing_cycle'] as const)
    if (b[f] !== undefined) out[f] = String(b[f] ?? '').trim()
  if (b.billing_day !== undefined) out.billing_day = dayOrNull(b.billing_day)
  return out
}

// 廠商清單 ＋ 可選區域
export async function GET() {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const [{ data: vendors }, { data: stores }] = await Promise.all([
    supabase.from('fin_vendors').select('id, name, service, regions, fill_token, active, tax_id, address, phone, contact, products, pay_terms, billing_cycle, billing_day').eq('owner_id', user.id).order('service').order('name'),
    supabase.from('fin_stores').select('region').eq('owner_id', user.id).eq('active', true),
  ])
  const regions = [...new Set((stores ?? []).map(s => s.region).filter(Boolean))].sort()
  return NextResponse.json({ vendors: vendors ?? [], regions })
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const b = await req.json().catch(() => ({}))
  const name = String(b.name ?? '').trim()
  if (!name) return NextResponse.json({ error: '廠商名稱必填' }, { status: 400 })
  const service = svc(b.service)
  const { data, error } = await supabase.from('fin_vendors').insert({
    owner_id: user.id, name, service,
    regions: service === 'ice' ? cleanRegions(b.regions) : [],
    fill_token: randomBytes(24).toString('base64url'), active: b.active !== false,
    ...baseFields(b),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const b = await req.json().catch(() => ({}))
  const id = String(b.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { ...baseFields(b) }
  if (b.name !== undefined) upd.name = String(b.name).trim()
  if (b.service !== undefined) upd.service = svc(b.service)
  if (b.regions !== undefined) upd.regions = cleanRegions(b.regions)
  if (b.active !== undefined) upd.active = !!b.active
  if (upd.service === 'gas') upd.regions = []
  const { error } = await supabase.from('fin_vendors').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('fin_vendors').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
