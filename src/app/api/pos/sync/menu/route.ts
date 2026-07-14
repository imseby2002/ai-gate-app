import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTerminal, terminalAuth } from '@/lib/pos/auth'
import { fetchMenuForStore } from '@/lib/pos/menu'

/** 終端拉取菜單（支援 since=revision 增量判斷） */
export async function GET(req: NextRequest) {
  const key = terminalAuth(req) || new URL(req.url).searchParams.get('device_key')
  if (!key) return NextResponse.json({ error: 'device_key required' }, { status: 401 })

  const terminal = await resolveTerminal(key)
  if (!terminal) return NextResponse.json({ error: 'Invalid device_key' }, { status: 403 })

  const since = Number(new URL(req.url).searchParams.get('since') || 0)
  const admin = createAdminClient()
  const menu = await fetchMenuForStore(admin, terminal.owner_id, terminal.store_id, since || undefined)

  await admin
    .from('pos_terminals')
    .update({
      last_sync_at: new Date().toISOString(),
      last_menu_revision: menu.revision,
    })
    .eq('id', terminal.id)

  return NextResponse.json({
    store_id: terminal.store_id,
    store_name: terminal.store_name,
    terminal_id: terminal.id,
    ...menu,
  })
}
