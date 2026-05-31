import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { systemForPath } from '@/lib/systems'


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

    // scope guard 已移至 client-side ScopeManager（sessionStorage per-tab）
    // 這裡只保留 admin guard 和 module guard
    const needsProfileCheck = user && (
      pathname.startsWith('/admin') ||
      pathname.startsWith('/cli-proxy') ||
      pathname.startsWith('/marketing-auto') ||
      pathname.startsWith('/cs') ||
      pathname.startsWith('/prospect-call') ||
      pathname.startsWith('/resume')
    )

    if (needsProfileCheck) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type, enabled_modules')
        .eq('id', user.id)
        .single()

      const isAdmin = profile?.user_type === 'admin'

      // Admin guard — /admin 與 /cli-proxy 僅限總管理員
      if (!isAdmin && (pathname.startsWith('/admin') || pathname.startsWith('/cli-proxy'))) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // Module guard — 檢查 enabled_modules，admin 跳過
      if (profile && !isAdmin) {
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
