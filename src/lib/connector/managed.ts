// 方案二「AI-GATE 代管 AdsPower」共用：預設分組名稱與連接器設定
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserCompanyResources, companyMemberIds, defaultCompanyGroupName } from './company-resources'

export type ManagedStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'revoked'

/** 管理員未指定時的預設分組名稱，每位客人唯一 */
export function defaultManagedGroupName(userId: string) {
  return `AIGATE-${userId.replace(/-/g, '').slice(0, 8)}`
}

export type ConnectorSettings =
  | { mode: 'own'; group_name: null; env_quota: null; used_profiles: null }
  | { mode: 'managed'; group_name: string; env_quota: number; used_profiles: number | null }
  | { mode: 'suspended'; group_name: null; env_quota: 0; used_profiles: null }

/**
 * 連接器同步用：代管開通中固定使用指定分組（不自行建立），且設定檔數不超過額度。
 * 公司帳號優先套用公司共享代管（環境數為全公司合計，used_profiles 為全公司已建立數）；否則看個人代管。
 */
export async function getConnectorSettings(userId: string): Promise<ConnectorSettings> {
  const admin = createAdminClient()
  const company = await getUserCompanyResources(userId)
  const cr = company?.resources
  if (company && cr?.adspower_mode === 'managed' && cr.status !== 'inactive') {
    if (cr.status === 'suspended') return { mode: 'suspended', group_name: null, env_quota: 0, used_profiles: null }
    const members = await companyMemberIds(company.companyId)
    const { count } = members.length
      ? await admin
          .from('marketing_social_accounts')
          .select('id', { count: 'exact', head: true })
          .in('user_id', members)
          .not('adspower_profile_id', 'is', null)
      : { count: 0 }
    return {
      mode: 'managed',
      group_name: cr.group_name || defaultCompanyGroupName(company.companyId),
      env_quota: cr.env_quota,
      used_profiles: count ?? 0,
    }
  }

  const { data } = await admin
    .from('marketing_adspower_managed')
    .select('status, group_name, env_quota')
    .eq('user_id', userId)
    .maybeSingle()
  if (data?.status === 'active' && data.group_name) {
    return { mode: 'managed', group_name: data.group_name, env_quota: data.env_quota as number, used_profiles: null }
  }
  // 暫停中不交付任何設定檔，避免改用本機分組繼續建立
  if (data?.status === 'suspended') return { mode: 'suspended', group_name: null, env_quota: 0, used_profiles: null }
  return { mode: 'own', group_name: null, env_quota: null, used_profiles: null }
}
