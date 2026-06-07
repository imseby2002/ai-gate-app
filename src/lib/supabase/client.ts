import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // im-tourist 多子域：auth cookie 設 domain=.im-tourist.com 跨子域共享。localhost/preview 不設。
  const domain =
    typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com')
      ? '.im-tourist.com'
      : undefined
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    domain ? { cookieOptions: { domain } } : undefined
  )
}
