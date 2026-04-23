import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'


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
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Admin route protection
    if (pathname.startsWith('/admin') && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single()

      if (profile?.user_type !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
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
