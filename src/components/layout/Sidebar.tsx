'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  MessageSquare, Bot, BarChart3, Settings, Shield,
  Plus, ChevronLeft, ChevronRight, Image, Video, Zap, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface SidebarProps {
  userType?: string
  conversations?: Array<{ id: string; title: string; updated_at: string }>
}

export function Sidebar({ userType, conversations = [] }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const t = useTranslations('Sidebar')

  const NAV_ITEMS = [
    { labelKey: 'newChat',    href: '/chat',        icon: MessageSquare },
    { labelKey: 'assistants', href: '/assistants',  icon: Bot },
    { labelKey: 'imageGen',   href: '/image-gen',   icon: Image },
    { labelKey: 'videoGen',   href: '/video-gen',   icon: Video },
    { labelKey: 'resume',     href: '/resume',      icon: FileText },
    { labelKey: 'usage',      href: '/usage',       icon: BarChart3 },
    { labelKey: 'settings',   href: '/settings',    icon: Settings },
    { labelKey: 'admin',      href: '/admin',       icon: Shield, adminOnly: true },
  ] as const

  const visibleItems = NAV_ITEMS.filter(item =>
    !('adminOnly' in item) || userType === 'admin'
  )

  return (
    <aside className={cn(
      'flex flex-col h-full bg-card border-r transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">AI GATE</span>
          </div>
        )}
        {collapsed && <Zap className="h-6 w-6 text-primary mx-auto" />}
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
      <div className="px-3 py-3">
        <Link href="/chat">
          <Button className={cn('w-full', collapsed && 'px-0')} size="sm">
            <Plus className="h-4 w-4" />
            {!collapsed && t('newChat')}
          </Button>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}>
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
