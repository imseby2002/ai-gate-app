import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { systemForPath, SUBDOMAIN_SYSTEM } from '@/lib/systems'


export async function middleware(request: NextRequest) {
  // If env vars are missing, pass through without auth check
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    // im-tourist 多子域：auth cookie 設 domain=.im-tourist.com 跨子域共享。localhost/preview 不設。
    const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
    const cookieDomain = host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        ...(cookieDomain ? { cookieOptions: { domain: cookieDomain } } : {}),
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
    const sub = host.split('.')[0]
    const SUBDOMAIN_HOME: Record<string, string> = {
      cs:        '/cs',            // 客服系統
      booking:   '/booking',       // 訂房系統
      marketing: '/marketing-auto',// 行銷系統
      chat:      '/apps',          // 對話系統（功能選單）
      work:      '/resume',        // 工作系統
      www:       '/dashboard',     // owner 主控台
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
      pathname.startsWith('/book/') ||
      pathname.startsWith('/api/book/') ||
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
      // 導向登入頁：優先依「子域名」決定系統（避免 /marketing-auto 路徑反查歧義），
      // 無對應子域時才退回依路徑反查；都無則導向系統選擇頁
      const sys = SUBDOMAIN_SYSTEM[sub] ?? systemForPath(pathname)
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
      pathname.startsWith('/dashboard') ||
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

      // Admin/Owner guard — /admin、/cli-proxy、/dashboard 僅限總管理員
      // 非管理者一律導向 /apps（功能選單），用 nextUrl 保留原始 host（含子域名）
      if (!isAdmin && (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/cli-proxy') ||
        pathname.startsWith('/dashboard')
      )) {
        const url = request.nextUrl.clone()
        url.pathname = '/apps'
        url.search = ''
        return NextResponse.redirect(url)
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
              const url = request.nextUrl.clone()
              url.pathname = '/apps'
              url.search = '?blocked=' + modules[0]
              return NextResponse.redirect(url)
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
