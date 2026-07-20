'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import type { Profile } from '@/types/database'

interface AppShellProps {
  userType?: string
  enabledModules?: string[]
  scope?: string
  conversations?: Array<{ id: string; title: string; updated_at: string; pinned: boolean }>
  profile: Profile
  creditBalance?: number
  locale: string
  children: React.ReactNode
}

export function AppShell({ children, userType, enabledModules, scope, conversations, profile, creditBalance, locale }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false) }, [pathname])

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col shrink-0">
        <Sidebar userType={userType} enabledModules={enabledModules} scope={scope} conversations={conversations} />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-[280px] h-full bg-card border-r overflow-y-auto flex flex-col">
            <Sidebar userType={userType} enabledModules={enabledModules} scope={scope} conversations={conversations} />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          profile={profile}
          creditBalance={creditBalance}
          locale={locale}
          onMenuClick={() => setMobileOpen(v => !v)}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
