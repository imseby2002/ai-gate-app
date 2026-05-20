'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, List, RefreshCw, Mail, Building2, BedDouble, BarChart2 } from 'lucide-react'

const NAV = [
  { href: '/booking',            label: '總覽',       icon: Home },
  { href: '/booking/profile',    label: '民宿資料',   icon: Building2 },
  { href: '/booking/bookings',   label: '訂單',       icon: List },
  { href: '/booking/calendar',   label: '日曆',       icon: CalendarDays },
  { href: '/booking/properties', label: '房型管理',   icon: BedDouble },
  { href: '/booking/reports',    label: '數據報表',   icon: BarChart2 },
  { href: '/booking/ical',       label: 'iCal 同步',  icon: RefreshCw },
  { href: '/booking/email',      label: 'Email 擷取', icon: Mail },
]

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-52 shrink-0 border-r bg-white flex flex-col py-6 gap-1 px-3 overflow-y-auto">
        <div className="px-2 pb-4">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">訂房管理</span>
        </div>
        {NAV.map(n => {
          const Icon = n.icon
          const active = pathname === n.href || (n.href !== '/booking' && pathname.startsWith(n.href))
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          )
        })}
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
