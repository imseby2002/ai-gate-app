'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Megaphone, Palette, LayoutDashboard, Phone, Menu, Sparkles, Search, Wand2, Crown, Brain, NotebookPen } from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { href: '/marketing-auto',             labelKey: 'nav.auto',     icon: LayoutDashboard },
  { href: '/marketing/product-designer', labelKey: 'nav.designer', icon: Palette },
  { href: '/marketing/ai-studio',        labelKey: 'nav.studio',   icon: Wand2 },
  { href: '/marketing/geo-writer',       labelKey: 'nav.geo',      icon: Search },
  { href: '/marketing/skills',           labelKey: 'nav.expert',   icon: Sparkles },
  { href: '/marketing/experts',          labelKey: 'nav.experts',  icon: Brain },
  { href: '/prospect-call',              labelKey: 'nav.prospect', icon: Phone },
  { href: '/marketing/logbook',          labelKey: 'nav.logbook',  icon: NotebookPen },
  { href: '/marketing/plan',             labelKey: 'nav.plan',     icon: Crown },
]

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations('Marketing')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const navContent = (
    <>
      <div className="flex items-center gap-2 px-2 pb-4">
        <Megaphone className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('center')}</span>
      </div>
      {NAV.map(n => {
        const Icon = n.icon
        const active = n.href === '/marketing' ? pathname === '/marketing' : pathname.startsWith(n.href)
        return (
          <Link key={n.href} href={n.href} onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Icon className="h-4 w-4" />
            {t(n.labelKey)}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="flex h-full bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-52 shrink-0 border-r bg-white flex-col py-5 gap-0.5 px-3">
        {navContent}
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="sm:hidden flex items-center gap-3 px-4 h-12 border-b bg-white shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800">{t('center')}</span>
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <nav className="w-[240px] bg-white border-r flex flex-col py-5 gap-0.5 px-3">
            {navContent}
          </nav>
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </div>
  )
}
