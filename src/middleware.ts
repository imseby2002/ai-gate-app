import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SYSTEMS, SCOPE_COOKIE, isSystemKey, isPathAllowedForScope, systemForPath } from '@/lib/systems'


export async function middleware(request: NextRequest) {
  // If env vars are missing, pass through without auth check
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const pathname = request.nextUrl.pathname

    // Public routes
    const isPublic =
      pathname === '/' ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/callback') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/billing/webhook') ||
      pathname.startsWith('/api/locale') ||
      pathname.startsWith('/api/auth/check-whitelist') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/api/health') ||
      pathname.startsWith('/api/marketing/cs-webhook') ||
      pathname.startsWith('/api/marketing/telegram-webhook')

    if (!user && !isPublic) {
      const redirectUrl = request.nextUrl.clone()
      // 導向該路徑所屬系統的登入頁；無對應則導向系統選擇頁
      const sys = systemForPath(pathname)
      redirectUrl.pathname = sys ? `/login/${sys}` : '/login'
      redirectUrl.search = ''
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // 系統範圍鎖定：從某系統登入後，session 被限定在該系統（管理員不受限）
    const scope = request.cookies.get(SCOPE_COOKIE)?.value
    const needsProfileCheck =
      (user && isSystemKey(scope)) ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/cli-proxy') ||
      pathname.startsWith('/marketing-auto') ||
      pathname.startsWith('/cs') ||
      pathname.startsWith('/prospect-call') ||
      pathname.startsWith('/resume')

    if (needsProfileCheck && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type, enabled_modules')
        .eq('id', user.id)
        .single()

      const isAdmin = profile?.user_type === 'admin'

      // Scope guard — 非管理員、且帶 scope cookie 時，限制只能存取該系統路徑
      if (!isAdmin && isSystemKey(scope) && !isPathAllowedForScope(scope, pathname)) {
        return NextResponse.redirect(new URL(SYSTEMS[scope].home, request.url))
      }

      // Module access — 非管理員：該功能必須在 enabled_modules 內（管理者可後台限制）
      // 只擋該系統的功能頁，不擋 /login 等共用路徑（避免無限導向）
      if (!isAdmin && isSystemKey(scope)) {
        const enabled = profile?.enabled_modules ?? ['chat', 'booking', 'cs', 'marketing', 'leads', 'resume']
        const inOwnSystem = SYSTEMS[scope].prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
        if (inOwnSystem && !enabled.includes(scope)) {
          return NextResponse.redirect(new URL(`/login/${scope}?denied=1`, request.url))
        }
      }

      // Admin guard — /admin 與 /cli-proxy 僅限總管理員
      if (!isAdmin && (pathname.startsWith('/admin') || pathname.startsWith('/cli-proxy'))) {
        const home = isSystemKey(scope) ? SYSTEMS[scope].home : '/dashboard'
        return NextResponse.redirect(new URL(home, request.url))
      }

      // Module guard — admin bypasses
      if (profile && profile.user_type !== 'admin') {
        const enabled: string[] = profile.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume']
        const ROUTE_MODULES: Record<string, string[]> = {
          '/marketing-auto': ['marketing', 'cs'],
          '/cs':             ['cs'],
          '/prospect-call':  ['leads'],
          '/resume':         ['resume'],
        }
        for (const [route, modules] of Object.entries(ROUTE_MODULES)) {
          if (pathname.startsWith(route)) {
            const hasAccess = modules.some(m => enabled.includes(m))
            if (!hasAccess) {
              return NextResponse.redirect(new URL('/dashboard?blocked=' + modules[0], request.url))
            }
          }
        }
      }
    }

    return supabaseResponse
  } catch (e) {
    // If proxy throws for any reason, pass through to Next.js
    console.error('[proxy] error:', e)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
