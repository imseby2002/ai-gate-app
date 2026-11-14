import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBloggerOAuthUrl } from '@/lib/geo/blogger-token'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  try {
    return NextResponse.redirect(getBloggerOAuthUrl(`${appUrl}/api/integrations/blogger/callback`, user.id))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.redirect(`${appUrl}/marketing/geo-writer?blogger_error=${encodeURIComponent(msg)}`)
  }
}
