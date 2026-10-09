// 非永久權杖自動更新（由 /api/cron/refresh-tokens 每小時執行）
// 只處理「會過期、且平台提供更新機制」的憑證，更新結果直接寫回 social_platform_credentials.credentials
// 與公司官方帳號 channel_accounts.credentials（Zalo OA）：
//   Zalo（行銷 'Zalo'、客服 'zalo'）  access token 約 25 小時；用 refresh token 換新（refresh token 單次有效，會一併換新）
//     https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
//   TikTok                           access token 24 小時；refresh token 365 天
//     https://developers.tiktok.com/doc/oauth-user-access-token-management
//   Threads                          長期權杖 60 天；用權杖本身換新（需已發出 24 小時以上）
//     https://developers.facebook.com/docs/threads/get-started/long-lived-tokens
//   LinkedIn                         60 天；僅 LinkedIn 開放 refresh token 的應用程式可用
//     https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens
// 不需處理：Meta 粉專／系統使用者權杖（永不過期）、LINE 長期權杖、X（OAuth 1.0a）、GA4（每次以金鑰簽章）、
//           YouTube（每次上傳時已用 refresh token 換 access token）。
import { createAdminClient } from '@/lib/supabase/admin'

type Creds = Record<string, string>
type Patch = Record<string, string>

const HOUR = 3600_000
const DAY = 24 * HOUR

const expiresSoon = (c: Creds, within: number) => {
  const t = Date.parse(c.token_expires_at ?? '')
  return !Number.isFinite(t) || t - Date.now() < within
}
const isoIn = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString()

async function refreshZalo(appId: string, secretKey: string, refreshToken: string) {
  const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: secretKey },
    body: new URLSearchParams({ app_id: appId, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const d = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: string | number; error?: number; error_name?: string; error_description?: string; message?: string }
  if (!d.access_token || !d.refresh_token) throw new Error(`Zalo 權杖更新失敗：${d.error_description ?? d.message ?? d.error_name ?? res.status}`)
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: Number(d.expires_in) || 90000 }
}

interface Refresher {
  platform: string
  /** 回傳 null 表示這筆不需要（或無法）更新 */
  run(c: Creds): Promise<Patch | null>
}

const REFRESHERS: Refresher[] = [
  {
    platform: 'Zalo',
    async run(c) {
      if (!c.app_id || !c.secret_key || !c.refresh_token || !expiresSoon(c, 6 * HOUR)) return null
      const r = await refreshZalo(c.app_id, c.secret_key, c.refresh_token)
      return { access_token: r.accessToken, refresh_token: r.refreshToken, token_expires_at: isoIn(r.expiresIn) }
    },
  },
  {
    platform: 'zalo',
    async run(c) {
      if (!c.zalo_app_id || !c.zalo_secret_key || !c.zalo_refresh_token || !expiresSoon(c, 6 * HOUR)) return null
      const r = await refreshZalo(c.zalo_app_id, c.zalo_secret_key, c.zalo_refresh_token)
      return { zalo_oa_access_token: r.accessToken, zalo_refresh_token: r.refreshToken, token_expires_at: isoIn(r.expiresIn) }
    },
  },
  {
    platform: 'TikTok',
    async run(c) {
      if (!c.client_key || !c.client_secret || !c.refresh_token || !expiresSoon(c, 6 * HOUR)) return null
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: c.client_key, client_secret: c.client_secret,
          grant_type: 'refresh_token', refresh_token: c.refresh_token,
        }),
      })
      const d = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }
      if (!d.access_token) throw new Error(`TikTok 權杖更新失敗：${d.error_description ?? d.error ?? res.status}`)
      return {
        access_token: d.access_token,
        ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}),
        token_expires_at: isoIn(d.expires_in ?? 86400),
      }
    },
  },
  {
    platform: 'Threads',
    async run(c): Promise<Patch | null> {
      if (!c.access_token) return null
      const last = Date.parse(c.token_refreshed_at ?? '')
      // 第一次看到這組權杖：只記錄時間（剛發出的權杖未滿 24 小時不能更新），7 天後再換新
      if (!Number.isFinite(last)) return { token_refreshed_at: new Date().toISOString() }
      if (Date.now() - last < 7 * DAY) return null
      const res = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(c.access_token)}`)
      const d = await res.json() as { access_token?: string; expires_in?: number; error?: { message?: string } }
      if (!d.access_token) throw new Error(`Threads 權杖更新失敗：${d.error?.message ?? res.status}`)
      return { access_token: d.access_token, token_expires_at: isoIn(d.expires_in ?? 60 * 86400) }
    },
  },
  {
    platform: 'LinkedIn',
    async run(c) {
      if (!c.client_id || !c.client_secret || !c.refresh_token || !expiresSoon(c, 7 * DAY)) return null
      const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token', refresh_token: c.refresh_token,
          client_id: c.client_id, client_secret: c.client_secret,
        }),
      })
      const d = await res.json() as { access_token?: string; expires_in?: number; refresh_token?: string; error_description?: string; error?: string }
      if (!d.access_token) throw new Error(`LinkedIn 權杖更新失敗：${d.error_description ?? d.error ?? res.status}`)
      return {
        access_token: d.access_token,
        ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}),
        token_expires_at: isoIn(d.expires_in ?? 60 * 86400),
      }
    },
  },
]

export interface RefreshResult { userId: string; platform: string; ok: boolean; error?: string }

// 公司「官方帳號」（channel_accounts）中可自動更新的平台；欄位與客服 'zalo' 列相同
const CHANNEL_REFRESHERS: Record<string, Refresher | undefined> = {
  zalo_oa: REFRESHERS.find(r => r.platform === 'zalo'),
}

async function runRefresher(refresher: Refresher, creds: Creds): Promise<{ patch: Patch | null; error?: string }> {
  try {
    let patch = await refresher.run(creds)
    if (!patch) return { patch: null }
    patch = { ...patch, last_refresh_error: '' }
    if (patch.access_token || patch.zalo_oa_access_token) patch.token_refreshed_at = new Date().toISOString()
    return { patch }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { patch: { last_refresh_error: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${error}`.slice(0, 300) }, error }
  }
}

export async function refreshExpiringTokens(): Promise<RefreshResult[]> {
  const admin = createAdminClient()
  const results: RefreshResult[] = []

  // 1) 公司官方帳號
  const { data: accounts } = await admin
    .from('channel_accounts')
    .select('id, platform, credentials')
    .in('platform', Object.keys(CHANNEL_REFRESHERS))
    .eq('is_connected', true)
  // Refresh Token 單次有效：同一組 refresh token 若也存在舊設定裡，只在官方帳號這邊更新
  const handledRefreshTokens = new Set<string>()
  for (const a of accounts ?? []) {
    const refresher = CHANNEL_REFRESHERS[a.platform as string]
    const creds = (a.credentials ?? {}) as Creds
    if (!refresher) continue
    if (creds.zalo_refresh_token) handledRefreshTokens.add(creds.zalo_refresh_token)
    const { patch, error } = await runRefresher(refresher, creds)
    if (!patch) continue
    const { error: dbErr } = await admin
      .from('channel_accounts')
      .update({ credentials: { ...creds, ...patch }, updated_at: new Date().toISOString() })
      .eq('id', a.id)
    results.push({ userId: `channel:${a.id}`, platform: a.platform as string, ok: !error && !dbErr, error: error ?? dbErr?.message })
  }

  // 2) 舊設定 social_platform_credentials
  const { data: rows } = await admin
    .from('social_platform_credentials')
    .select('user_id, platform, credentials')
    .in('platform', REFRESHERS.map(r => r.platform))
    .eq('is_connected', true)

  for (const row of rows ?? []) {
    const refresher = REFRESHERS.find(r => r.platform === row.platform)
    const creds = (row.credentials ?? {}) as Creds
    if (!refresher) continue
    const rt = creds.zalo_refresh_token || (row.platform === 'Zalo' ? creds.refresh_token : '')
    if (rt && handledRefreshTokens.has(rt)) continue
    const { patch, error } = await runRefresher(refresher, creds)
    if (!patch) continue
    const { error: dbErr } = await admin
      .from('social_platform_credentials')
      .update({ credentials: { ...creds, ...patch } })
      .eq('user_id', row.user_id)
      .eq('platform', row.platform)
    results.push({ userId: row.user_id as string, platform: row.platform as string, ok: !error && !dbErr, error: error ?? dbErr?.message })
  }
  return results
}
