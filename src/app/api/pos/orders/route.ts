import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPosOwner, resolveTerminal, terminalAuth } from '@/lib/pos/auth'
import { getMenuRevision, nextOrderNo } from '@/lib/pos/menu'
import { calcCartTotal, type PosCartLine, type PosOrderType } from '@/lib/pos/types'

export async function GET(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('store_id')
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200)

  let query = ctx.supabase
    .from('pos_orders')
    .select('*, pos_stores(name), pos_terminals(name)')
    .eq('owner_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (storeId) query = query.eq('store_id', storeId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [] })
}

/** 終端或雲端建立訂單（client_id 冪等） */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const key = terminalAuth(req) || body.device_key

  let ownerId: string
  let storeId: string
  let terminalId: string

  if (key) {
    const terminal = await resolveTerminal(key)
    if (!terminal) return NextResponse.json({ error: 'Invalid device_key' }, { status: 403 })
    ownerId = terminal.owner_id
    storeId = terminal.store_id
    terminalId = terminal.id
  } else {
    const ctx = await getPosOwner()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!body.store_id || !body.terminal_id) {
      return NextResponse.json({ error: 'store_id, terminal_id 或 device_key 必填' }, { status: 400 })
    }
    ownerId = ctx.userId
    storeId = body.store_id
    terminalId = body.terminal_id
  }

  const {
    client_id,
    order_type = 'dine_in',
    table_label,
    items,
    note = '',
  } = body as {
    client_id: string
    order_type?: PosOrderType
    table_label?: string
    items: PosCartLine[]
    note?: string
  }

  if (!client_id || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'client_id, items 必填' }, { status: 400 })
  }

  const total = calcCartTotal(items)
  const admin = createAdminClient()
  const menuRevision = await getMenuRevision(admin, ownerId)

  const row = {
    owner_id: ownerId,
    store_id: storeId,
    terminal_id: terminalId,
    client_id,
    order_no: body.order_no || nextOrderNo(),
    order_type,
    table_label: table_label?.trim() || null,
    status: 'pending' as const,
    items,
    note: note.trim(),
    subtotal_cents: total,
    total_cents: total,
    menu_revision: menuRevision,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('pos_orders')
    .upsert(row, { onConflict: 'terminal_id,client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ order: data, synced: true })
}
