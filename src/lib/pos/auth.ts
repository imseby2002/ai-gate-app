import { createAdminClient } from '@/lib/supabase/admin'
import { getUnitContext } from '@/lib/auth/unit-access'
import type { PosTerminal } from './types'

// 門市點單 POS 不是共用功能：只有公司 enabled_modules 含 'pos' 的公司可用（目前只開給 Feeling Tea）
export const POS_MODULE = 'pos'

export async function posEnabledForOwner(admin: ReturnType<typeof createAdminClient>, ownerId: string): Promise<boolean> {
  const { data: p, error: pErr } = await admin.from('profiles').select('company_id').eq('id', ownerId).maybeSingle()
  if (pErr) console.error('[pos-auth] profiles 查詢失敗', pErr)
  if (!p?.company_id) return false
  const { data: c, error: cErr } = await admin.from('companies').select('enabled_modules').eq('id', p.company_id).maybeSingle()
  if (cErr) console.error('[pos-auth] companies 查詢失敗', cErr)
  return ((c?.enabled_modules as string[] | null) ?? []).includes(POS_MODULE)
}

// 後台 POS：以「管理者或 store 單位成員」把關，資料歸屬公司 owner；公司須開通 POS 模組。
// 回傳 service-role client 與公司 owner id（呼叫端沿用 supabase/userId，不需改動）。
export async function getPosOwner() {
  const ctx = await getUnitContext('store')
  if (!ctx.ok) return { ok: false as const, status: ctx.status }
  if (!(await posEnabledForOwner(ctx.admin, ctx.ownerId))) return { ok: false as const, status: 403 as const }
  return { ok: true as const, status: 200 as const, supabase: ctx.admin, userId: ctx.ownerId, isAdmin: ctx.isAdmin }
}

export async function resolveTerminal(deviceKey: string): Promise<(PosTerminal & { store_name: string }) | null> {
  if (!deviceKey?.trim()) return null
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pos_terminals')
    .select('*, pos_stores!inner(name, is_active)')
    .eq('device_key', deviceKey.trim())
    .single()
  // 查詢失敗與「查無此機台」都會走到 return null、POS 一律被拒絕登入，兩者要分得出來。
  if (error && error.code !== 'PGRST116') console.error('[pos-auth] pos_terminals 查詢失敗', error)
  if (!data) return null
  const store = data.pos_stores as { name: string; is_active: boolean }
  if (!store.is_active) return null
  const { pos_stores: _, ...terminal } = data
  return { ...(terminal as PosTerminal), store_name: store.name }
}

export function terminalAuth(req: Request): string | null {
  return req.headers.get('x-terminal-key') || req.headers.get('x-device-key')
}
