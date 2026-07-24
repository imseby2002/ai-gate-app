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

  const redirectUri = `${appUrl}/api/integrations/google-calendar/callback`
  const tokens = await exchangeCode(code, redirectUri)
  if (tokens.error || !tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/settings?calendar=error`)
  }

  const email = await getCalendarUserEmail(tokens.access_token)
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const supabase = await createClient()
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
