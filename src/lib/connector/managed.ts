// 方案二「AI-GATE 代管 AdsPower」共用：預設分組名稱與連接器設定
import { createAdminClient } from '@/lib/supabase/admin'

export type ManagedStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'revoked'

/** 管理員未指定時的預設分組名稱，每位客人唯一 */
export function defaultManagedGroupName(userId: string) {
  return `AIGATE-${userId.replace(/-/g, '').slice(0, 8)}`
}

/** 連接器同步用：代管開通中的客人固定使用指定分組（不自行建立），且設定檔數不超過額度包 */
export async function getConnectorSettings(userId: string) {
  const { data } = await createAdminClient()
    .from('marketing_adspower_managed')
    .select('status, group_name, env_quota')
    .eq('user_id', userId)
    .maybeSingle()
  if (data?.status === 'active' && data.group_name) {
    return { mode: 'managed' as const, group_name: data.group_name, env_quota: data.env_quota as number }
  }
  // 暫停中不交付任何設定檔，避免改用本機分組繼續建立
  if (data?.status === 'suspended') return { mode: 'suspended' as const, group_name: null, env_quota: 0 }
  return { mode: 'own' as const, group_name: null, env_quota: null }
}
