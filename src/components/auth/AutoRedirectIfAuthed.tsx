'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// 系統選擇頁（/login）用：已登入者自動導回 /apps。
// 故意放在 client component 用瀏覽器端 supabase client 檢查——若改在 Server
// Component 用 lib/supabase/server.ts 的 getUser()，遇到 access token 已過期時
// SDK 會自動用 refresh token 換新 token，但 Server Component 無法把新 cookie
// 寫回瀏覽器（cookies().set() 在這裡會被吃掉），等於「這次幫你把 refresh token
// 用掉了，但新 token 沒發給你」。下一次 middleware 再用同一組（已失效）refresh
// token 換新token 必定失敗、判定未登入，導回 /login，形成 /login ↔ /apps 的
// 無限 redirect 迴圈。瀏覽器端 client 能正常把刷新後的 cookie 寫回，不會有這問題。
//
// 用 window.location.href 而非 router.replace()：實測發現若曾經在未登入狀態
// 訪問過 /apps（被伺服器導回 /login 那次），Next.js 的 client-side Router Cache
// 會把那次「/apps → 導回 /login」的結果快取住；之後 router.replace('/apps')
// 都直接吃到這個舊的快取結果，完全沒有真的再問伺服器一次，導致每次都立刻被導回
// /login，/login 一 mount 又立刻再判定已登入、再 replace('/apps')……形成純瀏覽器端、
// 跟 cookie／伺服器狀態完全無關的無限迴圈（清 cookie 也沒用，因為快取跟 cookie
// 是兩回事）。改用整頁導航能繞過這個 client router cache，保證每次都是全新請求。
export function AutoRedirectIfAuthed() {
  useEffect(() => {
    let cancelled = false
    createClient().auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) window.location.href = '/apps'
    })
    return () => { cancelled = true }
  }, [])

  return null
}
