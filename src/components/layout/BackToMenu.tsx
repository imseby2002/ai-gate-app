'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Zap, ArrowLeft } from 'lucide-react'
import { SYSTEMS, SCOPE_SESSION_KEY, SUBDOMAIN_SYSTEM, isSystemKey, systemForPath } from '@/lib/systems'

interface BackToMenuProps {
  variant?: 'standalone' | 'tools'
}

export function BackToMenu({ variant = 'standalone' }: BackToMenuProps) {
  const pathname = usePathname()
  const t = useTranslations('Nav')
  const [href, setHref] = useState('/apps')

  useEffect(() => {
    // 1. Office 系統任一地方（/office, /hr, /personnel, /finance, /store-expenses,
    //    /vendors, /units, /rd, /rd-recipes, /rd-ai, /rd-logs, /store-reports,
    //    /store-inventory, /shift, /pos, /affairs, /audit, /meeting, /work）
    //    點「返回主選單」一律回到 /office，絕不跳到 /work！
    const OFFICE_PREFIXES = [
      '/office', '/hr', '/personnel', '/finance', '/store-expenses',
      '/vendors', '/units', '/rd', '/rd-recipes', '/rd-ai', '/rd-logs',
      '/store-reports', '/store-inventory', '/shift', '/pos',
      '/affairs', '/audit', '/meeting', '/work'
    ]
    if (OFFICE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      setHref('/office')
      return
    }

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
    if (sys) {
      const targetHome = SYSTEMS[sys].home === '/work' ? '/office' : SYSTEMS[sys].home
      setHref(targetHome)
      return
    }

    // 路徑無法判別（如 /team、/apps 等共用頁）時，
    // 優先依「目前子域」回該系統首頁，確保停留在所在子域，不跳到通用 /apps。
    try {
      const sub = window.location.hostname.split('.')[0]
      const bySub = SUBDOMAIN_SYSTEM[sub]
      if (bySub) {
        const targetHome = SYSTEMS[bySub].home === '/work' ? '/office' : SYSTEMS[bySub].home
        setHref(targetHome)
        return
      }
    } catch {
      // window 不可用時往下退回
    }

    // 再退回 per-tab scope，最後才是 /apps
    try {
      const scope = sessionStorage.getItem(SCOPE_SESSION_KEY)
      if (isSystemKey(scope)) {
        const targetHome = SYSTEMS[scope].home === '/work' ? '/office' : SYSTEMS[scope].home
        setHref(targetHome)
        return
      }
    } catch {
      // sessionStorage 不可用（私密模式等），保持 /apps
    }
  }, [pathname])

  if (variant === 'tools') {
    return (
      <a href={href} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('backHome')}
      </a>
    )
  }

  return (
    <a href={href} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
      <Zap className="h-5 w-5 text-primary" />
      <div className="leading-none">
        <span className="font-bold text-base">AI GATE</span>
        <span className="block text-xs text-muted-foreground mt-0.5">← {t('backToMenu')}</span>
      </div>
    </a>
  )
}
