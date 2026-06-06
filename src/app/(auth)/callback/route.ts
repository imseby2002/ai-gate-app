import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SYSTEMS, isSystemKey, SUBDOMAIN_SYSTEM } from '@/lib/systems'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const { searchParams, origin } = url
  const code = searchParams.get('code')
  // ?system= 在 OAuth 來回可能遺失 → 退回用子域名推斷所屬系統，避免錯誤落到 /apps
  const system = searchParams.get('system')
  const sub = url.host.split('.')[0]
  const sysKey = isSystemKey(system) ? system : SUBDOMAIN_SYSTEM[sub]
  const next = searchParams.get('next') ?? (sysKey ? SYSTEMS[sysKey].home : '/apps')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 用 ?_si= 把 system 傳給 client，由 ScopeManager 寫入 sessionStorage（per-tab）
      const redirectUrl = new URL(`${origin}${next}`)
      if (sysKey) {
        redirectUrl.searchParams.set('_si', sysKey)
      }
      return NextResponse.redirect(redirectUrl.toString())
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
