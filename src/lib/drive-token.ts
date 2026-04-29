import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/google-drive'

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .eq('provider', 'google_drive')
    .single()

  if (!data) return null

  const expired = !data.token_expiry || new Date(data.token_expiry) < new Date(Date.now() + 60_000)
  if (!expired) return data.access_token

  if (!data.refresh_token) return null
  const newToken = await refreshAccessToken(data.refresh_token)
  if (!newToken) return null

  const expiry = new Date(Date.now() + 3600 * 1000).toISOString()
  await supabase
    .from('user_integrations')
    .update({ access_token: newToken, token_expiry: expiry })
    .eq('user_id', userId)
    .eq('provider', 'google_drive')

  return newToken
}
