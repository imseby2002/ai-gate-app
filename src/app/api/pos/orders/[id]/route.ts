import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPosOwner, resolveTerminal, terminalAuth } from '@/lib/pos/auth'
import { calcCartTotal, type PosCartLine, type PosOrderStatus } from '@/lib/pos/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const key = terminalAuth(req)

  const admin = createAdminClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.status) patch.status = body.status as PosOrderStatus
  if (body.table_label !== undefined) patch.table_label = body.table_label
  if (body.note !== undefined) patch.note = body.note
  if (body.order_type) patch.order_type = body.order_type
  if (Array.isArray(body.items)) {
    const items = body.items as PosCartLine[]
    const total = calcCartTotal(items)
    patch.items = items
    patch.subtotal_cents = total
    patch.total_cents = total
  }

  if (key) {
    const terminal = await resolveTerminal(key)
    if (!terminal) return NextResponse.json({ error: 'Invalid device_key' }, { status: 403 })
    const { data, error } = await admin
      .from('pos_orders')
      .update(patch)
      .eq('id', id)
      .eq('terminal_id', terminal.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ order: data })
  }

  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ctx.supabase
    .from('pos_orders')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', ctx.userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ order: data })
}
