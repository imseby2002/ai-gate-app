'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, ChevronDown, Settings, Wallet, LayoutDashboard, Building2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { systemForPath, systemForHost } from '@/lib/systems'
import { IdentitySwitcherMenu } from './IdentitySwitcherMenu'

export function ToolsUserMenu({ displayName, hasCompany }: { displayName: string; hasCompany?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('Header')
  const locale = useLocale()

  const labels = {
    settings: t('settings') || (locale === 'vi' ? 'Cài đặt tài khoản' : '帳號設定'),
    plan: locale === 'vi' ? 'Gói công ty' : locale === 'en' ? 'Company Plan' : '公司版',
    credits: locale === 'vi' ? 'Nạp điểm' : locale === 'en' ? 'Buy Credits' : '儲值點數',
    csHub: locale === 'vi' ? 'Về trang CS' : locale === 'en' ? 'Back to CS' : '返回客服統整頁',
    signOut: t('signOut') || (locale === 'vi' ? 'Đăng xuất' : '登出'),
  }

  // 儲值頁返回時要回到「進來的那個模組」，帶上目前路徑
  const creditsHref = `/credits?from=${encodeURIComponent(pathname || '/apps')}`
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    const sys = systemForHost(window.location.hostname) ?? systemForPath(pathname ?? '')
    router.push(sys ? `/login/${sys}` : '/login')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
      >
        <span>{displayName}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border bg-white shadow-md z-50 overflow-hidden py-1">
            <IdentitySwitcherMenu onNavigate={() => setOpen(false)} />
            {pathname.startsWith('/cs') && (
              <a
                href="/cs"
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors font-medium border-b border-gray-100"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-blue-500" />
                {labels.csHub}
              </a>
            )}
            <a
              href="/settings"
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-gray-400" />
              {labels.settings}
            </a>
            {hasCompany && (
              <a
                href="/company/plan"
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                {labels.plan}
              </a>
            )}
            <a
              href={creditsHref}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Wallet className="h-3.5 w-3.5 text-gray-400" />
              {labels.credits}
            </a>
            <div className="my-1 border-t" />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              {labels.signOut}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
