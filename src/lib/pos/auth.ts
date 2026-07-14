import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PosTerminal } from './types'

export async function getPosOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, enabled_modules')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.user_type === 'admin'
  const mods: string[] = profile?.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume', 'work']
  if (!isAdmin && !mods.includes('work')) return null
  return { supabase, userId: user.id, isAdmin }
}

export async function resolveTerminal(deviceKey: string): Promise<(PosTerminal & { store_name: string }) | null> {
  if (!deviceKey?.trim()) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('pos_terminals')
    .select('*, pos_stores!inner(name, is_active)')
    .eq('device_key', deviceKey.trim())
    .single()
  if (!data) return null
  const store = data.pos_stores as { name: string; is_active: boolean }
  if (!store.is_active) return null
  const { pos_stores: _, ...terminal } = data
  return { ...(terminal as PosTerminal), store_name: store.name }
}

export function terminalAuth(req: Request): string | null {
  return req.headers.get('x-terminal-key') || req.headers.get('x-device-key')
}
