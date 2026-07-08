import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

// im-tourist 多子域：auth cookie 設 domain=.im-tourist.com 跨子域共享，
// 讓 callback 落點與功能頁子域不同時仍保持登入。localhost/preview 不設。
async function cookieDomain(): Promise<string | undefined> {
  try {
    const host = ((await headers()).get('host') || '').split(':')[0].toLowerCase()
    return host.endsWith('im-tourist.com') ? '.im-tourist.com' : undefined
  } catch {
    return undefined
  }
}

// 伺服器端呼叫 Supabase 時，預設看到的 IP 是 Vercel 出口 IP（全站共用），
// 轉發真實客戶端 IP 讓 Supabase 的 rate limit 以實際使用者為單位計算。
async function clientIp(): Promise<string | undefined> {
  try {
    const h = await headers()
    return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || undefined
  } catch {
    return undefined
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  const domain = await cookieDomain()
  const ip = await clientIp()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(domain ? { cookieOptions: { domain } } : {}),
      ...(ip ? { global: { headers: { 'Sb-Forwarded-For': ip } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component - ignore
          }
        },
      },
    }
  )
}

export async function createAdminClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
