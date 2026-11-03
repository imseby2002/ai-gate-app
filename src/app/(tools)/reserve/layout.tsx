'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, CalendarDays, ClipboardList, Sparkles, Users,
  UserCheck, Bot, Settings, ExternalLink, ChevronLeft,
  ChevronRight, Menu, X, Clock, HeartHandshake
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/reserve', label: '總覽儀表板', icon: Home },
  { href: '/reserve/calendar', label: '預約行事曆', icon: CalendarDays },
  { href: '/reserve/appointments', label: '預約單管理', icon: ClipboardList },
  { href: '/reserve/services', label: '服務項目', icon: Sparkles },
  { href: '/reserve/staff', label: '服務人員排班', icon: Users },
  { href: '/reserve/customers', label: '客戶 CRM', icon: UserCheck },
  { href: '/reserve/ai-assistant', label: 'AI 智慧助理', icon: Bot, badge: 'AI' },
  { href: '/reserve/settings', label: '門市設定', icon: Settings },
]

export default function ReserveLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [storeSlug, setStoreSlug] = useState('demo')

  useEffect(() => {
    fetch('/api/reserve/store')
      .then(r => r.json())
      .then(d => {
        if (d?.store?.slug) setStoreSlug(d.store.slug)
      })
      .catch(() => {})
  }, [])

  function isActive(href: string) {
    if (href === '/reserve') return pathname === '/reserve'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden sm:flex shrink-0 h-full border-r bg-white dark:bg-slate-900 flex-col transition-all duration-200 select-none',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Header brand */}
        <div className="h-14 border-b flex items-center justify-between px-3.5">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-sm shadow-rose-200 dark:shadow-none shrink-0">
                <HeartHandshake className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  服務預約系統
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  診所 · 美髮 · 美業 · 各業
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto h-8 w-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <HeartHandshake className="h-4 w-4" />
            </div>
          )}

          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={collapsed ? '展開選單' : '收合選單'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative',
                  active
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-105', active ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')} />
                {!collapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Public customer page shortcut */}
        <div className="p-2 border-t bg-slate-50/70 dark:bg-slate-900/60">
          <Link
            href={`/r/${storeSlug}`}
            target="_blank"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all shadow-xs',
              collapsed && 'justify-center px-0'
            )}
            title="顧客線上預約前台頁面"
          >
            <ExternalLink className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            {!collapsed && <span className="truncate">預覽顧客預約頁</span>}
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs sm:hidden flex">
          <div className="w-64 bg-white dark:bg-slate-900 h-full p-4 flex flex-col shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-rose-600 flex items-center justify-center text-white">
                  <HeartHandshake className="h-4 w-4" />
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">服務預約系統</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 space-y-1">
              {NAV_ITEMS.map(item => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium',
                      active ? 'bg-rose-50 text-rose-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-rose-600' : 'text-slate-400')} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
            <Link
              href={`/r/${storeSlug}`}
              target="_blank"
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打開顧客線上預約頁
            </Link>
          </div>
          <div className="flex-1" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top navbar */}
        <header className="h-12 border-b bg-white dark:bg-slate-900 flex items-center justify-between px-3 sm:hidden shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-white">
            <HeartHandshake className="h-4 w-4 text-rose-600" />
            服務預約系統
          </div>
          <Link
            href={`/r/${storeSlug}`}
            target="_blank"
            className="text-xs text-rose-600 font-medium px-2 py-1 rounded-md bg-rose-50"
          >
            前台
          </Link>
        </header>

        {/* Main page content container */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
