import { createAdminClient } from '@/lib/supabase/admin'
import { getUnitContext } from '@/lib/auth/unit-access'
import type { PosTerminal } from './types'

// 後台 POS：以「管理者或 store 單位成員」把關，資料歸屬公司 owner。
// 回傳 service-role client 與公司 owner id（呼叫端沿用 supabase/userId，不需改動）。
export async function getPosOwner() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return null
  return { supabase: ctx.admin, userId: ctx.ownerId, isAdmin: ctx.isAdmin }
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
