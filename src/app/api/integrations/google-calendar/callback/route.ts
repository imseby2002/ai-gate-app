import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode, getCalendarUserEmail } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/settings?calendar=error`)
  }

  // state 只是明碼帶著要綁定的 user_id，不是防 CSRF 的隨機值，所以這裡必須明確驗證
  // 目前登入的 session 就是 state 宣稱的那個人，不能只靠 RLS 的 auth.uid()=user_id
  // 順帶擋掉（那是意外的保護，不是設計上的檢查，未來若改用 admin client 就會失效）。
  const supabase = await createClient()
  const { data: { user: sessionUser } } = await supabase.auth.getUser()
  if (!sessionUser || sessionUser.id !== userId) {
    return NextResponse.redirect(`${appUrl}/settings?calendar=error`)
  }

  const redirectUri = `${appUrl}/api/integrations/google-calendar/callback`
  const tokens = await exchangeCode(code, redirectUri)
  if (tokens.error || !tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?calendar=error`)
  }

  const email = await getCalendarUserEmail(tokens.access_token)
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: dbErr } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: userId,
      provider: 'google_calendar',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry,
      email,
    }, { onConflict: 'user_id,provider' })

  if (dbErr) return NextResponse.redirect(`${appUrl}/settings?calendar=error`)
  return NextResponse.redirect(`${appUrl}/settings?calendar=connected`)
}
