// 注意：這裡刻意用 service-role admin client，不是 @/lib/supabase/server 的
// cookie-based createClient()。這個 helper 主要供 agent 工具（背景 cron 執行，
// 沒有使用者 session cookie）呼叫，若改用 cookie-based client 在 cron context
// 下會因為沒有登入 session 而讀不到資料（RLS 擋下）。
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAccessToken } from '@/lib/google-drive'

export async function getValidCalendarAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
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
    .eq('provider', 'google_calendar')

  return newToken
}
