'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  MessageSquare, Bot,
  Plus, ChevronLeft, ChevronRight, Image, Video, Zap,
  FileText, Megaphone, Headphones, Phone, LayoutDashboard, CalendarDays, Terminal, MessageSquarePlus,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { ConversationItem } from './ConversationItem'

interface SidebarProps {
  userType?: string
  enabledModules?: string[]
  scope?: string
  conversations?: Array<{ id: string; title: string; updated_at: string; pinned: boolean }>
}

type NavItem = {
  labelKey: string
  label?: string
  href: string
  icon: React.ElementType
  module: string | null
  adminOnly?: boolean
}

const MAIN_NAV: NavItem[] = [
  { labelKey: 'dashboard',   href: '/dashboard',      icon: LayoutDashboard, module: null },
  { labelKey: 'assistants',  href: '/assistants',     icon: Bot,             module: 'chat' },
  { labelKey: 'imageGen',    href: '/image-gen',      icon: Image,           module: 'chat' },
  { labelKey: 'videoGen',    href: '/video-gen',      icon: Video,           module: 'chat' },
]

const TOOL_NAV: NavItem[] = [
  { labelKey: 'resume',        href: '/resume',          icon: FileText,     module: 'resume' },
  { labelKey: 'marketing',     href: '/marketing',        icon: Megaphone,    module: 'marketing' },
  { labelKey: 'cs',            href: '/cs',              icon: Headphones,   module: 'cs' },
  { labelKey: 'leads',         href: '/prospect-call',   icon: Phone,        module: 'leads' },
  { labelKey: 'booking',       href: '/booking',         icon: CalendarDays, module: 'booking' },
]

// 僅總管理員可見的連結
const ADMIN_NAV: NavItem[] = [
  { labelKey: 'cliProxy',  label: 'CLI Proxy',  href: '/cli-proxy',  icon: Terminal,         module: null, adminOnly: true },
  { labelKey: 'feedback',  label: '意見回饋',    href: '/feedback',   icon: MessageSquarePlus, module: null },
]


export function Sidebar({ userType, enabledModules, scope, conversations = [] }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const t = useTranslations('Sidebar')
  const isAdmin = userType === 'admin'
  const mods = enabledModules ?? ['chat', 'marketing', 'cs', 'leads', 'resume', 'booking']

  // 連結可見性：管理員看全部；非管理員若帶系統範圍（scope）只看該系統，否則依 enabled_modules
  const isVisible = (item: NavItem) => {
    if (item.adminOnly) return isAdmin
    if (isAdmin) return true
    if (scope) return (item.module ?? 'chat') === scope
    return !item.module || mods.includes(item.module)
  }

  const labelOf = (item: NavItem) => item.label ?? t(item.labelKey as Parameters<typeof t>[0])
  const chatVisible = isAdmin || (scope ? scope === 'chat' : mods.includes('chat'))

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/')

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const active = isActive(item.href)
    const label = labelOf(item)

    return (
      <Link key={item.href} href={item.href} title={collapsed ? label : undefined}>
        <div className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
          active
            ? 'bg-primary/10 text-primary dark:bg-primary/20'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          collapsed && 'justify-center px-2'
        )}>
          <Icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-primary')} />
          {!collapsed && (
            <span className="truncate">{label}</span>
          )}
          {!collapsed && active && (
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </div>
      </Link>
    )
  }

  const mainItems = MAIN_NAV.filter(isVisible)
  const toolItems = TOOL_NAV.filter(isVisible)
  const adminItems = ADMIN_NAV.filter(isVisible)

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
      {chatVisible && (
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
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">{t('tools')}</p>
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-border/50" />}
            {toolItems.map(renderNavItem)}
          </>
        )}

        {/* Admin-only links */}
        {adminItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">{t('admin')}</p>
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-border/50" />}
            {adminItems.map(renderNavItem)}
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

    </aside>
  )
}
