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

    // ── 子域名映射 ────────────────────────────────────────────
    // cs.im-tourist.com / → /cs 首頁；功能內 /cs/* 路徑在該子域名下照常運作。
    const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
    const sub = host.split('.')[0]
    const SUBDOMAIN_HOME: Record<string, string> = {
      cs:        '/cs',
      marketing: '/marketing-auto',
      booking:   '/booking',
    }
    const subHome = SUBDOMAIN_HOME[sub]
    const rawPath = request.nextUrl.pathname
    // 子域名根路徑才改寫；其餘路徑（含 /api、/_next、/cs/* 等）維持原樣
    const needSubRewrite = !!subHome && rawPath === '/'
    // 後續 auth / guard 一律用「映射後」的路徑判斷
    const pathname = needSubRewrite ? subHome! : rawPath

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
          '/prospect-call':  ['leads', 'marketing'],
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

    // 子域名根路徑：改寫到對應功能首頁（沿用已通過 auth 的 cookies）
    if (needSubRewrite) {
      const url = request.nextUrl.clone()
      url.pathname = subHome!
      const rewriteRes = NextResponse.rewrite(url, { request })
      supabaseResponse.cookies.getAll().forEach(c => rewriteRes.cookies.set(c))
      return rewriteRes
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
