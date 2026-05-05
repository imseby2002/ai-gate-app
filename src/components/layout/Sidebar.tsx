'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  MessageSquare, Bot, BarChart3, Settings, Shield,
  Plus, ChevronLeft, ChevronRight, Image, Video, Zap,
  FileText, Megaphone, Headphones, Phone
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface SidebarProps {
  userType?: string
  enabledModules?: string[]
  conversations?: Array<{ id: string; title: string; updated_at: string }>
}

export function Sidebar({ userType, enabledModules, conversations = [] }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const t = useTranslations('Sidebar')
  const isAdmin = userType === 'admin'
  const mods = enabledModules ?? ['chat', 'marketing', 'cs', 'leads', 'resume']

  const NAV_ITEMS = [
    // chat module
    { labelKey: 'assistants', href: '/assistants',  icon: Bot,           module: 'chat' },
    { labelKey: 'imageGen',   href: '/image-gen',   icon: Image,         module: 'chat' },
    { labelKey: 'videoGen',   href: '/video-gen',   icon: Video,         module: 'chat' },
    // other modules
    { labelKey: 'resume',        href: '/resume',          icon: FileText,   module: 'resume' },
    { labelKey: 'marketingAuto', href: '/marketing-auto',  icon: Megaphone,  module: 'marketing' },
    { labelKey: 'cs',            href: '/cs', icon: Headphones, module: 'cs' },
    { labelKey: 'leads',         href: '/prospect-call',   icon: Phone,      module: 'leads' },
    // always visible
    { labelKey: 'usage',    href: '/usage',    icon: BarChart3, module: null },
    { labelKey: 'settings', href: '/settings', icon: Settings,  module: null },
    { labelKey: 'admin',    href: '/admin',    icon: Shield,    module: null, adminOnly: true },
  ] as const

  const visibleItems = NAV_ITEMS.filter(item => {
    if ('adminOnly' in item && item.adminOnly && !isAdmin) return false
    if (item.module === null) return true
    return isAdmin || mods.includes(item.module)
  })

  return (
    <aside className={cn(
      'flex flex-col h-full bg-card border-r transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">AI GATE</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="hover:opacity-70 transition-opacity mx-auto">
            <Zap className="h-6 w-6 text-primary" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat Button */}
      {(isAdmin || mods.includes('chat')) && (
        <div className="px-3 py-3">
          <Link href="/chat">
            <Button className={cn('w-full', collapsed && 'px-0')} size="sm">
              <Plus className="h-4 w-4" />
              {!collapsed && t('newChat')}
            </Button>
          </Link>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto pt-2">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const basePath = item.href.split('?')[0]
          const isActive = pathname === basePath || pathname.startsWith(basePath + '/')
          return (
            <Link key={item.labelKey} href={item.href}>
              <div className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && t(item.labelKey)}
              </div>
            </Link>
          )
        })}

        {/* Recent Conversations */}
        {!collapsed && conversations.length > 0 && (
          <div className="mt-4">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('recentChats')}
            </p>
            {conversations.slice(0, 8).map(conv => (
              <Link key={conv.id} href={`/chat/${conv.id}`}>
                <div className={cn(
                  'px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer truncate',
                  pathname === `/chat/${conv.id}` && 'bg-accent text-foreground'
                )}>
                  {conv.title}
                </div>
              </Link>
            ))}
          </div>
        )}
      </nav>
    </aside>
  )
}
