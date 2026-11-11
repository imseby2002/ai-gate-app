// 是否參與排班：所屬門市（或管理門市）是門市／倉庫（工廠）才排班；辦公室（office）與總部（group）人員不排班，
// 員工專區只顯示個人資料、薪資、考試與請假。門市代碼不在門市主檔時視為門市（避免漏排）。
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>
const NON_SCHEDULED_KINDS = new Set(['office', 'group'])

export async function schedulableStore(db: Admin, owner: string, emp: { store?: string | null; managed_stores?: unknown }): Promise<string | null> {
  const codes = [emp.store, ...(Array.isArray(emp.managed_stores) ? emp.managed_stores : [])]
    .map(c => String(c ?? '').trim()).filter(Boolean)
  if (!codes.length) return null
  const { data } = await db.from('pnl_stores').select('code, kind').eq('owner_id', owner).in('code', codes)
  const kindOf = new Map((data ?? []).map(r => [String(r.code), String(r.kind)]))
  return codes.find(c => !NON_SCHEDULED_KINDS.has(kindOf.get(c) ?? 'store')) ?? null
}
