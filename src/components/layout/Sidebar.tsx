'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  MessageSquare, Bot, BarChart3, Settings, Shield,
  Plus, ChevronLeft, ChevronRight, Image, Video, Zap,
  FileText, Megaphone, Headphones, Phone, LayoutDashboard,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { ConversationItem } from './ConversationItem'

interface SidebarProps {
  userType?: string
  enabledModules?: string[]
  conversations?: Array<{ id: string; title: string; updated_at: string; pinned: boolean }>
}

const MAIN_NAV = [
  { labelKey: 'dashboard',   href: '/dashboard',      icon: LayoutDashboard, module: null },
  { labelKey: 'assistants',  href: '/assistants',     icon: Bot,             module: 'chat' },
  { labelKey: 'imageGen',    href: '/image-gen',      icon: Image,           module: 'chat' },
  { labelKey: 'videoGen',    href: '/video-gen',      icon: Video,           module: 'chat' },
] as const

const TOOL_NAV = [
  { labelKey: 'resume',        href: '/resume',          icon: FileText,   module: 'resume' },
  { labelKey: 'marketingAuto', href: '/marketing-auto',  icon: Megaphone,  module: 'marketing' },
  { labelKey: 'cs',            href: '/cs',              icon: Headphones, module: 'cs' },
  { labelKey: 'leads',         href: '/prospect-call',   icon: Phone,      module: 'leads' },
] as const

const SYSTEM_NAV = [
  { labelKey: 'usage',    href: '/usage',    icon: BarChart3, module: null, adminOnly: false },
  { labelKey: 'settings', href: '/settings', icon: Settings,  module: null, adminOnly: false },
  { labelKey: 'admin',    href: '/admin',    icon: Shield,    module: null, adminOnly: true  },
] as const

export function Sidebar({ userType, enabledModules, conversations = [] }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const t = useTranslations('Sidebar')
  const isAdmin = userType === 'admin'
  const mods = enabledModules ?? ['chat', 'marketing', 'cs', 'leads', 'resume']

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/')

  const renderNavItem = (item: { labelKey: string; href: string; icon: React.ElementType; module: string | null; adminOnly?: boolean }) => {
    if ('adminOnly' in item && item.adminOnly && !isAdmin) return null
    if (item.module && item.module !== null && !isAdmin && !mods.includes(item.module)) return null

    const Icon = item.icon
    const active = isActive(item.href)

    return (
      <Link key={item.labelKey} href={item.href} title={collapsed ? t(item.labelKey as Parameters<typeof t>[0]) : undefined}>
        <div className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
          active
            ? 'bg-primary/10 text-primary dark:bg-primary/20'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          collapsed && 'justify-center px-2'
        )}>
          <Icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-primary')} />
          {!collapsed && (
            <span className="truncate">{t(item.labelKey as Parameters<typeof t>[0])}</span>
          )}
          {!collapsed && active && (
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </div>
      </Link>
    )
  }

  const mainItems = [...MAIN_NAV].filter(item => {
    if (item.module && !isAdmin && !mods.includes(item.module)) return false
    return true
  })

  const toolItems = [...TOOL_NAV].filter(item => {
    if (!isAdmin && !mods.includes(item.module)) return false
    return true
  })

  return (
    <aside className={cn(
      'flex flex-col h-full border-r bg-card transition-all duration-300 ease-in-out',
      collapsed ? 'w-[60px]' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn(
        'sidebar-logo-area flex items-center border-b',
        collapsed ? 'justify-center px-3 py-4' : 'justify-between px-4 py-4'
      )}>
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-sm">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">AI GATE</span>
          </Link>
        ) : (
          <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-sm">
              <Zap className="h-4 w-4 text-white" />
            </div>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-[3.5rem] h-6 w-6 rounded-full border bg-card shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      {(isAdmin || mods.includes('chat')) && (
        <div className="px-3 pt-3 pb-1">
          <Link href="/chat">
            <Button
              className={cn('w-full h-8 text-xs gap-1.5 shadow-sm', collapsed && 'px-0')}
              size="sm"
            >
              <Plus className="h-3.5 w-3.5" />
              {!collapsed && t('newChat')}
            </Button>
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {/* Main */}
        {mainItems.map(renderNavItem)}

        {/* Tools section */}
        {toolItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">工具</p>
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-border/50" />}
            {toolItems.map(renderNavItem)}
          </>
        )}

        {/* Recent chats */}
        {!collapsed && conversations.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              {t('recentChats')}
            </p>
            <div className="space-y-0.5">
              {conversations.map(conv => (
                <ConversationItem key={conv.id} conv={conv} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* System Nav (bottom) */}
      <div className="border-t px-2 py-2 space-y-0.5">
        {SYSTEM_NAV.map(item => renderNavItem({ ...item }))}
      </div>
    </aside>
  )
}
