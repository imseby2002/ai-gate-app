'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LogOut, Settings, CreditCard, ChevronDown, BarChart3, Shield, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LanguageSwitcher } from './LanguageSwitcher'
import { systemForPath, SUBDOMAIN_SYSTEM } from '@/lib/systems'
import type { Profile } from '@/types/database'

interface HeaderProps {
  profile: Profile
  creditBalance?: number
  locale: string
  onMenuClick?: () => void
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-500',
]

function avatarGradient(email: string) {
  const n = email.charCodeAt(0) + email.charCodeAt(email.length - 1)
  return AVATAR_GRADIENTS[n % AVATAR_GRADIENTS.length]
}

export function Header({ profile, creditBalance, locale, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('Header')
  const [menuOpen, setMenuOpen] = useState(false)
  const creditsHref = `/credits?from=${encodeURIComponent(pathname || '/apps')}`

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // 登出後導回「當下所屬系統」的登入頁（比照 middleware 未登入時的判斷：
    // 子域名優先、其次依路徑反查），而非一律丟到列出全部系統的通用選擇頁——
    // 那個頁面比較像管理者用的總覽，一般客戶登出後不該看到。
    const sub = window.location.hostname.split('.')[0]
    const sys = SUBDOMAIN_SYSTEM[sub] ?? systemForPath(pathname ?? '')
    router.push(sys ? `/login/${sys}` : '/login')
  }

  const displayName = profile.full_name ?? profile.email ?? ''
  const initials = getInitials(displayName)
  const gradient = avatarGradient(profile.email ?? 'a')

  const userTypeBadge = {
    employee: { label: t('userTypeEmployee'), className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
    external: { label: t('userTypeExternal'), className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
    admin:    { label: t('userTypeAdmin'),    className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' },
  }[profile.user_type]

  return (
    <header className="relative z-20 flex items-center justify-between px-3 sm:px-5 py-2.5 border-b bg-card/80 backdrop-blur-sm">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden md:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Credit balance → 點數錢包（可點擊儲值） */}
        {profile.user_type === 'external' && creditBalance !== undefined && (
          <a
            href={creditsHref}
            title="點數錢包 · 儲值"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm">
              ${creditBalance?.toFixed(2)}
            </span>
            <span className="hidden sm:inline text-emerald-600/70 dark:text-emerald-400/70 text-xs">{t('balance')}</span>
          </a>
        )}

        <div className="hidden sm:block">
          <LanguageSwitcher currentLocale={locale} />
        </div>

        {/* User type badge */}
        <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${userTypeBadge.className}`}>
          {userTypeBadge.label}
        </span>

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors cursor-pointer"
          >
            <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-semibold select-none shadow-sm`}>
              {initials}
            </div>
            <span className="text-sm font-medium max-w-[140px] truncate hidden sm:block">
              {displayName}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b bg-muted/30">
                  <p className="text-xs font-medium truncate">{profile.full_name ?? ''}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => { router.push('/usage'); setMenuOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                  >
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    用量統計
                  </button>
                  <button
                    onClick={() => { router.push('/settings'); setMenuOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    {t('settings')}
                  </button>
                  {profile.user_type === 'admin' && (
                    <button
                      onClick={() => { router.push('/admin'); setMenuOpen(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                    >
                      <Shield className="h-4 w-4 text-violet-500" />
                      <span className="text-violet-600 dark:text-violet-400">後台管理</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-border/50" />
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('signOut')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
