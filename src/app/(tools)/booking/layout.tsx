'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BnbSwitcher from './BnbSwitcher'
import {
  CalendarDays, Home, List, RefreshCw, Mail, Building2,
  BedDouble, BarChart2, Tag, ChevronLeft, ChevronRight, Menu, X,
  LayoutGrid, Percent, Bell, Star, Globe, ClipboardList, Users,
} from 'lucide-react'

type NavItem = { href: string; labelKey: string; icon: React.ElementType }
type NavGroup = { titleKey: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: '',
    items: [
      { href: '/admin', labelKey: 'nav.overview', icon: Home },
    ],
  },
  {
    titleKey: 'group.property',
    items: [
      { href: '/booking/profile',     labelKey: 'nav.profile',    icon: Building2 },
      { href: '/booking/website',     labelKey: 'nav.website',    icon: Globe },
      { href: '/booking/properties',  labelKey: 'nav.properties', icon: BedDouble },
      { href: '/booking/pricing',     labelKey: 'nav.pricing',    icon: Tag },
      { href: '/booking/promos',      labelKey: 'nav.promos',     icon: Percent },
      { href: '/team?scope=booking',  labelKey: 'nav.team',       icon: Users },
    ],
  },
  {
    titleKey: 'group.orders',
    items: [
      { href: '/booking/daily',           labelKey: 'nav.daily',          icon: ClipboardList },
      { href: '/booking/bookings',        labelKey: 'nav.bookings',       icon: List },
      { href: '/booking/public-bookings', labelKey: 'nav.publicBookings', icon: Globe },
      { href: '/booking/calendar',        labelKey: 'nav.calendar',       icon: CalendarDays },
      { href: '/booking/roomgrid',        labelKey: 'nav.roomgrid',       icon: LayoutGrid },
    ],
  },
  {
    titleKey: 'group.guest',
    items: [
      { href: '/booking/notifications', labelKey: 'nav.notifications', icon: Bell },
      { href: '/booking/reviews',       labelKey: 'nav.reviews',       icon: Star },
    ],
  },
  {
    titleKey: 'group.data',
    items: [
      { href: '/booking/reports', labelKey: 'nav.reports', icon: BarChart2 },
      { href: '/booking/ical',    labelKey: 'nav.ical',    icon: RefreshCw },
      { href: '/booking/email',   labelKey: 'nav.email',   icon: Mail },
    ],
  },
]

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations('Booking')
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  function isActive(href: string) {
    return pathname === href || (href !== '/booking' && pathname.startsWith(href))
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Desktop sidebar */}
      <aside className={`hidden sm:flex shrink-0 h-full border-r bg-white flex-col transition-all duration-200
        ${collapsed ? 'w-14' : 'w-52'}`}>

        {/* Header */}
        <div className={`flex items-center shrink-0 pt-4 mb-1 ${collapsed ? 'justify-center px-1.5' : 'justify-between px-4'}`}>
          {!collapsed && <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('title')}</span>}
          <button onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <BnbSwitcher collapsed={collapsed} />

        {/* Scrollable nav */}
        <nav className={`flex-1 overflow-y-auto min-h-0 pb-4 ${collapsed ? 'px-1.5' : 'px-2'}`}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {/* Group title — hidden when collapsed */}
              {group.titleKey && !collapsed && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t(group.titleKey)}</span>
                </div>
              )}
              {/* Divider when collapsed */}
              {group.titleKey && collapsed && gi > 0 && (
                <div className="my-2 border-t border-gray-100" />
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(n => {
                  const Icon = n.icon
                  return (
                    <Link key={n.href} href={n.href} title={t(n.labelKey)}
                      className={`flex items-center rounded-lg text-sm font-medium transition-colors shrink-0
                        ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'}
                        ${isActive(n.href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{t(n.labelKey)}</span>}
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
          <span className="font-semibold text-sm text-gray-900">{t('title')}</span>
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
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('title')}</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="px-2 pb-1"><BnbSwitcher /></div>
            <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-5">
              {NAV_GROUPS.map((group, gi) => (
                <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
                  {group.titleKey && (
                    <div className="px-2 pt-3 pb-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t(group.titleKey)}</span>
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
                          {t(n.labelKey)}
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
