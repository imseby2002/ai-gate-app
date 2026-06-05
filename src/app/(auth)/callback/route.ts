import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SYSTEMS, isSystemKey } from '@/lib/systems'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const system = searchParams.get('system')
  const next = searchParams.get('next') ?? (isSystemKey(system) ? SYSTEMS[system].home : '/apps')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 用 ?_si= 把 system 傳給 client，由 ScopeManager 寫入 sessionStorage（per-tab）
      const redirectUrl = new URL(`${origin}${next}`)
      if (isSystemKey(system)) {
        redirectUrl.searchParams.set('_si', system)
      }
      return NextResponse.redirect(redirectUrl.toString())
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
