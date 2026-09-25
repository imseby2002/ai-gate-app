import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { systemForPath, SUBDOMAIN_SYSTEM, SYSTEM_SUBDOMAIN, isPathAllowedForScope } from '@/lib/systems'
import { detectLocaleFromAcceptLanguage } from '@/i18n/request'


export async function middleware(request: NextRequest) {
  // If env vars are missing, pass through without auth check
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  // Next.js 的連結預先載入（prefetch）會在畫面渲染時，對畫面上每個連結各發一次請求。
  // 一個頁面有好幾個連結時，這些 prefetch 幾乎同時抵達，每次都會呼叫 getUser()
  // 嘗試刷新 token，變成好幾個請求同時搶用同一組（一次性）refresh token，
  // 觸發 Supabase 的 rate limit。Prefetch 本來就是「猜測性」載入，之後真的
  // 點擊時 middleware 還是會照常執行一次，這裡跳過不影響正確性。
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('sec-purpose') === 'prefetch'
  if (isPrefetch) {
    return NextResponse.next({ request })
  }

  try {
    // im-tourist 多子域：auth cookie 設 domain=.im-tourist.com 跨子域共享。localhost/preview 不設。
    const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
    const cookieDomain = host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined

    // 若瀏覽器/客戶端尚未設定 locale cookie，自動依 Accept-Language 偵測其系統語言並持久化
    const hasLocaleCookie = request.cookies.has('locale')
    const detectedLocale = hasLocaleCookie ? null : detectLocaleFromAcceptLanguage(request.headers.get('accept-language'))
    const attachLocaleCookie = (res: NextResponse) => {
      if (detectedLocale) {
        res.cookies.set('locale', detectedLocale, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
          ...(cookieDomain ? { domain: cookieDomain } : {})
        })
      }
      return res
    }

    // ── 子域名映射 ────────────────────────────────────────────
    // cs.im-tourist.com / → /cs 首頁；功能內 /cs/* 路徑在該子域名下照常運作。
    const sub = host.split('.')[0]
    const SUBDOMAIN_HOME: Record<string, string> = {
      cs:        '/cs',            // 客服系統
      booking:   '/booking',       // 訂房系統
      marketing: '/marketing',     // 行銷中心（多工具入口，非單一自動化行銷頁）
      chat:      '/apps',          // 對話系統（功能選單）
      work:      '/office',        // 公司辦公系統（首頁為 /office，絕不到 /work）
      office:    '/office',        // 辦公系統
      agent:     '/agent',         // AI Agent 系統
      www:       '/dashboard',     // owner 主控台
      esim:      '/esim',          // eSIM 出國上網商城
    }
    const subHome = SUBDOMAIN_HOME[sub]
    const rawPath = request.nextUrl.pathname
    // 子域名根路徑才改寫；其餘路徑（含 /api、/_next、/cs/* 等）維持原樣
    const needSubRewrite = !!subHome && rawPath === '/'
    // 後續 auth / guard 一律用「映射後」的路徑判斷
    const pathname = needSubRewrite ? subHome! : rawPath

    // ── 子網域與路徑系統一致性 ──────────────────────────
    // 功能子網域下打開「別的系統」的頁面（如 cs.im-tourist.com/booking/daily）
    // 時，redirect 到該系統的正確子網域，讓網址列永遠跟介面一致。
    // 非 admin 有 client 端 scope 鎖擋著；admin 不受 scope 鎖，特別容易撞到。
    // 共用路徑（/settings、/team、/api、/login 等）與查不出所屬系統的路徑不動。
    const subSys = cookieDomain ? SUBDOMAIN_SYSTEM[sub] : undefined
    if (subSys && !isPathAllowedForScope(subSys, pathname)) {
      const targetSys = systemForPath(pathname)
      const targetSub = targetSys && targetSys !== subSys ? SYSTEM_SUBDOMAIN[targetSys] : undefined
      if (targetSub) {
        const url = request.nextUrl.clone()
        url.hostname = `${targetSub}.im-tourist.com`
        url.port = ''
        return attachLocaleCookie(NextResponse.redirect(url))
      }
    }

    // 行銷中心介紹頁只在 marketing 子網域提供：
    // - /intro/*（功能詳解、方案比較）為行銷專屬，其他子網域一律導到 marketing
    // - /intro 在系統子網域（如 cs）由 page.tsx 依子網域顯示各自廣告頁；非系統網域（www、主網域）導到 marketing
    const isMarketingIntroPath = pathname.startsWith('/intro/') || (pathname === '/intro' && !SUBDOMAIN_SYSTEM[sub])
    if (cookieDomain && sub !== 'marketing' && isMarketingIntroPath) {
      const url = request.nextUrl.clone()
      url.hostname = 'marketing.im-tourist.com'
      url.port = ''
      return attachLocaleCookie(NextResponse.redirect(url, 308))
    }

    // Public routes
    const isPublic =
      pathname === '/' ||
      pathname.startsWith('/intro') ||
      pathname.startsWith('/esim') ||
      pathname.startsWith('/api/esim') ||
      pathname.startsWith('/book/') ||
      pathname.startsWith('/api/book/') ||
      pathname.startsWith('/apply') ||
      pathname.startsWith('/payslip') ||
      pathname.startsWith('/vendor/') ||
      pathname.startsWith('/shift/') ||
      pathname.startsWith('/f/') ||
      pathname.startsWith('/api/shift/fill/') ||
      pathname.startsWith('/api/worker/') ||
      pathname.startsWith('/geo/') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/callback') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/cron/') ||
      pathname.startsWith('/manifest') ||
      pathname === '/sw.js' ||
      pathname.startsWith('/pay/') ||
      pathname.startsWith('/api/billing/webhook') ||
      pathname.startsWith('/api/locale') ||
      pathname.startsWith('/api/auth/check-whitelist') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/api/health') ||
      pathname.startsWith('/pos/kiosk') ||
      pathname.startsWith('/api/pos/sync') ||
      pathname.startsWith('/api/pos/orders') ||
      pathname.startsWith('/api/pos/terminals') ||
      pathname.startsWith('/api/marketing/cs-webhook') ||
      pathname.startsWith('/api/marketing/telegram-webhook')

    // API 呼叫一律不在 middleware 做驗證：每支 API route 自己會用
    // lib/supabase/server.ts 的 createClient() 檢查登入狀態，middleware 這裡
    // 完全是多餘的。一個頁面同時載入時可能夾帶幾十個 API 請求，每個都在
    // middleware 呼叫 getUser()（觸發 token 刷新）會同時搶用同一組
    // （一次性）refresh token，是先前 rate limit 風暴的主因。
    if (pathname.startsWith('/api/')) {
      return NextResponse.next({ request })
    }

    // 公開頁面不需要知道使用者是誰，略過 getUser()（同樣是為了不讓每個
    // manifest/sw.js/靜態頁請求都各自觸發一次 token 刷新）。
    if (isPublic) {
      if (needSubRewrite) {
        const url = request.nextUrl.clone()
        url.pathname = subHome!
        return attachLocaleCookie(NextResponse.rewrite(url, { request }))
      }
      return attachLocaleCookie(NextResponse.next({ request }))
    }

    let supabaseResponse = NextResponse.next({ request })

    // 這裡是伺服器端呼叫 Supabase（不是瀏覽器直接呼叫），Supabase 預設看到的 IP
    // 會是 Vercel 自己的出口 IP，等於全站所有使用者共用同一組 rate limit 額度。
    // 轉發真實客戶端 IP，讓限流以實際使用者為單位計算。
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        ...(cookieDomain ? { cookieOptions: { domain: cookieDomain } } : {}),
        ...(clientIp ? { global: { headers: { 'Sb-Forwarded-For': clientIp } } } : {}),
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

    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      // 導向登入頁：優先依「子域名」決定系統（避免 /marketing-auto 路徑反查歧義），
      // 無對應子域時才退回依路徑反查；都無則導向系統選擇頁
      const sys = SUBDOMAIN_SYSTEM[sub] ?? systemForPath(pathname)
      redirectUrl.pathname = sys ? `/login/${sys}` : '/login'
      redirectUrl.search = ''
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return attachLocaleCookie(NextResponse.redirect(redirectUrl))
    }

    // scope guard 已移至 client-side ScopeManager（sessionStorage per-tab）
    // 這裡只保留 admin guard 和 module guard
    const needsProfileCheck = user && (
      pathname.startsWith('/admin') ||
      pathname.startsWith('/cli-proxy') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/marketing') ||
      pathname.startsWith('/mkt') ||
      pathname.startsWith('/marketing-auto') ||
      pathname.startsWith('/cs') ||
      pathname.startsWith('/prospect-call') ||
      pathname.startsWith('/resume') ||
      pathname.startsWith('/work') ||
      pathname.startsWith('/pos') ||
      pathname.startsWith('/hr') ||
      pathname.startsWith('/finance') ||
      pathname.startsWith('/agent') ||
      pathname.startsWith('/booking')
    )

    if (needsProfileCheck) {
      // 公司的 enabled_modules 分開查，不用 PostgREST 的 embed：companies 與 profiles
      // 之間有三條外鍵，embed 無法判斷該走哪一條，會回 PGRST201 讓整個查詢失敗、
      // profile 變成 null——底下的模組權限檢查會被整段跳過，非管理者因此拿到預設模組。
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('user_type, enabled_modules, units, company_id')
        .eq('id', user.id)
        .single()
      // 查詢失敗時 profile 是 null，底下的模組權限檢查會被整段跳過（`if (profile && ...)`），
      // 等於權限形同虛設而且完全無聲。行為維持不變，但要留下錯誤。
      if (profileErr) console.error('[middleware] profiles 查詢失敗', { userId: user.id, pathname, error: profileErr })

      const isAdmin = profile?.user_type === 'admin' ||
        user.email?.toLowerCase() === 'imseby@gmail.com' ||
        (process.env.ADMIN_EMAIL && user.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase())

      // Admin/Owner guard — /admin、/cli-proxy、/programing (FreeLLM)、/dashboard 僅限總管理員
      // 非管理者一律導向 /apps（功能選單），用 nextUrl 保留原始 host（含子域名）
      if (!isAdmin && (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/cli-proxy') ||
        pathname.startsWith('/programing') ||
        pathname.startsWith('/dashboard')
      )) {
        const url = request.nextUrl.clone()
        url.pathname = '/apps'
        url.search = ''
        return NextResponse.redirect(url)
      }

      // Module guard — 檢查 enabled_modules 與單位權限 units，總管理員(admin)跳過
      // 員工或公司負責人，皆受限於其個人或所屬公司的 enabled_modules
      if (profile && !isAdmin) {
        let companyModules: string[] | undefined
        if (profile.company_id) {
          const { data: company, error: companyErr } = await supabase
            .from('companies')
            .select('enabled_modules')
            .eq('id', profile.company_id)
            .single()
          // 失敗時會退回個人的 enabled_modules，權限範圍默默變成另一組。
          if (companyErr) console.error('[middleware] companies 查詢失敗', { companyId: profile.company_id, error: companyErr })
          companyModules = company?.enabled_modules ?? undefined
        }
        const effectiveModules: string[] = companyModules ?? profile.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume', 'booking']
        const units: string[] = profile.units ?? []
        const ROUTE_MODULES: Record<string, string[]> = {
          '/marketing':      ['marketing', 'mkt'],
          '/mkt':            ['marketing', 'mkt'],
          '/marketing-auto': ['marketing', 'cs', 'mkt'],
          '/cs':             ['cs'],
          '/prospect-call':  ['leads', 'marketing', 'mkt'],
          '/resume':         ['resume'],
          '/work':           ['work'],
          '/pos':            ['work'],
          '/hr':             ['hr'],
          '/finance':        ['finance'],
          '/agent':          ['agent'],
          '/booking':        ['booking'],
        }
        for (const [route, modules] of Object.entries(ROUTE_MODULES)) {
          if (pathname.startsWith(route)) {
            const hasAccess = modules.some(m => effectiveModules.includes(m) || units.includes(m))
            if (!hasAccess) {
              const url = request.nextUrl.clone()
              url.pathname = '/apps'
              url.search = '?blocked=' + modules[0]
              return attachLocaleCookie(NextResponse.redirect(url))
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
      supabaseResponse.cookies.getAll().forEach((c: { name: string; value: string }) => rewriteRes.cookies.set(c))
      return attachLocaleCookie(rewriteRes)
    }

    return attachLocaleCookie(supabaseResponse)
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
