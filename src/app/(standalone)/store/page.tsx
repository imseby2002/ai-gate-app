'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Store, BarChart3, Boxes, Receipt, Wrench, Calendar, ShoppingBag,
  ArrowRight, ArrowLeft, ShieldCheck, CheckCircle2, Building2,
  Sparkles, ExternalLink, RefreshCw, Loader2, Compass
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

const STORE_FEATURES: StoreFeature[] = [
  {
    key: 'coach',
    href: '/store-coach',
    subtitle: 'Store Management Coach AI',
    icon: Compass,
    color: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    ring: 'hover:border-emerald-500/60 ring-1 ring-emerald-500/30',
  },
  {
    key: 'repairAi',
    href: '/repair?tab=ai&mode=store',
    subtitle: 'Equipment Diagnostic Assistant',
    icon: Wrench,
    color: 'text-amber-600 dark:text-amber-400',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    ring: 'hover:border-amber-500/60 ring-1 ring-amber-500/30',
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
    key: 'inventory',
    href: '/store-inventory',
    subtitle: 'Inventory & Purchase Orders',
    icon: Boxes,
    color: 'text-blue-600 dark:text-blue-400',
    chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    ring: 'hover:border-blue-500/60',
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
  {
    key: 'shift',
    href: '/shift',
    subtitle: 'Staff Shift Scheduling',
    icon: Calendar,
    color: 'text-violet-600 dark:text-violet-400',
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    ring: 'hover:border-violet-500/60',
  },
  {
    key: 'pos',
    href: '/pos',
    subtitle: 'Counter Order & Register',
    icon: ShoppingBag,
    color: 'text-pink-600 dark:text-pink-400',
    chip: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    ring: 'hover:border-pink-500/60',
  },
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
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <Link href="/office">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" />
            {t('backToOffice')}
          </Button>
        </Link>
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

      {/* 門市營運教練 AI 旗艦 Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30 shadow-xs">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white">
                {t('coachBannerTitle')}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black">
                {t('coachBannerBadge')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-200/90 mt-0.5">
              {t('coachBannerDesc')}
            </p>
          </div>
        </div>
        <Link href="/store-coach" className="shrink-0 self-start md:self-auto">
          <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm px-5 rounded-xl gap-1.5 shadow-md cursor-pointer">
            {t('coachBannerCta')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* 門市設備快速排查 AI 快捷通道 */}
      <div className="p-4 rounded-2xl border bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                ⚡ {t('repairAiBannerTitle')}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                {t('repairAiBannerBadge')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('repairAiBannerDesc')}
            </p>
          </div>
        </div>
        <Link href="/repair?tab=ai&mode=store" className="shrink-0 self-start sm:self-auto">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold gap-1.5 rounded-xl shadow-xs">
            {t('repairAiBannerCta')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* 8 大核心功能卡片網格 */}
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
      </div>
    </div>
  )
}
