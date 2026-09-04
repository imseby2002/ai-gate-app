import { NextRequest, NextResponse } from 'next/server'
import { getUnitContext } from '@/lib/auth/unit-access'

async function getAdminUser() {
  const ctx = await getUnitContext('finance')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const ENTRY_METHODS = new Set(['import', 'vendor', 'manual'])
const SERVICES = new Set(['', 'gas', 'ice'])

// 預設科目（首次載入自動建立）
const DEFAULTS = [
  { code: 'WATER', name: '水費', entry_method: 'import', vendor_service: '', sort: 1 },
  { code: 'ELEC', name: '電費', entry_method: 'import', vendor_service: '', sort: 2 },
  { code: 'GAS', name: '瓦斯費', entry_method: 'vendor', vendor_service: 'gas', sort: 3 },
  { code: 'ICE', name: '冰塊費', entry_method: 'vendor', vendor_service: 'ice', sort: 4 },
]

export async function GET() {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  let { data } = await supabase.from('fin_expense_categories')
    .select('id, code, name, entry_method, vendor_service, sort').eq('owner_id', user.id).order('sort').order('code')
  if (!data || data.length === 0) {
    await supabase.from('fin_expense_categories').insert(DEFAULTS.map(d => ({ ...d, owner_id: user.id })))
    const r = await supabase.from('fin_expense_categories')
      .select('id, code, name, entry_method, vendor_service, sort').eq('owner_id', user.id).order('sort').order('code')
    data = r.data ?? []
  }
  return NextResponse.json({ categories: data })
}

export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim()
  if (!code) return NextResponse.json({ error: '科目編碼必填' }, { status: 400 })
  const entry_method = ENTRY_METHODS.has(body.entry_method) ? body.entry_method : 'manual'
  const vendor_service = SERVICES.has(body.vendor_service) ? body.vendor_service : ''
  const { data, error } = await supabase.from('fin_expense_categories').insert({
    owner_id: user.id, code, name: String(body.name ?? ''), entry_method,
    vendor_service: entry_method === 'vendor' ? vendor_service : '', sort: Number(body.sort) || 0,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? '科目編碼重複' : error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = {}
  if (body.code !== undefined) upd.code = String(body.code).trim()
  if (body.name !== undefined) upd.name = String(body.name)
  if (body.entry_method !== undefined && ENTRY_METHODS.has(body.entry_method)) upd.entry_method = body.entry_method
  if (body.vendor_service !== undefined && SERVICES.has(body.vendor_service)) upd.vendor_service = body.vendor_service
  if (body.sort !== undefined) upd.sort = Number(body.sort) || 0
  const { error } = await supabase.from('fin_expense_categories').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('fin_expense_categories').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
