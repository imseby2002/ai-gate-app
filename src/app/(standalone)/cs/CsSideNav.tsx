'use client'

import { useTranslations } from 'next-intl'
import {
  MessageSquare, Sparkles, BookOpen, Database, Calculator,
  FlaskConical, ClipboardList, Ticket, Inbox, Zap, Lock, ArrowLeft,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CsPlanFeatures } from '@/lib/cs/entitlements'

// CS 各頁共用的左側功能選單。工作台（/cs/workspace）本身用內部 tab，
// 但方案頁等獨立頁沿用這個以連結形式呈現同一份功能選單，讓 CS 各頁都有一致的側欄。
type Item = { key: string; labelKey: string; icon: LucideIcon; href: string; gate?: keyof CsPlanFeatures }

const ITEMS: Item[] = [
  { key: 'platforms', labelKey: 'navPlatforms', icon: MessageSquare, href: '/cs/workspace?tab=platforms' },
  { key: 'ai-settings', labelKey: 'navAiSettings', icon: Sparkles, href: '/cs/workspace?tab=ai-settings' },
  { key: 'dialogue-files', labelKey: 'navKnowledgeBase', icon: BookOpen, href: '/cs/workspace?tab=dialogue-files' },
  { key: 'data-sources', labelKey: 'navDataSources', icon: Database, href: '/cs/workspace?tab=data-sources', gate: 'dataSources' },
  { key: 'pricing', labelKey: 'navPricingCalculator', icon: Calculator, href: '/cs/workspace?tab=pricing', gate: 'pricingCalculator' },
  { key: 'test', labelKey: 'navTest', icon: FlaskConical, href: '/cs/workspace?tab=test' },
  { key: 'logs', labelKey: 'navLogs', icon: ClipboardList, href: '/cs/workspace?tab=logs' },
  { key: 'tickets', labelKey: 'navTickets', icon: Ticket, href: '/cs/workspace?tab=tickets', gate: 'tickets' },
  { key: 'inbox', labelKey: 'navInbox', icon: Inbox, href: '/cs/workspace?tab=inbox', gate: 'inbox' },
]

export function CsSideNav({
  active,
  features,
}: {
  active: string
  features?: CsPlanFeatures | null
}) {
  const t = useTranslations('CsSideNav')
  const row = (opts: { label: string; icon: LucideIcon; href: string; isActive: boolean; locked?: boolean }) => (
    <a
      href={opts.href}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 w-full ${
        opts.isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <opts.icon className={`h-4 w-4 shrink-0 ${opts.isActive ? 'text-primary' : 'text-gray-400'}`} />
      <span className="flex-1 text-left">{opts.label}</span>
      {opts.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
    </a>
  )

  return (
    <nav className="flex flex-wrap gap-1.5 sm:flex-col sm:flex-nowrap sm:w-48 sm:shrink-0">
      <a href="/cs" className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 flex items-center gap-2">
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{t('csHome')}</span>
      </a>
      {ITEMS.map(it =>
        row({
          label: t(it.labelKey),
          icon: it.icon,
          href: it.href,
          isActive: active === it.key,
          locked: !!it.gate && features != null && features[it.gate] === false,
        }),
      )}
      {row({ label: t('upgradePlan'), icon: Zap, href: '/cs/plan', isActive: active === 'plan' })}
    </nav>
  )
}
