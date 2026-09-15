'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 系統選擇頁（/login）用：已登入者自動導回 /apps。
// 故意放在 client component 用瀏覽器端 supabase client 檢查——若改在 Server
// Component 用 lib/supabase/server.ts 的 getUser()，遇到 access token 已過期時
// SDK 會自動用 refresh token 換新 token，但 Server Component 無法把新 cookie
// 寫回瀏覽器（cookies().set() 在這裡會被吃掉），等於「這次幫你把 refresh token
// 用掉了，但新 token 沒發給你」。下一次 middleware 再用同一組（已失效）refresh
// token 換新token 必定失敗、判定未登入，導回 /login，形成 /login ↔ /apps 的
// 無限 redirect 迴圈。瀏覽器端 client 能正常把刷新後的 cookie 寫回，不會有這問題。
export function AutoRedirectIfAuthed() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    createClient().auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) router.replace('/apps')
    })
    return () => { cancelled = true }
  }, [router])

  return null
}
