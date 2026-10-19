'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Store, BarChart3, Boxes, Receipt, Wrench, Calendar,
  ArrowRight, ArrowLeft, ShieldCheck, CheckCircle2, Building2,
  Sparkles, ExternalLink, RefreshCw, Loader2, Compass, BookOpen, Download
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface StoreFeature {
  key: string
  href: string
  subtitle: string
  icon: any
  color: string
  chip: string
  ring: string
}

// 順序：第一排 排班／評分、盤點・訂貨、門市報表；第二排 水電冰塊費用、門市報修、門市教練 AI（營運教練＋設備排查）。
// 門市點單 POS 是門市獨立使用的前台，不放在門市營運，改由辦公室管理者從公司入口進入。
const STORE_FEATURES: StoreFeature[] = [
  {
    key: 'shift',
    href: '/shift',
    subtitle: 'Shifts & Staff Evaluation',
    icon: Calendar,
    color: 'text-violet-600 dark:text-violet-400',
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    ring: 'hover:border-violet-500/60',
  },
  {
    key: 'inventory',
    href: '/store-inventory',
    subtitle: 'Inventory & Purchase Orders',
    icon: Boxes,
    color: 'text-blue-600 dark:text-blue-400',
    chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    ring: 'hover:border-blue-500/60',
  },
  {
    key: 'reports',
    href: '/store-reports',
    subtitle: 'Store Reports & Profit',
    icon: BarChart3,
    color: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    ring: 'hover:border-emerald-500/60',
  },
  {
    key: 'bills',
    href: '/store-bills',
    subtitle: 'Utilities & Expense Bills',
    icon: Receipt,
    color: 'text-amber-600 dark:text-amber-400',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    ring: 'hover:border-amber-500/60',
  },
  {
    key: 'repair',
    href: '/repair',
    subtitle: 'Equipment Maintenance',
    icon: Wrench,
    color: 'text-orange-600 dark:text-orange-400',
    chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    ring: 'hover:border-orange-500/60',
  },
]

// 教練 AI：門市營運教練 AI 與設備快速排查 AI 放在同一張卡
const AI_LINKS = [
  { key: 'coach', href: '/store-coach', icon: Compass },
  { key: 'repairAi', href: '/repair?tab=ai&mode=store', icon: Wrench },
]

export default function StoreDepartmentHubPage() {
  const t = useTranslations('Store')
  const [lockedStore, setLockedStore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fin/bills?month=1&year=2026')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.locked_store) {
          setLockedStore(d.locked_store)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* 頂部導航與標題 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/50">
                {t('badge')}
              </span>
              {lockedStore && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 gap-1 text-xs">
                  🔒 {t('lockedBadge', { store: lockedStore })}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a href="/api/docs/store-manual" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="h-4 w-4" />
              {t('manualDoc')}
            </Button>
          </a>
          <a href="/api/docs/store-manual?download=1" title={t('manualDownload')}>
            <Button variant="outline" size="sm" className="px-2"><Download className="h-4 w-4" /></Button>
          </a>
          <Link href="/office">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" />
              {t('backToOffice')}
            </Button>
          </Link>
        </div>
      </div>

      {/* 門市帳號鎖定提示（若綁定門市） */}
      {lockedStore && (
        <div className="p-3.5 rounded-xl border bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {t.rich('lockedNotice', { store: lockedStore, strong: (chunks) => <strong>{chunks}</strong> })}
            </span>
          </div>
        </div>
      )}

      {/* 核心功能卡片網格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STORE_FEATURES.map(f => {
          const Icon = f.icon
          const title = t(`feature_${f.key}_title`)
          const tags = t(`feature_${f.key}_tags`).split('、')
          return (
            <Link key={f.href} href={f.href} className="group block focus:outline-none">
              <Card className={`p-5 h-full flex flex-col justify-between transition-all duration-200 border hover:shadow-md hover:-translate-y-0.5 ${f.ring}`}>
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${f.chip}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                          {title}
                        </h3>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {f.subtitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {t(`feature_${f.key}_desc`)}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between text-xs font-semibold text-primary mt-2">
                  <span className="group-hover:underline">{t('open', { title })}</span>
                  <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all">
                    <span className="text-[11px] font-normal">{t('enter')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}

        <Card className="p-5 h-full flex flex-col justify-between transition-all duration-200 border hover:shadow-md ring-1 ring-emerald-500/30 hover:border-emerald-500/60">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">{t('feature_ai_title')}</h3>
                <span className="text-[11px] text-muted-foreground font-medium">Store Coach & Equipment AI</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{t('feature_ai_desc')}</p>
          </div>
          <div className="pt-3 border-t space-y-1 mt-2">
            {AI_LINKS.map(l => {
              const Icon = l.icon
              return (
                <Link key={l.href} href={l.href}
                  className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 text-xs font-semibold text-primary hover:bg-muted/60">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate group-hover:underline">{t(`feature_${l.key}_title`)}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
