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
const intOrNull = (v: unknown) => { if (v === '' || v === null || v === undefined) return null; const n = parseInt(String(v)); return Number.isFinite(n) && n >= 0 ? n : null }

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z')
  return Math.round((b - a) / 86400000)
}

// 某門市的進貨批次（含到期天數）。?store= 必填，可選 &material_code= 過濾、&include=all 顯示已報廢
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const store = s(sp.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const material = s(sp.get('material_code'))
  const includeAll = s(sp.get('include')) === 'all'

  let q = supabase.from('inv_material_batches')
    .select('id, material_code, material_name, unit, purchase_date, expiry_date, qty, remind_staff, remind_audit, remind_mgmt, status, scrapped_at, note')
    .eq('owner_id', user.id).eq('store', store)
  if (material) q = q.eq('material_code', material)
  if (!includeAll) q = q.eq('status', 'active')
  const { data, error } = await q.order('expiry_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  const rows = (data ?? []).map(b => ({
    ...b,
    days_to_expiry: b.expiry_date ? daysBetween(today, b.expiry_date) : null,
  }))
  return NextResponse.json({ rows })
}

// 新增單筆批次。body: { store, material_code, material_name?, unit?, purchase_date?, expiry_date, qty?, remind_staff?, remind_audit?, remind_mgmt?, note? }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  const material_code = s(b.material_code)
  const expiry_date = dateOrNull(b.expiry_date)
  if (!store || !material_code) return NextResponse.json({ error: 'store 與 material_code 必填' }, { status: 400 })
  if (!expiry_date) return NextResponse.json({ error: '到期日必填（YYYY-MM-DD）' }, { status: 400 })

  const { data, error } = await supabase.from('inv_material_batches').insert({
    owner_id: user.id, store, material_code,
    material_name: s(b.material_name), unit: s(b.unit),
    purchase_date: dateOrNull(b.purchase_date), expiry_date, qty: num(b.qty),
    remind_staff: intOrNull(b.remind_staff), remind_audit: intOrNull(b.remind_audit), remind_mgmt: intOrNull(b.remind_mgmt),
    note: s(b.note),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// 編輯批次欄位。body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.material_name !== undefined) upd.material_name = s(b.material_name)
  if (b.unit !== undefined) upd.unit = s(b.unit)
  if (b.purchase_date !== undefined) upd.purchase_date = dateOrNull(b.purchase_date)
  if (b.expiry_date !== undefined) { const d = dateOrNull(b.expiry_date); if (!d) return NextResponse.json({ error: '到期日格式錯誤' }, { status: 400 }); upd.expiry_date = d }
  if (b.qty !== undefined) upd.qty = num(b.qty)
  if (b.remind_staff !== undefined) upd.remind_staff = intOrNull(b.remind_staff)
  if (b.remind_audit !== undefined) upd.remind_audit = intOrNull(b.remind_audit)
  if (b.remind_mgmt !== undefined) upd.remind_mgmt = intOrNull(b.remind_mgmt)
  if (b.note !== undefined) upd.note = s(b.note)
  const { error } = await supabase.from('inv_material_batches').update(upd).eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// 刪除批次（輸入錯誤時用；報廢請走「耗損」流程）。body: { id }
export async function DELETE(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('inv_material_batches').delete().eq('id', s(id)).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
