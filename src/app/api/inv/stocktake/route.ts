import { getUnitContext } from '@/lib/auth/unit-access'
import type { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeOrder, loadEffectiveSafety, notifyForeman, type CountRow } from '@/lib/inv/reorder'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin, status: ctx.status }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin, status: 200 as const }
}

const s = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0 }

async function storeNameOf(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string, store: string) {
  const { data } = await supabase.from('fin_stores').select('name').eq('owner_id', ownerId).eq('code', store).single()
  return data?.name || store
}

// GET ?id= → 單張盤點（含訂貨計算＋緊急）；GET ?store= → 該門市盤點清單
export async function GET(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const sp = new URL(req.url).searchParams
  const id = s(sp.get('id'))

  if (id) {
    const { data: head } = await supabase.from('inv_stocktakes')
      .select('id, store, taken_on, note').eq('id', id).eq('owner_id', user.id).single()
    if (!head) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const { data: items } = await supabase.from('inv_stocktake_items')
      .select('material_code, material_name, unit, counted_qty').eq('stocktake_id', id).eq('owner_id', user.id)
    const safety = await loadEffectiveSafety(supabase, user.id, head.store, head.taken_on)
    const order = computeOrder((items ?? []) as CountRow[], safety)
    return NextResponse.json({ stocktake: head, order })
  }

  const store = s(sp.get('store'))
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const { data: list } = await supabase.from('inv_stocktakes')
    .select('id, store, taken_on, note, created_at').eq('owner_id', user.id).eq('store', store)
    .order('taken_on', { ascending: false }).order('created_at', { ascending: false }).limit(60)
  return NextResponse.json({ stocktakes: list ?? [] })
}

// 建立盤點。body: { store, taken_on?, note?, items:[{material_code, material_name, unit, counted_qty}] }
// → 計算訂貨（補到滿倉）＋緊急（≤安全量）；有緊急則通知領班。
export async function POST(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const b = await req.json().catch(() => ({}))
  const store = s(b.store)
  if (!store) return NextResponse.json({ error: 'store required' }, { status: 400 })
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((r: Record<string, unknown>) => ({ material_code: s(r.material_code), material_name: s(r.material_name), unit: s(r.unit), counted_qty: num(r.counted_qty) }))
    .filter((r: { material_code: string }) => r.material_code)
  if (items.length === 0) return NextResponse.json({ error: '無盤點明細' }, { status: 400 })

  const admin = createAdminClient()
  const { data: head, error: e1 } = await admin.from('inv_stocktakes')
    .insert({ owner_id: user.id, store, taken_on: /^\d{4}-\d{2}-\d{2}$/.test(s(b.taken_on)) ? s(b.taken_on) : undefined, note: s(b.note) })
    .select('id, store, taken_on').single()
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const rows = items.map((it: CountRow) => ({ stocktake_id: head.id, owner_id: user.id, ...it }))
  const { error: e2 } = await admin.from('inv_stocktake_items').insert(rows)
  if (e2) { await admin.from('inv_stocktakes').delete().eq('id', head.id); return NextResponse.json({ error: e2.message }, { status: 500 }) }

  const safety = await loadEffectiveSafety(supabase, user.id, store, head.taken_on)
  const order = computeOrder(items as CountRow[], safety)
  const urgent = order.filter(o => o.urgent)
  let notified = false
  if (urgent.length > 0) {
    const storeName = await storeNameOf(supabase, user.id, store)
    notified = await notifyForeman(admin, user.id, store, storeName, urgent)
  }
  return NextResponse.json({ id: head.id, order, urgent_count: urgent.length, notified })
}

export async function DELETE(req: NextRequest) {
  const { user, supabase, status: authStatus } = await getAdminUser()
  if (!user) return NextResponse.json({ error: authStatus === 401 ? 'Unauthorized' : 'Forbidden' }, { status: authStatus })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('inv_stocktakes').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
