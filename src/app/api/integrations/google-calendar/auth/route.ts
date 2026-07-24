import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarOAuthUrl } from '@/lib/google-calendar'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`
  try {
    const url = getCalendarOAuthUrl(redirectUri, user.id)
    return NextResponse.redirect(url)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?calendar_error=${encodeURIComponent(msg)}`
    )
  }
}
