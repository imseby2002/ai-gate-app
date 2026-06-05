'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Zap, ArrowLeft } from 'lucide-react'
import { SYSTEMS, SCOPE_SESSION_KEY, isSystemKey, systemForPath } from '@/lib/systems'

interface BackToMenuProps {
  variant?: 'standalone' | 'tools'
}

export function BackToMenu({ variant = 'standalone' }: BackToMenuProps) {
  const pathname = usePathname()
  const [href, setHref] = useState('/apps')

  useEffect(() => {
    // 管理者與使用者一致：一律依「目前所在路徑」推回所屬功能系統主頁，
    // 不再回 /dashboard（dashboard 為 owner 專用總控台）。
    // /marketing-auto 同時被行銷與客服系統共用，靠 ?module=cs 區分。
    const isCsMode = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('module') === 'cs'
    if (pathname.startsWith('/marketing-auto') && isCsMode) {
      setHref(SYSTEMS.cs.home); return
    }
    if (pathname.startsWith('/marketing')) {
      setHref(SYSTEMS.marketing.home); return
    }
    const sys = systemForPath(pathname)
    if (sys) { setHref(SYSTEMS[sys].home); return }

    // 路徑無法判別時，退回 per-tab scope，最後才是 /apps
    try {
      const scope = sessionStorage.getItem(SCOPE_SESSION_KEY)
      if (isSystemKey(scope)) setHref(SYSTEMS[scope].home)
    } catch {
      // sessionStorage 不可用（私密模式等），保持 /apps
    }
  }, [pathname])

  if (variant === 'tools') {
    return (
      <a href={href} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        返回首頁
      </a>
    )
  }

  return (
    <a href={href} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
      <Zap className="h-5 w-5 text-primary" />
      <div className="leading-none">
        <span className="font-bold text-base">AI GATE</span>
        <span className="block text-xs text-muted-foreground mt-0.5">← 返回主選單</span>
      </div>
    </a>
  )
}
