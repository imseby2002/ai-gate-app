import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton：每個分頁只建立一個瀏覽器端 client。每次呼叫都 new 一個新的
// GoTrueClient 會各自起一個自動刷新 token 的計時器，多處同時呼叫時會互相
// 搶著用同一個 refresh token 打 /token，觸發 Supabase 的 rate limit（refresh 風暴）。
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (browserClient) return browserClient

  // im-tourist 多子域：auth cookie 設 domain=.im-tourist.com 跨子域共享。localhost/preview 不設。
  const domain =
    typeof window !== 'undefined' && window.location.hostname.endsWith('im-tourist.com')
      ? '.im-tourist.com'
      : undefined
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(domain ? { cookieOptions: { domain } } : {}),
    }
  )
  return browserClient
}
