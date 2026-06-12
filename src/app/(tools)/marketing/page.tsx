import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  Megaphone, Sparkles, GitBranch, BarChart3,
  ArrowRight, Zap, Target, Layers, Phone, Search,
} from 'lucide-react'

const FEATURES = [
  { key: 'auto',     icon: Megaphone,  href: '/marketing-auto',             color: 'from-violet-500 to-purple-600' },
  { key: 'designer', icon: Sparkles,   href: '/marketing/product-designer', color: 'from-pink-500 to-rose-600' },
  { key: 'geo',      icon: Search,     href: '/marketing/geo-writer',       color: 'from-indigo-500 to-blue-600' },
  { key: 'pipeline', icon: GitBranch,  href: '/marketing-pipeline',         color: 'from-blue-500 to-cyan-600' },
  { key: 'prospect', icon: Phone,      href: '/prospect-call',              color: 'from-teal-500 to-emerald-600' },
  { key: 'swot',     icon: BarChart3,  href: '/marketing-auto',             color: 'from-emerald-500 to-teal-600', secondary: true },
  { key: 'audience', icon: Target,     href: '/marketing-auto',             color: 'from-orange-500 to-amber-600', secondary: true },
  { key: 'brand',    icon: Layers,     href: '/settings',                   color: 'from-slate-500 to-gray-600',   secondary: true },
]

export default async function MarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('Marketing')

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 text-white px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-violet-200 text-sm mb-3">
            <Zap className="h-4 w-4" />
            <span>{t('heroBadge')}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('center')}</h1>
          <p className="text-violet-100 text-base max-w-xl">
            {t('heroSubtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Primary features */}
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">{t('coreFeatures')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.filter(f => !f.secondary).map(feature => {
              const Icon = feature.icon
              const tags = t.raw(`features.${feature.key}.tags`) as string[]
              return (
                <Link
                  key={feature.key}
                  href={feature.href}
                  className="group relative bg-white dark:bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} mb-4 shadow-sm`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="font-bold text-base">{t(`features.${feature.key}.title`)}</h3>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-2 shrink-0">{t(`features.${feature.key}.badge`)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{t(`features.${feature.key}.desc`)}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                    <span>{t('enter')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Secondary / integrated features */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">{t('integratedFeatures')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FEATURES.filter(f => f.secondary).map(feature => {
              const Icon = feature.icon
              return (
                <Link
                  key={feature.key}
                  href={feature.href}
                  className="group flex gap-3 bg-white dark:bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all duration-200"
                >
                  <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${feature.color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm truncate">{t(`features.${feature.key}.title`)}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t(`features.${feature.key}.desc`)}</p>
                    <p className="text-[10px] text-primary mt-1">{t(`features.${feature.key}.badge`)} →</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
