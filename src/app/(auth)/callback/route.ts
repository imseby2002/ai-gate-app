import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SYSTEMS, isSystemKey, SUBDOMAIN_SYSTEM, SYSTEM_SUBDOMAIN } from '@/lib/systems'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const { searchParams, origin } = url
  const code = searchParams.get('code')
  // 系統判定優先序：跨子域 cookie(oauth_sys) > ?system > 子域名推斷。
  // cookie 不受 OAuth redirect 丟 query / fallback 到 Site URL 影響，最可靠。
  const cookieSys = request.cookies.get('oauth_sys')?.value
  const system = searchParams.get('system')
  const sub = url.host.split('.')[0]
  const sysKey = isSystemKey(cookieSys) ? cookieSys
    : isSystemKey(system) ? system
    : SUBDOMAIN_SYSTEM[sub]
  const next = searchParams.get('next') ?? (sysKey ? SYSTEMS[sysKey].home : '/apps')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[callback] exchangeCodeForSession 失敗:', error.message, { code: error.code, status: error.status })
    }
    if (!error) {
      // 功能頁落回對應子域：callback 可能落在 www，依系統重建子域 host。
      // session cookie 已設 domain=.im-tourist.com 跨子域共享，跳轉後仍保持登入。
      let base = origin
      if (sysKey && url.hostname.endsWith('im-tourist.com')) {
        const targetSub = SYSTEM_SUBDOMAIN[sysKey]
        if (targetSub) base = `https://${targetSub}.im-tourist.com`
      }
      // 用 ?_si= 把 system 傳給 client，由 ScopeManager 寫入 sessionStorage（per-tab）
      const redirectUrl = new URL(`${base}${next}`)
      if (sysKey) {
        redirectUrl.searchParams.set('_si', sysKey)
      }
      const res = NextResponse.redirect(redirectUrl.toString())
      // 用完即清除一次性 cookie（兩種 domain 都清，確保子域/主域都失效）
      res.cookies.set('oauth_sys', '', { path: '/', maxAge: 0 })
      res.cookies.set('oauth_sys', '', { path: '/', maxAge: 0, domain: '.im-tourist.com' })
      return res
    }
  }

  if (!code) {
    console.error('[callback] 缺少 code 參數', { url: request.url })
  }
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
