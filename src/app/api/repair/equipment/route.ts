import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'

async function ctx() { const c = await getUnitContext('repair'); return c.ok ? c : null }
const s = (v: unknown) => String(v ?? '').trim()
const d = (v: unknown) => { const t = s(v); return t || null }  // 日期：空字串轉 null
const STATUS = ['active', 'repairing', 'scrapped']

// 設備清單。?store= 篩門市；?status= 篩狀態；warranty_days = 距保固到期天數（負值＝已過期）
export async function GET(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const store = s(sp.get('store'))
  const status = s(sp.get('status'))
  let q = c.admin.from('repair_equipment')
    .select('id, store, category, name, brand_model, serial_no, purchase_date, warranty_until, location, status, note, created_at')
    .eq('owner_id', c.ownerId)
  if (store) q = q.eq('store', store)
  if (status) q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const items = (data ?? []).map(r => {
    let warranty_days: number | null = null
    if (r.warranty_until) {
      const w = new Date(r.warranty_until + 'T00:00:00')
      warranty_days = Math.round((w.getTime() - today.getTime()) / 86400000)
    }
    return { ...r, warranty_days }
  })
  return NextResponse.json({ items })
}

// 新增設備
export async function POST(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const name = s(b.name)
  if (!name) return NextResponse.json({ error: '設備名稱必填' }, { status: 400 })
  const status = STATUS.includes(s(b.status)) ? s(b.status) : 'active'
  const { data, error } = await c.admin.from('repair_equipment').insert({
    owner_id: c.ownerId,
    store: s(b.store), category: s(b.category), name, brand_model: s(b.brand_model),
    serial_no: s(b.serial_no), purchase_date: d(b.purchase_date), warranty_until: d(b.warranty_until),
    location: s(b.location), status, note: s(b.note),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// 編輯設備
export async function PATCH(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = s(b.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.store !== undefined) upd.store = s(b.store)
  if (b.category !== undefined) upd.category = s(b.category)
  if (b.name !== undefined) { if (!s(b.name)) return NextResponse.json({ error: '設備名稱必填' }, { status: 400 }); upd.name = s(b.name) }
  if (b.brand_model !== undefined) upd.brand_model = s(b.brand_model)
  if (b.serial_no !== undefined) upd.serial_no = s(b.serial_no)
  if (b.purchase_date !== undefined) upd.purchase_date = d(b.purchase_date)
  if (b.warranty_until !== undefined) upd.warranty_until = d(b.warranty_until)
  if (b.location !== undefined) upd.location = s(b.location)
  if (b.status !== undefined && STATUS.includes(s(b.status))) upd.status = s(b.status)
  if (b.note !== undefined) upd.note = s(b.note)
  const { error } = await c.admin.from('repair_equipment').update(upd).eq('id', id).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const c = await ctx(); if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await c.admin.from('repair_equipment').delete().eq('id', s(id)).eq('owner_id', c.ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
