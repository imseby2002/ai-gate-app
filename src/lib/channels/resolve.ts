// 發送／收訊時取得官方帳號憑證（伺服器端）。
// 舊程式以「帳號擁有者 ownerId + 平台代號」讀 social_platform_credentials；
// 改為先找該公司在「官方帳號」設定、且指定給此模組的帳號，找不到再退回舊設定：
//   1. 公司官方帳號中，平台相符、已連線、modules 含 module 的帳號（最早建立的那組）
//   2. 舊設定 social_platform_credentials（ownerId + 原平台代號）
//   3. 公司官方帳號中，平台相符、已連線的任一帳號（未指定 module，或該模組尚未設定時）
import { createAdminClient } from '@/lib/supabase/admin'
import type { ChannelModuleId } from './platforms'

type Creds = Record<string, string>

// 舊平台代號 → 官方帳號平台 id
const LEGACY_TO_PLATFORM: Record<string, string> = {
  zalo: 'zalo_oa', 'zalo-oa': 'zalo_oa',
  line: 'line_oa', 'line-oa': 'line_oa',
  whatsapp: 'whatsapp_business', 'whatsapp-biz': 'whatsapp_business',
  messenger: 'messenger',
  instagram: 'instagram',
  telegram: 'telegram',
}

export function channelPlatformOf(legacyPlatform: string): string | null {
  return LEGACY_TO_PLATFORM[legacyPlatform] ?? null
}

// 帳號擁有者所屬公司：只認公司負責人（owner，一人限一家）。
// 各模組的資料歸屬 ownerId 都是公司 owner；不是 owner 的個人帳號維持只用自己的舊設定。
async function companyOfOwner(admin: ReturnType<typeof createAdminClient>, ownerId: string): Promise<string | null> {
  const { data: m } = await admin.from('company_members')
    .select('company_id').eq('member_id', ownerId).eq('role', 'owner').eq('status', 'active').maybeSingle()
  return (m?.company_id as string | null) ?? null
}

async function loadLegacy(admin: ReturnType<typeof createAdminClient>, ownerId: string, legacyPlatform: string): Promise<Creds | null> {
  const { data } = await admin.from('social_platform_credentials')
    .select('credentials').eq('user_id', ownerId).eq('platform', legacyPlatform).maybeSingle()
  const c = (data?.credentials ?? null) as Creds | null
  return c && Object.keys(c).length ? c : null
}

/** 只查公司官方帳號（不退回舊設定）：指定給 module 的已連線帳號，沒有則回 null */
export async function findModuleChannelCredentials(
  ownerId: string,
  legacyPlatform: string,
  module: ChannelModuleId,
): Promise<Creds | null> {
  const admin = createAdminClient()
  const platform = channelPlatformOf(legacyPlatform)
  if (!platform) return null
  const companyId = await companyOfOwner(admin, ownerId)
  if (!companyId) return null
  const { data } = await admin.from('channel_accounts')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('platform', platform)
    .eq('is_connected', true)
    .contains('modules', [module])
    .order('created_at')
    .limit(1)
  return (data?.[0]?.credentials as Creds | undefined) ?? null
}

export async function loadChannelCredentials(
  ownerId: string,
  legacyPlatform: string,
  module?: ChannelModuleId,
): Promise<Creds> {
  const admin = createAdminClient()
  const platform = channelPlatformOf(legacyPlatform)

  let accounts: { credentials: Creds; modules: string[] }[] = []
  if (platform) {
    const companyId = await companyOfOwner(admin, ownerId)
    if (companyId) {
      const { data } = await admin.from('channel_accounts')
        .select('credentials, modules')
        .eq('company_id', companyId)
        .eq('platform', platform)
        .eq('is_connected', true)
        .order('created_at')
      accounts = (data ?? []) as typeof accounts
    }
  }

  if (module) {
    const hit = accounts.find(a => a.modules?.includes(module))
    if (hit) return hit.credentials ?? {}
  }
  const legacy = await loadLegacy(admin, ownerId, legacyPlatform)
  if (legacy) return legacy
  return accounts[0]?.credentials ?? {}
}
