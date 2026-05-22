'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays, Home, List, RefreshCw, Mail, Building2,
  BedDouble, BarChart2, Tag, ChevronLeft, ChevronRight, Menu, X, LayoutGrid, Percent, Bell,
} from 'lucide-react'

const NAV = [
  { href: '/booking',                label: '總覽',       icon: Home },
  { href: '/booking/profile',        label: '民宿資料',   icon: Building2 },
  { href: '/booking/bookings',       label: '訂單',       icon: List },
  { href: '/booking/calendar',       label: '日曆',       icon: CalendarDays },
  { href: '/booking/pricing',        label: '定價管理',   icon: Tag },
  { href: '/booking/promos',         label: '優惠碼',     icon: Percent },
  { href: '/booking/notifications',  label: '通知信',     icon: Bell },
  { href: '/booking/roomgrid',   label: '空房表',     icon: LayoutGrid },
  { href: '/booking/properties', label: '房型管理',   icon: BedDouble },
  { href: '/booking/reports',    label: '數據報表',   icon: BarChart2 },
  { href: '/booking/ical',       label: 'iCal 同步',  icon: RefreshCw },
  { href: '/booking/email',      label: 'Email 擷取', icon: Mail },
]

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
      <aside className={`hidden sm:flex shrink-0 border-r bg-white flex-col py-4 gap-1 overflow-y-auto transition-all duration-200
        ${collapsed ? 'w-14 px-1.5' : 'w-52 px-3'}`}>
        <div className={`flex items-center mb-3 ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {!collapsed && <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">訂房管理</span>}
          <button onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        {NAV.map(n => {
          const Icon = n.icon
          return (
            <Link key={n.href} href={n.href} title={collapsed ? n.label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors
                ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'}
                ${isActive(n.href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          )
        })}
      </aside>

      {/* Content area: mobile top bar + main */}
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
          <nav className="w-[280px] bg-white border-r flex flex-col py-5 gap-1 px-3 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-2 pb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">訂房管理</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            {NAV.map(n => {
              const Icon = n.icon
              return (
                <Link key={n.href} href={n.href} onClick={() => setDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors
                    ${isActive(n.href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <Icon className="h-5 w-5 shrink-0" />
                  {n.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </div>
  )
}
