import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

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

async function authHeader(): Promise<string | undefined> {
  try {
    const h = await headers()
    return h.get('authorization') || undefined
  } catch {
    return undefined
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  const domain = await cookieDomain()
  const ip = await clientIp()
  const auth = await authHeader()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(domain ? { cookieOptions: { domain } } : {}),
      global: {
        headers: {
          ...(ip ? { 'Sb-Forwarded-For': ip } : {}),
          ...(auth ? { 'Authorization': auth } : {}),
        },
      },
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

// middleware 已經對這次請求做過一次 getUser()（若 access token 過期會順便換新並正確
// 寫回 cookie）。layout 與同一顆頁面樹下的多個 Server Component（如 (app)/layout.tsx
// 與其底下的 page.tsx）過去各自再呼叫一次 getUser()，同一個請求內疊加出 2、3 次獨立
// 的 getUser() 呼叫；若 access token 剛好過期，每次呼叫都會各自嘗試用 refresh token
// 換新——但 refresh token 一次性使用，且 Server Component 換到新 token 也無法寫回
// cookie。第一個呼叫換新成功但只在記憶體裡有效，第二個呼叫再用同一組（已被用掉）的
// refresh token 換新就會失敗、誤判成未登入，進而 redirect('/login')，形成與 /login
// 之間的無限迴圈（實際在 production 發生過）。用 React cache() 讓同一個請求內不管被
// 呼叫幾次，實際只會真的打一次 Supabase，其餘呼叫直接拿同一個結果，避免這個競速。
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})

// 這裡原本用 createServerClient 接 cookies 建「service-role client」，但
// @supabase/ssr 只要餵了 cookies 就會主動管理 session：一旦這次請求本來就有
// 登入者的 session cookie，之後每個查詢送出的 Authorization header 會被換成
// 那個使用者的 access token，蓋掉建構時傳入的 service-role key——結果這個
// 「admin」client 實際上是用登入者身分在跑，RLS 照樣套用，完全沒有真的繞過。
// 例如查團隊名單時，只會看到 RLS 允許登入者自己看到的那幾列（自己的那筆），
// 看不到其他協作者，因為背後根本不是 service-role 在查。
// 改成跟 @/lib/supabase/admin.ts 一樣，用不吃 cookies 的純 createClient，
// 才是真的 service-role、真的繞過 RLS。維持 async 簽章，呼叫端的 await 不用改。
export async function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
