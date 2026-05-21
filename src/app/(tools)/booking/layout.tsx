'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, List, RefreshCw, Mail, Building2, BedDouble, BarChart2, Tag, ChevronLeft, ChevronRight } from 'lucide-react'

const NAV = [
  { href: '/booking',            label: '總覽',       icon: Home },
  { href: '/booking/profile',    label: '民宿資料',   icon: Building2 },
  { href: '/booking/bookings',   label: '訂單',       icon: List },
  { href: '/booking/calendar',   label: '日曆',       icon: CalendarDays },
  { href: '/booking/pricing',    label: '定價管理',   icon: Tag },
  { href: '/booking/properties', label: '房型管理',   icon: BedDouble },
  { href: '/booking/reports',    label: '數據報表',   icon: BarChart2 },
  { href: '/booking/ical',       label: 'iCal 同步',  icon: RefreshCw },
  { href: '/booking/email',      label: 'Email 擷取', icon: Mail },
]

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`relative shrink-0 border-r bg-white flex flex-col py-4 gap-1 overflow-y-auto transition-all duration-200
        ${collapsed ? 'w-14 px-1.5' : 'w-52 px-3'}`}>

        {/* Header + toggle */}
        <div className={`flex items-center mb-3 ${collapsed ? 'justify-center px-0' : 'justify-between px-2'}`}>
          {!collapsed && (
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">訂房管理</span>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {NAV.map(n => {
          const Icon = n.icon
          const active = pathname === n.href || (n.href !== '/booking' && pathname.startsWith(n.href))
          return (
            <Link key={n.href} href={n.href} title={collapsed ? n.label : undefined}
              className={`flex items-center rounded-lg text-sm font-medium transition-colors
                ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'}
                ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          )
        })}
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
