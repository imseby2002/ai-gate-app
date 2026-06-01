'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Zap, ArrowLeft } from 'lucide-react'
import { SYSTEMS, SCOPE_SESSION_KEY, isSystemKey, systemForPath } from '@/lib/systems'

interface BackToMenuProps {
  isAdmin: boolean
  variant?: 'standalone' | 'tools'
}

export function BackToMenu({ isAdmin, variant = 'standalone' }: BackToMenuProps) {
  const pathname = usePathname()
  const [href, setHref] = useState('/dashboard')

  useEffect(() => {
    // 管理員自由導航，返回主選單一律回 /dashboard
    if (isAdmin) return

    // 優先依「目前所在路徑」推回所屬系統首頁——比 per-tab scope 可靠，
    // 即使用戶是從統一 App 進來（未設定 scope）也能正確返回該功能入口頁。
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

    // 路徑無法判別時，退回 per-tab scope，最後才是 /dashboard
    try {
      const scope = sessionStorage.getItem(SCOPE_SESSION_KEY)
      if (isSystemKey(scope)) setHref(SYSTEMS[scope].home)
    } catch {
      // sessionStorage 不可用（私密模式等），保持 /dashboard
    }
  }, [isAdmin, pathname])

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
