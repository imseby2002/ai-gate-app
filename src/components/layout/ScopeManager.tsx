'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SYSTEMS, SCOPE_SESSION_KEY, isSystemKey, isPathAllowedForScope } from '@/lib/systems'

export function ScopeManager() {
  const pathname = usePathname()
  const router = useRouter()

  // OAuth callback 後 URL 帶 ?_si=<system>，寫入 sessionStorage 後清掉 param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const si = params.get('_si')
    if (isSystemKey(si)) {
      sessionStorage.setItem(SCOPE_SESSION_KEY, si)
      params.delete('_si')
      const qs = params.toString()
      router.replace(window.location.pathname + (qs ? '?' + qs : ''))
    }
  }, [router])

  // 每次路徑改變時，檢查 sessionStorage scope 是否允許當前路徑
  useEffect(() => {
    const scope = sessionStorage.getItem(SCOPE_SESSION_KEY)
    if (!isSystemKey(scope)) return
    if (!isPathAllowedForScope(scope, pathname)) {
      router.replace(SYSTEMS[scope].home)
    }
  }, [pathname, router])

  return null
}
