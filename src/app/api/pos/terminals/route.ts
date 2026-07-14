import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPosOwner, resolveTerminal, terminalAuth } from '@/lib/pos/auth'

export async function GET(req: NextRequest) {
  const ctx = await getPosOwner()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await ctx.supabase
    .from('pos_terminals')
    .select('*, pos_stores(name, slug)')
    .eq('owner_id', ctx.userId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ terminals: data ?? [] })
}

/** 終端自我註冊／心跳（device_key 驗證） */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const key = terminalAuth(req) || body.device_key
  if (!key) return NextResponse.json({ error: 'device_key required' }, { status: 401 })

  const terminal = await resolveTerminal(key)
  if (!terminal) return NextResponse.json({ error: 'Invalid device_key' }, { status: 403 })

  const admin = createAdminClient()
  await admin
    .from('pos_terminals')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', terminal.id)

  return NextResponse.json({
    terminal: {
      id: terminal.id,
      store_id: terminal.store_id,
      store_name: terminal.store_name,
      name: terminal.name,
    },
  })
}
