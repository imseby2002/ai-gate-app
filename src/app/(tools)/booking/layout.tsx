'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays, Home, List, RefreshCw, Mail, Building2,
  BedDouble, BarChart2, Tag, ChevronLeft, ChevronRight, Menu, X,
  LayoutGrid, Percent, Bell, Star, Globe, Download,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: React.ElementType }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: '',
    items: [
      { href: '/booking',        label: '總覽',     icon: Home },
      { href: '/booking/import', label: 'OTA 匯入', icon: Download },
    ],
  },
  {
    title: '民宿設定',
    items: [
      { href: '/booking/profile',     label: '民宿資料', icon: Building2 },
      { href: '/booking/properties',  label: '房型管理', icon: BedDouble },
      { href: '/booking/pricing',     label: '定價管理', icon: Tag },
      { href: '/booking/promos',      label: '優惠碼',   icon: Percent },
    ],
  },
  {
    title: '訂單管理',
    items: [
      { href: '/booking/bookings',        label: '訂單',     icon: List },
      { href: '/booking/public-bookings', label: '線上訂房', icon: Globe },
      { href: '/booking/calendar',        label: '日曆',     icon: CalendarDays },
      { href: '/booking/roomgrid',        label: '空房表',   icon: LayoutGrid },
    ],
  },
  {
    title: '旅客互動',
    items: [
      { href: '/booking/notifications', label: '通知信',   icon: Bell },
      { href: '/booking/reviews',       label: '評價管理', icon: Star },
    ],
  },
  {
    title: '數據與同步',
    items: [
      { href: '/booking/reports', label: '數據報表',   icon: BarChart2 },
      { href: '/booking/ical',    label: 'iCal 同步',  icon: RefreshCw },
      { href: '/booking/email',   label: 'Email 擷取', icon: Mail },
    ],
  },
]

// Flat list for mobile drawer (same items, no groups)
const NAV_FLAT = NAV_GROUPS.flatMap(g => g.items)

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function isActive(href: string) {
    return pathname === href || (href !== '/booking' && pathname.startsWith(href))
  }

  return (
    <div className="flex h-[100dvh] bg-gray-50">
      {/* Desktop sidebar */}
      <aside className={`hidden sm:flex shrink-0 h-[100dvh] border-r bg-white flex-col transition-all duration-200
        ${collapsed ? 'w-14' : 'w-52'}`}>

        {/* Header */}
        <div className={`flex items-center shrink-0 pt-4 mb-1 ${collapsed ? 'justify-center px-1.5' : 'justify-between px-4'}`}>
          {!collapsed && <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">訂房管理</span>}
          <button onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Scrollable nav */}
        <nav className={`flex-1 overflow-y-auto min-h-0 pb-4 ${collapsed ? 'px-1.5' : 'px-2'}`}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {/* Group title — hidden when collapsed */}
              {group.title && !collapsed && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{group.title}</span>
                </div>
              )}
              {/* Divider when collapsed */}
              {group.title && collapsed && gi > 0 && (
                <div className="my-2 border-t border-gray-100" />
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(n => {
                  const Icon = n.icon
                  return (
                    <Link key={n.href} href={n.href} title={n.label}
                      className={`flex items-center rounded-lg text-sm font-medium transition-colors shrink-0
                        ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'}
                        ${isActive(n.href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{n.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="sm:hidden flex items-center justify-between px-4 h-14 border-b bg-white shrink-0">
          <span className="font-semibold text-sm text-gray-900">訂房管理</span>
          <button onClick={() => setDrawerOpen(true)}
            className="p-2 -mr-1 rounded-lg hover:bg-gray-100 text-gray-600">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <nav className="w-[280px] h-full bg-white border-r flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">訂房管理</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-5">
              {NAV_GROUPS.map((group, gi) => (
                <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
                  {group.title && (
                    <div className="px-2 pt-3 pb-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{group.title}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {group.items.map(n => {
                      const Icon = n.icon
                      return (
                        <Link key={n.href} href={n.href} onClick={() => setDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0
                            ${isActive(n.href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                          <Icon className="h-4 w-4 shrink-0" />
                          {n.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </div>
  )
}
