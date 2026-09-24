'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Megaphone, Palette, LayoutDashboard, Phone, Menu, Search, Wand2, Crown, Brain, NotebookPen, MapPin, Fingerprint, GitBranch, Share2, Sparkles, Building2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NavItem {
  href: string
  labelKey: string
  icon: React.ElementType
  match?: string[]          // 額外視為 active 的路徑前綴（合併頁用）
  children?: NavItem[]      // 巢狀子項（縮排顯示，例如流水線收在自動化下）
}

// 依用途分組：製作 → 投放 → 追蹤
const SECTIONS: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: 'section.create',
    items: [
      { href: '/marketing/templates',        labelKey: 'nav.templates', icon: Sparkles },
      { href: '/marketing/product-designer', labelKey: 'nav.designer', icon: Palette },
      { href: '/marketing/ai-studio',        labelKey: 'nav.studio',   icon: Wand2 },
      { href: '/marketing/geo-writer',       labelKey: 'nav.geo',      icon: Search },
      // AI 專家：內建專家＋自製專家合併（/marketing/skills 舊路由也算 active）
      { href: '/marketing/experts',          labelKey: 'nav.aiExpert', icon: Brain, match: ['/marketing/skills'] },
    ],
  },
  {
    titleKey: 'section.distribute',
    items: [
      { href: '/marketing/social-matrix', labelKey: 'nav.socialMatrix', icon: Share2 },
      {
        href: '/marketing-auto', labelKey: 'nav.auto', icon: LayoutDashboard,
        children: [
          { href: '/marketing-pipeline', labelKey: 'nav.pipeline', icon: GitBranch },
        ],
      },
      { href: '/prospect-call',    labelKey: 'nav.prospect', icon: Phone },
      { href: '/marketing/offline', labelKey: 'nav.offline', icon: MapPin },
    ],
  },
  {
    titleKey: 'section.track',
    items: [
      { href: '/marketing/logbook', labelKey: 'nav.logbook', icon: NotebookPen },
    ],
  },
]

// 一次性 / 設定型：收在底部
const SETTINGS: NavItem[] = [
  { href: '/marketing/brand', labelKey: 'nav.brand', icon: Fingerprint },
  { href: '/marketing/plan',  labelKey: 'nav.plan',  icon: Crown },
]

const COLLAPSE_KEY = 'mkt-nav-collapsed'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations('Marketing')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // 還原上次收合狀態（每位使用者本機記憶）
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1') } catch { /* ignore */ }
  }, [])
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  const isActive = (n: NavItem) =>
    pathname.startsWith(n.href) || (n.match?.some(m => pathname.startsWith(m)) ?? false)

  const renderItem = (n: NavItem, indent = false, collapse = false) => {
    const Icon = n.icon
    const active = isActive(n)
    return (
      <Link key={n.href} href={n.href} onClick={() => setDrawerOpen(false)}
        title={collapse ? t(n.labelKey) : undefined}
        className={`flex items-center rounded-lg text-sm font-medium transition-colors
          ${collapse ? 'justify-center py-2.5' : `gap-2.5 py-2 ${indent ? 'pl-9 pr-3' : 'px-3'}`}
          ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
        <Icon className="h-4 w-4 shrink-0" />
        {!collapse && t(n.labelKey)}
      </Link>
    )
  }

  const sectionLabel = (text: string, extraClass = '') => (
    <span className={`text-[10px] font-bold text-gray-400 uppercase tracking-wide px-2 ${extraClass}`}>{text}</span>
  )

  const navContent = (collapse: boolean) => (
    <>
      <div className={`flex items-center pb-3 ${collapse ? 'justify-center' : 'gap-2 px-2'}`}>
        {!collapse && <Megaphone className="h-4 w-4 text-indigo-600" />}
        {!collapse && <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('center')}</span>}
        {/* 收合切換（桌面才顯示） */}
        <button type="button" onClick={toggleCollapsed}
          title={collapse ? '展開選單' : '收合選單'}
          className={`hidden sm:grid place-items-center h-7 w-7 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${collapse ? '' : 'ml-auto'}`}>
          {collapse ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {SECTIONS.map((sec, i) => (
        <div key={sec.titleKey} className="flex flex-col gap-0.5">
          {collapse
            ? (i > 0 && <div className="h-px bg-gray-100 mx-1.5 my-1.5" />)
            : sectionLabel(t(sec.titleKey), i === 0 ? 'mb-1' : 'mt-3 mb-1')}
          {sec.items.map(item => (
            <div key={item.href} className="flex flex-col gap-0.5">
              {renderItem(item, false, collapse)}
              {item.children?.map(child => renderItem(child, true, collapse))}
            </div>
          ))}
        </div>
      ))}

      {/* 設定型（一次性）：品牌資料、訂閱方案 */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-0.5">
        {!collapse && sectionLabel(t('section.settings'), 'mb-1')}
        {SETTINGS.map(item => renderItem(item, false, collapse))}
      </div>

      <div className="mt-auto pt-3 border-t border-gray-100 flex flex-col gap-1">
        {!collapse && sectionLabel(t('section.collab'))}
        <Link href="/mkt" title={collapse ? '門市與產品資產庫' : undefined}
          className={`flex items-center rounded-lg text-xs font-semibold text-pink-700 bg-pink-50 hover:bg-pink-100 transition-colors
            ${collapse ? 'justify-center py-2.5' : 'gap-2 px-3 py-2'}`}>
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          {!collapse && <span>門市與產品資產庫 ↗</span>}
        </Link>
        <Link href="/office" title={collapse ? 'IMT ERP' : undefined}
          className={`flex items-center rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors
            ${collapse ? 'justify-center py-2.5' : 'gap-2 px-3 py-2'}`}>
          {collapse ? <Building2 className="h-3.5 w-3.5 shrink-0" /> : <span>IMT ERP ↗</span>}
        </Link>
      </div>
    </>
  )

  return (
    <div className="flex h-full bg-gray-50">
      {/* Desktop sidebar */}
      <aside className={`hidden sm:flex shrink-0 border-r bg-white flex-col py-5 gap-0.5 overflow-y-auto transition-[width] duration-200
        ${collapsed ? 'w-16 px-2' : 'w-52 px-3'}`}>
        {navContent(collapsed)}
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

      {/* Mobile drawer（永遠展開） */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <nav className="w-[240px] bg-white border-r flex flex-col py-5 gap-0.5 px-3 overflow-y-auto">
            {navContent(false)}
          </nav>
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </div>
  )
}
