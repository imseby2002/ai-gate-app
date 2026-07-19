'use client'

import {
  MessageSquare, Sparkles, BookOpen, Database, Calculator,
  FlaskConical, ClipboardList, Ticket, Inbox, Zap, Lock, ArrowLeft,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CsPlanFeatures } from '@/lib/cs/entitlements'

// CS 各頁共用的左側功能選單。工作台（/cs/workspace）本身用內部 tab，
// 但方案頁等獨立頁沿用這個以連結形式呈現同一份功能選單，讓 CS 各頁都有一致的側欄。
type Item = { key: string; label: string; icon: LucideIcon; href: string; gate?: keyof CsPlanFeatures }

const ITEMS: Item[] = [
  { key: 'platforms', label: '平台', icon: MessageSquare, href: '/cs/workspace?tab=platforms' },
  { key: 'ai-settings', label: 'AI 設定', icon: Sparkles, href: '/cs/workspace?tab=ai-settings' },
  { key: 'dialogue-files', label: '知識庫', icon: BookOpen, href: '/cs/workspace?tab=dialogue-files' },
  { key: 'data-sources', label: '資料來源', icon: Database, href: '/cs/workspace?tab=data-sources', gate: 'dataSources' },
  { key: 'pricing', label: '定價計算機', icon: Calculator, href: '/cs/workspace?tab=pricing', gate: 'pricingCalculator' },
  { key: 'test', label: '測試', icon: FlaskConical, href: '/cs/workspace?tab=test' },
  { key: 'logs', label: '記錄', icon: ClipboardList, href: '/cs/workspace?tab=logs' },
  { key: 'tickets', label: '工單', icon: Ticket, href: '/cs/workspace?tab=tickets', gate: 'tickets' },
  { key: 'inbox', label: '收件匣', icon: Inbox, href: '/cs/workspace?tab=inbox', gate: 'inbox' },
]

export function CsSideNav({
  active,
  features,
}: {
  active: string
  features?: CsPlanFeatures | null
}) {
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
        <span className="flex-1 text-left">客服主頁</span>
      </a>
      {ITEMS.map(it =>
        row({
          label: it.label,
          icon: it.icon,
          href: it.href,
          isActive: active === it.key,
          locked: !!it.gate && features != null && features[it.gate] === false,
        }),
      )}
      {row({ label: '升級方案', icon: Zap, href: '/cs/plan', isActive: active === 'plan' })}
    </nav>
  )
}
