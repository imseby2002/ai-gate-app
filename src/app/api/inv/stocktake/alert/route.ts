import { getUnitContext } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeOrder, loadEffectiveSafety, notifyForeman, type CountRow } from '@/lib/inv/reorder'

async function getAdminUser() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { user: null as { id: string } | null, supabase: ctx.admin }
  return { user: { id: ctx.ownerId }, supabase: ctx.admin }
}

// 重新對某張盤點發送緊急（低於安全量）通知給領班。body: { id }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: head } = await supabase.from('inv_stocktakes').select('store, taken_on').eq('id', id).eq('owner_id', user.id).single()
  if (!head) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const [{ data: items }, safety, { data: st }] = await Promise.all([
    supabase.from('inv_stocktake_items').select('material_code, material_name, unit, counted_qty').eq('stocktake_id', id).eq('owner_id', user.id),
    loadEffectiveSafety(supabase, user.id, head.store, head.taken_on),
    supabase.from('fin_stores').select('name').eq('owner_id', user.id).eq('code', head.store).single(),
  ])
  const urgent = computeOrder((items ?? []) as CountRow[], safety).filter(o => o.urgent)
  if (urgent.length === 0) return NextResponse.json({ urgent_count: 0, notified: false })
  const notified = await notifyForeman(createAdminClient(), user.id, head.store, st?.name || head.store, urgent)
  return NextResponse.json({ urgent_count: urgent.length, notified })
}
