// 合併兩位客人：把 other 的帳號與紀錄全部併入 target，補齊欄位後刪除 other。
// 手動合併（客戶頁）與同步時的自動合併（同一支電話／Email 出現在兩位客人身上）共用。
import type { SupabaseClient } from '@supabase/supabase-js'
import { ownerFilter } from './scope'

export async function mergeContacts(db: SupabaseClient, ownerId: string | null, targetId: string, otherId: string): Promise<void> {
  if (targetId === otherId) return
  const own = ownerFilter(ownerId)
  const { data: rows, error } = await db.from('crm_contacts').select('*').filter('owner_id', ...own).in('id', [targetId, otherId])
  if (error) throw error
  const target = rows?.find(r => r.id === targetId)
  const other = rows?.find(r => r.id === otherId)
  if (!target || !other) return

  const join = (a: string | null, b: string | null) => [...new Set([a, b].filter(Boolean))].join('\n') || null
  const patch = {
    display_name: target.display_name ?? other.display_name,
    phone: target.phone ?? other.phone,
    email: target.email ?? other.email,
    gender: target.gender ?? other.gender,
    birthday: target.birthday ?? other.birthday,
    country: target.country ?? other.country,
    tags: [...new Set([...(target.tags ?? []), ...(other.tags ?? [])])],
    traits: join(target.traits, other.traits),
    notes: join(target.notes, other.notes),
    ai_summary: target.ai_summary ?? other.ai_summary,
    added_by: target.added_by ?? other.added_by,
  }
  for (const table of ['crm_identities', 'crm_activities']) {
    const { error: e } = await db.from(table).update({ contact_id: targetId }).eq('contact_id', otherId).filter('owner_id', ...own)
    if (e) throw e
  }
  const { error: e1 } = await db.from('crm_contacts').update(patch).eq('id', targetId)
  if (e1) throw e1
  const { error: e2 } = await db.from('crm_contacts').delete().eq('id', otherId).filter('owner_id', ...own)
  if (e2) throw e2
}
