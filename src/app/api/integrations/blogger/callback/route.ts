import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode, getDriveUserEmail } from '@/lib/google-drive'
import { BLOGGER_PROVIDER } from '@/lib/geo/blogger-token'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const back = (q: string) => NextResponse.redirect(`${appUrl}/marketing/geo-writer?blogger=${q}`)
  if (searchParams.get('error') || !code || !userId) return back('error')

  // state 只帶 user_id，必須確認目前登入的就是這個人
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return back('error')

  const tokens = await exchangeCode(code, `${appUrl}/api/integrations/blogger/callback`)
  if (tokens.error || !tokens.access_token) return back('error')

  const email = await getDriveUserEmail(tokens.access_token)
  const { error } = await supabase.from('user_integrations').upsert({
    user_id: userId,
    provider: BLOGGER_PROVIDER,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    email,
  }, { onConflict: 'user_id,provider' })
  return back(error ? 'error' : 'connected')
}
