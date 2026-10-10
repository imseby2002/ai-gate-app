// 發送／收訊時取得官方帳號憑證（伺服器端）。
// 舊程式以「帳號擁有者 ownerId + 平台代號」讀 social_platform_credentials；
// 改為先找該公司在「官方帳號」設定、且指定給此模組的帳號，找不到再退回舊設定：
//   1. 模組在「使用哪個帳號」選定的帳號（channel_module_bindings）；
//      沒選時用平台相符、已連線、modules 含 module 的帳號（最早建立的那組）
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
  const { data: binding } = await admin.from('channel_module_bindings').select('account_id')
    .eq('company_id', companyId).eq('module', module).eq('platform', platform).maybeSingle()
  if (binding?.account_id) {
    const { data: bound } = await admin.from('channel_accounts').select('credentials')
      .eq('id', binding.account_id).eq('is_connected', true).maybeSingle()
    if (bound) return (bound.credentials as Creds) ?? {}
  }
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

  let accounts: { id: string; credentials: Creds; modules: string[] }[] = []
  let boundId: string | null = null
  if (platform) {
    const companyId = await companyOfOwner(admin, ownerId)
    if (companyId) {
      const [{ data }, { data: binding }] = await Promise.all([
        admin.from('channel_accounts')
          .select('id, credentials, modules')
          .eq('company_id', companyId)
          .eq('platform', platform)
          .eq('is_connected', true)
          .order('created_at'),
        module
          ? admin.from('channel_module_bindings').select('account_id')
            .eq('company_id', companyId).eq('module', module).eq('platform', platform).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      accounts = (data ?? []) as typeof accounts
      boundId = (binding?.account_id as string | undefined) ?? null
    }
  }

  if (module) {
    // 模組明確選用的帳號優先，其次是有勾選此模組的帳號
    const hit = accounts.find(a => a.id === boundId) ?? accounts.find(a => a.modules?.includes(module))
    if (hit) return hit.credentials ?? {}
  }
  const legacy = await loadLegacy(admin, ownerId, legacyPlatform)
  if (legacy) return legacy
  return accounts[0]?.credentials ?? {}
}

// 行銷發文：公司官方帳號中選給行銷的帳號，轉成發文程式（publish.ts）使用的平台名稱與欄位。
// 只回傳發文必要欄位齊全的平台；缺欄位的平台維持用行銷「平台設定」的舊憑證。
export async function loadMarketingPublishOverrides(ownerId: string): Promise<Record<string, Creds>> {
  const out: Record<string, Creds> = {}
  const [fb, ig, line, zalo] = await Promise.all([
    findModuleChannelCredentials(ownerId, 'messenger', 'marketing'),
    findModuleChannelCredentials(ownerId, 'instagram', 'marketing'),
    findModuleChannelCredentials(ownerId, 'line', 'marketing'),
    findModuleChannelCredentials(ownerId, 'zalo', 'marketing'),
  ])
  if (fb?.fb_page_access_token && fb.fb_page_id) out.Facebook = { page_access_token: fb.fb_page_access_token, page_id: fb.fb_page_id }
  if (ig?.ig_access_token && ig.ig_user_id) out.Instagram = { access_token: ig.ig_access_token, ig_user_id: ig.ig_user_id }
  if (line?.line_channel_access_token) out['LINE VOOM'] = { line_channel_access_token: line.line_channel_access_token }
  if (zalo?.zalo_oa_access_token && zalo.zalo_oa_id) out.Zalo = { access_token: zalo.zalo_oa_access_token, oa_id: zalo.zalo_oa_id }
  return out
}
