'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Megaphone, Palette, LayoutDashboard } from 'lucide-react'

const NAV = [
  { href: '/marketing',                  label: '行銷中心',    icon: LayoutDashboard },
  { href: '/marketing/product-designer', label: '產品設計師',  icon: Palette },
]

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full bg-gray-50">
      <aside className="w-52 shrink-0 border-r bg-white flex flex-col py-5 gap-0.5 px-3">
        <div className="flex items-center gap-2 px-2 pb-4">
          <Megaphone className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">行銷中心</span>
        </div>
        {NAV.map(n => {
          const Icon = n.icon
          const active = n.href === '/marketing' ? pathname === '/marketing' : pathname.startsWith(n.href)
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
