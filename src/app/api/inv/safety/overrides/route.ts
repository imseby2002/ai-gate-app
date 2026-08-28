import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }
const dateOrNull = (v: unknown) => { const t = s(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }

// 某門市的節慶／日期區間安全量・滿倉量覆寫。?store= 必填，可選 &material_code=
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const store = s(sp.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  let q = supabase.from('inv_safety_overrides')
    .select('id, material_code, label, start_date, end_date, safety_qty, full_qty')
    .eq('owner_id', user.id).eq('store', store)
  const material = s(sp.get('material_code'))
  if (material) q = q.eq('material_code', material)
  const { data, error } = await q.order('start_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

// 新增覆寫。body: { store, material_code, label?, start_date, end_date, safety_qty?, full_qty? }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  const material_code = s(b.material_code)
  const start_date = dateOrNull(b.start_date)
  const end_date = dateOrNull(b.end_date)
  if (!store || !material_code) return NextResponse.json({ error: 'store 與 material_code 必填' }, { status: 400 })
  if (!start_date || !end_date) return NextResponse.json({ error: '起訖日期必填（YYYY-MM-DD）' }, { status: 400 })
  if (end_date < start_date) return NextResponse.json({ error: '結束日不可早於起始日' }, { status: 400 })
  const { data, error } = await supabase.from('inv_safety_overrides').insert({
    owner_id: user.id, store, material_code, label: s(b.label),
    start_date, end_date, safety_qty: num(b.safety_qty), full_qty: num(b.full_qty),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// 編輯覆寫。body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.label !== undefined) upd.label = s(b.label)
  if (b.start_date !== undefined) { const d = dateOrNull(b.start_date); if (!d) return NextResponse.json({ error: '起始日格式錯誤' }, { status: 400 }); upd.start_date = d }
  if (b.end_date !== undefined) { const d = dateOrNull(b.end_date); if (!d) return NextResponse.json({ error: '結束日格式錯誤' }, { status: 400 }); upd.end_date = d }
  if (b.safety_qty !== undefined) upd.safety_qty = num(b.safety_qty)
  if (b.full_qty !== undefined) upd.full_qty = num(b.full_qty)
  const { error } = await supabase.from('inv_safety_overrides').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// 刪除覆寫。body: { id }
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('inv_safety_overrides').delete().eq('id', s(id)).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
