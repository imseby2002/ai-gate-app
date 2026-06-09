import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SUBDOMAIN_SYSTEM } from '@/lib/systems'
import {
  MessageSquare, Bot, BarChart3, TrendingUp, Lock,
  ArrowRight, Sparkles, ChevronRight, Zap,
} from 'lucide-react'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { MODULES } from '@/lib/modules'
import { cn } from '@/lib/utils/cn'

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

const STAT_STYLES = [
  { iconBg: 'bg-blue-50 dark:bg-blue-950/50', iconColor: 'text-blue-600 dark:text-blue-400', border: 'border-blue-100 dark:border-blue-900' },
  { iconBg: 'bg-emerald-50 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-900' },
  { iconBg: 'bg-violet-50 dark:bg-violet-950/50', iconColor: 'text-violet-600 dark:text-violet-400', border: 'border-violet-100 dark:border-violet-900' },
]

export default async function AppsPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('Dashboard')
  const sp = await searchParams

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const enabledModules: string[] = profile?.enabled_modules ?? MODULES.map(m => m.id)
  const isAdmin = profile?.user_type === 'admin'

  // 子域 scope：chat.im-tourist.com 等子域只屬於單一系統，主頁僅顯示該系統模組（與左側選單一致）
  const host = (await headers()).get('host')?.split(':')[0].toLowerCase() ?? ''
  const sub = host.split('.')[0]
  const scope = SUBDOMAIN_SYSTEM[sub]

  // 潛在客戶已歸類至行銷中心，不在選單格單獨顯示（權限模組仍保留於 MODULES）
  // 非管理者：帶子域 scope 時只顯示該系統模組，否則只顯示有權限的模組；管理者顯示全部
  const visibleModules = MODULES.filter(m => {
    if (m.id === 'leads') return false
    if (isAdmin) return true
    if (scope) return m.id === scope
    return enabledModules.includes(m.id)
  })

  const { data: usageData } = await supabase
    .from('usage_daily')
    .select('model_id, message_count, total_cost_usd, input_tokens, output_tokens')
    .eq('user_id', user.id)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])

  const totalCost     = usageData?.reduce((sum, r) => sum + (r.total_cost_usd ?? 0), 0) ?? 0
  const totalMessages = usageData?.reduce((sum, r) => sum + (r.message_count ?? 0), 0) ?? 0
  const totalTokens   = usageData?.reduce((sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0) ?? 0

  const { count: assistantCount } = await supabase
    .from('assistants')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const displayName = profile?.full_name ?? profile?.email ?? ''
  const initials = getInitials(displayName)

  const stats = [
    { label: t('weeklyMessages'), value: totalMessages.toString(), icon: MessageSquare, sublabel: t('sublabelMessages') },
    { label: t('weeklyTokens'),   value: formatTokens(totalTokens), icon: TrendingUp, sublabel: t('sublabelTokens') },
    { label: t('weeklyCost'),     value: formatCost(totalCost),     icon: BarChart3, sublabel: t('sublabelCost') },
  ]

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-8 space-y-6 md:space-y-8">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-blue-50/80 to-violet-50/60 dark:from-primary/10 dark:via-slate-900/80 dark:to-violet-950/30 p-5 sm:p-8">
          {/* Decorative blob */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" />

          <div className="relative flex items-center gap-4 flex-wrap">
            <div className="flex-shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary/30 select-none">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles className="h-4 w-4 text-primary/70" />
                <span className="text-xs font-medium text-primary/70 uppercase tracking-wide">AI GATE</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {t('welcome', { name: profile?.full_name ?? profile?.email })}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>
          </div>

          {(isAdmin || enabledModules.includes('chat')) && (
            <div className="relative mt-5 sm:mt-6 flex items-center gap-3 flex-wrap">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
              >
                <Zap className="h-4 w-4" />
                {t('startChat')}
              </Link>
              <Link
                href="/assistants"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-white/10 border border-white/50 text-sm font-medium hover:bg-white/90 dark:hover:bg-white/15 transition-colors"
              >
                <Bot className="h-4 w-4" />
                {t('myAssistantBtn')}
              </Link>
            </div>
          )}
        </div>

        {/* ── Blocked notice ── */}
        {sp.blocked && (
          <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <Lock className="h-4 w-4 shrink-0" />
            {t('moduleBlocked')}
          </div>
        )}

        {/* ── Stats ── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-0.5">{t('weeklyStatTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat, i) => {
              const style = STAT_STYLES[i]
              return (
                <div key={stat.label} className="card-lift bg-card rounded-2xl border p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', style.iconBg)}>
                      <stat.icon className={cn('h-4 w-4', style.iconColor)} />
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold tabular-nums">{stat.value}</div>
                  <div className="text-xs text-muted-foreground/60 mt-1">{stat.sublabel}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Modules ── 子域 scope 下只有單一系統，毋須再列模組卡片 */}
        {!scope && (
        <div>
          <div className="flex items-center justify-between mb-4 px-0.5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('modulesTitle')}</h2>
            <span className="text-xs text-muted-foreground">{t('modulesAvailable', { count: visibleModules.filter(m => isAdmin || enabledModules.includes(m.id)).length, total: visibleModules.length })}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleModules.map(mod => {
              const accessible = isAdmin || enabledModules.includes(mod.id)
              return (
                <div
                  key={mod.id}
                  className={cn(
                    'card-lift relative rounded-2xl border overflow-hidden bg-card shadow-sm',
                    !accessible && 'opacity-55 pointer-events-none'
                  )}
                >
                  <div className={cn('h-1 w-full bg-gradient-to-r', mod.color)} />
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl leading-none">{mod.emoji}</span>
                      {!accessible && <Lock className="h-3.5 w-3.5 text-muted-foreground/50 mt-1" />}
                    </div>
                    <div className="font-semibold text-sm text-foreground">{t(`modules.${mod.id}.label` as Parameters<typeof t>[0])}</div>
                    <div className="text-xs text-muted-foreground mt-1 mb-5 leading-relaxed">{t(`modules.${mod.id}.desc` as Parameters<typeof t>[0])}</div>
                    {accessible ? (
                      <Link
                        href={mod.href}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        {t('startUsing')} <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
                        <Lock className="h-3 w-3" /> {t('locked')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* ── My Assistants ── */}
        {(isAdmin || enabledModules.includes('chat')) && (
          <div className="bg-card rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">{t('myAssistants')}</h2>
                  <p className="text-xs text-muted-foreground">{t('assistantCount', { count: assistantCount ?? 0 })}</p>
                </div>
              </div>
              <Link
                href="/assistants"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-70 transition-opacity"
              >
                {t('manage')} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {(assistantCount ?? 0) === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
                <Bot className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t('noAssistants')}</p>
                <Link
                  href="/assistants/new"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('createFirst')}
                </Link>
              </div>
            ) : (
              <Link
                href="/assistants"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              >
                <span>{t('viewAll')}</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
