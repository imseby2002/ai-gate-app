'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Zap } from 'lucide-react'
import { SYSTEMS, SCOPE_SESSION_KEY, SUBDOMAIN_SYSTEM, isSystemKey, systemForPath, getLocalizedSystemDef } from '@/lib/systems'

export function BackToMenu() {
  const pathname = usePathname()
  const t = useTranslations('Nav')
  const locale = useLocale()
  const [href, setHref] = useState('/apps')

  useEffect(() => {
    // 1. Office 系統任一地方（/office, /hr, /personnel, /finance, /store-expenses,
    //    /vendors, /units, /rd, /rd-recipes, /rd-ai, /rd-logs, /store-reports,
    //    /store-inventory, /shift, /pos, /affairs, /audit, /meeting, /work）
    //    點「返回主選單」一律回到 /office，絕不跳到 /work！
    const OFFICE_PREFIXES = [
      '/office', '/hr', '/personnel', '/finance', '/store-expenses',
      '/vendors', '/units', '/rd', '/rd-lab', '/rd-recipes', '/rd-ai', '/rd-logs',
      '/store', '/store-reports', '/store-inventory', '/store-bills', '/store-coach', '/repair',
      '/shift', '/pos', '/affairs', '/audit', '/audit-inspection', '/audit-ai',
      '/audit-logs', '/audit-platform', '/meeting', '/work', '/mkt', '/gm'
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
    // CS 系統特殊處理：跟 OFFICE_PREFIXES 一樣的邏輯——任何 /cs 底下的頁面（工作台、
    // 收件匣 PWA、總覽、功能介紹頁…）都應該回到 CS 的工作首頁，而不是跳出去 /apps
    // 跨系統選單（之前只認 /cs/workspace，其餘 /cs/* 頁面點了會被送到 /apps，
    // 在子網域架構下等於直接跳到另一個子網域，體驗很突兀）。
    if (pathname.startsWith('/cs')) {
      setHref('/cs/workspace?tab=inbox')
      return
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

  const isCs = pathname.startsWith('/cs')

  const titleSys = isCs ? 'cs' : systemForPath(pathname)
  const titleText = titleSys ? getLocalizedSystemDef(titleSys, locale).label : 'IMT'
  const csInboxText = locale === 'vi' ? 'Quay lại Hộp thư' : locale === 'en' ? 'Back to Inbox' : '返回收件匣'
  const subText = isCs ? `← ${csInboxText}` : `← ${t('backToMenu')}`

  return (
    <a href={href} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
      <Zap className="h-5 w-5 text-primary" />
      <div className="leading-none">
        <span className="font-bold text-base">{titleText}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{subText}</span>
      </div>
    </a>
  )
}
