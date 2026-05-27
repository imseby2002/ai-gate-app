import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SYSTEMS, SCOPE_COOKIE, isSystemKey } from '@/lib/systems'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const system = searchParams.get('system')
  const next = searchParams.get('next') ?? (isSystemKey(system) ? SYSTEMS[system].home : '/dashboard')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`)
      // 透過某系統登入 → 限定該系統
      if (isSystemKey(system)) {
        res.cookies.set(SCOPE_COOKIE, system, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
      }
      return res
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
