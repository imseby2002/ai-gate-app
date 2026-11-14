// Blogger OAuth：沿用 google-drive 的 token 交換／刷新，存進 user_integrations provider='google_blogger'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAccessToken } from '@/lib/google-drive'

export const BLOGGER_PROVIDER = 'google_blogger'

export function getBloggerOAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID 未設定')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/blogger email',
    access_type: 'offline',
    prompt: 'select_account consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function getValidBloggerAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .eq('provider', BLOGGER_PROVIDER)
    .maybeSingle()
  if (!data) return null
  const expired = !data.token_expiry || new Date(data.token_expiry) < new Date(Date.now() + 60_000)
  if (!expired) return data.access_token
  if (!data.refresh_token) return null
  const token = await refreshAccessToken(data.refresh_token)
  if (!token) return null
  await supabase.from('user_integrations')
    .update({ access_token: token, token_expiry: new Date(Date.now() + 3600_000).toISOString() })
    .eq('user_id', userId).eq('provider', BLOGGER_PROVIDER)
  return token
}
