/**
 * Zalo ZNS 設定：優先用公司「官方帳號」中指定給行銷的 Zalo OA（OA Access Token、ZNS Template ID）；
 * 未設定時沿用舊設定——每個使用者在「行銷自動化 → 平台設定 → Zalo OA」自行填寫，存在 social_platform_credentials。
 *   - Access Token：'Zalo' 列的 access_token（有填 App ID / Secret Key / Refresh Token 時由 cron 自動更新）
 *                   未填則沿用客服頻道 'zalo' 列的 zalo_oa_access_token
 *   - 範本 ID：'Zalo' 列的 zns_template_id
 * 使用者未設定時退回系統 env（ZALO_ZNS_ACCESS_TOKEN / ZALO_OA_ACCESS_TOKEN / ZALO_ZNS_TEMPLATE_ID）。
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { findModuleChannelCredentials } from '@/lib/channels/resolve'

export interface ZaloZnsConfig {
  accessToken?: string
  templateId?: string
}

export async function getZaloZnsConfig(ownerId?: string | null): Promise<ZaloZnsConfig> {
  let accessToken: string | undefined
  let templateId: string | undefined

  if (ownerId) {
    // 公司「官方帳號」中指定給行銷的 Zalo OA 優先
    const acct = await findModuleChannelCredentials(ownerId, 'zalo', 'marketing')
    if (acct?.zalo_oa_access_token) {
      accessToken = acct.zalo_oa_access_token.trim()
      templateId = acct.zns_template_id?.trim() || undefined
    }
  }

  if (ownerId && !accessToken) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('social_platform_credentials')
      .select('platform, credentials')
      .eq('user_id', ownerId)
      .in('platform', ['Zalo', 'zalo'])
    const byPlatform = Object.fromEntries(
      (data ?? []).map(r => [r.platform, (r.credentials ?? {}) as Record<string, string>]),
    )
    accessToken = byPlatform.Zalo?.access_token?.trim() || byPlatform.zalo?.zalo_oa_access_token?.trim() || undefined
    templateId = byPlatform.Zalo?.zns_template_id?.trim() || undefined
  }

  return {
    accessToken: accessToken || process.env.ZALO_ZNS_ACCESS_TOKEN || process.env.ZALO_OA_ACCESS_TOKEN || undefined,
    templateId: templateId || process.env.ZALO_ZNS_TEMPLATE_ID || undefined,
  }
}
