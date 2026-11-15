// 客戶系統範圍：以公司為單位（owner_id = 公司 owner 帳號，個人帳號＝自己）；owner_id = null 為平台範圍。
import type { SupabaseClient } from '@supabase/supabase-js'

/** owner_id 篩選條件：公司範圍 eq、平台範圍 is null，用法 `.filter('owner_id', ...ownerFilter(ownerId))` */
export function ownerFilter(ownerId: string | null): [string, string] {
  return ownerId ? ['eq', ownerId] : ['is', 'null']
}

/** 公司 owner 帳號底下所有 active 成員帳號（含 owner 本人）；不是公司 owner 時只回傳自己 */
export async function companyAccounts(db: SupabaseClient, ownerId: string): Promise<string[]> {
  const { data: own } = await db.from('company_members').select('company_id')
    .eq('member_id', ownerId).eq('role', 'owner').eq('status', 'active').limit(1).maybeSingle()
  if (!own?.company_id) return [ownerId]
  const { data: members } = await db.from('company_members').select('member_id')
    .eq('company_id', own.company_id).eq('status', 'active')
  return [...new Set([ownerId, ...((members ?? []) as { member_id: string }[]).map(m => m.member_id)])]
}

/** 帳號所屬公司的 owner（資料歸屬範圍）；沒有公司＝自己 */
export async function scopeOwnerOf(db: SupabaseClient, accountId: string): Promise<string> {
  const { data: profile } = await db.from('profiles').select('company_id').eq('id', accountId).maybeSingle()
  if (!profile?.company_id) return accountId
  const { data: owner } = await db.from('company_members').select('member_id')
    .eq('company_id', profile.company_id).eq('role', 'owner').eq('status', 'active').maybeSingle()
  return (owner?.member_id as string | undefined) ?? accountId
}
